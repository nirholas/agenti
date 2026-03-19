import { Router, type Request, type Response, type IRouter } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { isAdmin } from '../utils/admin.js';
import {
  createRewardAddress,
  getRewardAddressesByUser,
  getRewardAddressByAddress,
  getRewardAddressById,
  verifyRewardAddress,
  deleteRewardAddress,
  isUserEnrolledInRewards,
} from '../db/reward-addresses.js';
import { isFacilitatorOwner } from '../db/facilitators.js';
import {
  verifySolanaSignature,
  createVerificationMessage,
} from '../utils/solana-verify.js';
import {
  verifyEVMSignature,
  createEVMVerificationMessage,
} from '../utils/evm-verify.js';
import { createDailySnapshots, getUserTotalVolume, getVolumeBreakdownByUser, getTotalPoolVolume } from '../db/volume-aggregation.js';
import {
  createCampaign,
  getCampaignById,
  getAllCampaigns,
  getCampaignsByStatus,
  getPublishedCampaign,
  getCompletedCampaigns,
  updateCampaign,
  deleteCampaign,
  type CampaignStatus,
} from '../db/campaigns.js';
import {
  createCampaignAudit,
  getCampaignAuditHistory,
} from '../db/campaign-audit.js';
import {
  getRewardClaimsByUser,
  getRewardClaimsByCampaign,
  getRewardClaimById,
  updateRewardClaim,
  getRewardClaimByUserAndCampaign,
} from '../db/reward-claims.js';
import { getDatabase } from '../db/index.js';
import {
  checkClaimEligibility,
  createOrGetClaimRecord,
} from '../services/reward-claims.js';
import { executeRewardTransfer } from '../services/reward-transfer.js';

const router: IRouter = Router();

/**
 * GET /status
 * Get the current user's rewards status
 */
router.get('/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const hasAddresses = isUserEnrolledInRewards(userId);
    const isUserAdmin = isAdmin(userId);
    const isOwner = isFacilitatorOwner(userId);
    const addresses = getRewardAddressesByUser(userId);

    // Enrolled if: has registered addresses OR owns a facilitator (auto-enrolled)
    const isEnrolled = hasAddresses || isOwner;

    res.json({
      isEnrolled,
      isAdmin: isUserAdmin,
      isFacilitatorOwner: isOwner,
      addresses,
    });
  } catch (error) {
    console.error('Error getting rewards status:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get rewards status',
    });
  }
});

// Maximum addresses per user (per RESEARCH.md recommendation)
const MAX_ADDRESSES_PER_USER = 5;

// Validation schema for enrollment
const enrollSchema = z.object({
  chain_type: z.enum(['solana', 'evm']),
  address: z.string().min(1, 'Address is required'),
  signature: z.string().min(1, 'Signature is required'),
  message: z.string().min(1, 'Message is required'),
});

/**
 * POST /enroll
 * Enroll a wallet address for rewards tracking
 *
 * Requires cryptographic proof of address ownership via signature verification.
 * Flow: client signs verification message -> server verifies -> address saved as verified
 */
router.post('/enroll', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    // Validate request body
    const parseResult = enrollSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'Validation error',
        message: parseResult.error.errors[0]?.message || 'Invalid request body',
      });
      return;
    }

    const { chain_type, address, signature, message } = parseResult.data;

    // Verify signature based on chain type
    if (chain_type === 'solana') {
      const expectedMessage = createVerificationMessage(address);
      if (message !== expectedMessage) {
        res.status(400).json({
          error: 'Validation error',
          message: 'Message format mismatch',
        });
        return;
      }

      if (!verifySolanaSignature(address, signature, message)) {
        res.status(400).json({
          error: 'Validation error',
          message: 'Invalid signature - could not verify address ownership',
        });
        return;
      }
    } else if (chain_type === 'evm') {
      const expectedMessage = createEVMVerificationMessage(address);
      if (message !== expectedMessage) {
        res.status(400).json({
          error: 'Validation error',
          message: 'Message format mismatch',
        });
        return;
      }

      if (!(await verifyEVMSignature(address, signature, message))) {
        res.status(400).json({
          error: 'Validation error',
          message: 'Invalid signature - could not verify address ownership',
        });
        return;
      }
    }

    // Check global uniqueness - one address per user globally
    const existingAddress = getRewardAddressByAddress(address, chain_type);
    if (existingAddress) {
      res.status(409).json({
        error: 'Conflict',
        message: 'This address is already registered',
      });
      return;
    }

    // Check address limit per user
    const userAddresses = getRewardAddressesByUser(userId);
    if (userAddresses.length >= MAX_ADDRESSES_PER_USER) {
      res.status(400).json({
        error: 'Limit reached',
        message: `You've reached the maximum number of addresses (${MAX_ADDRESSES_PER_USER})`,
      });
      return;
    }

    // Create the reward address
    const created = createRewardAddress({
      user_id: userId,
      chain_type,
      address,
    });

    if (!created) {
      res.status(409).json({
        error: 'Conflict',
        message: 'Address already enrolled or duplicate entry',
      });
      return;
    }

    // Immediately mark as verified (atomic flow per CONTEXT.md)
    verifyRewardAddress(created.id);

    // Re-fetch to get updated verification status
    const verified = getRewardAddressById(created.id);

    res.status(201).json(verified);
  } catch (error) {
    console.error('Error enrolling address:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to enroll address',
    });
  }
});

/**
 * DELETE /addresses/:id
 * Remove a reward address from user's account
 */
router.delete('/addresses/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const addressId = req.params.id;

    // Verify ownership - get address and check user_id matches
    const address = getRewardAddressById(addressId);

    if (!address) {
      res.status(404).json({
        error: 'Not found',
        message: 'Address not found',
      });
      return;
    }

    if (address.user_id !== userId) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'You can only remove your own addresses',
      });
      return;
    }

    const deleted = deleteRewardAddress(addressId);

    if (!deleted) {
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to delete address',
      });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting reward address:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete address',
    });
  }
});

/**
 * POST /snapshot
 * Create daily volume snapshots (called by external cron scheduler)
 * Requires CRON_SECRET header for authentication
 */
router.post('/snapshot', async (req: Request, res: Response) => {
  try {
    // Verify cron secret
    const cronSecret = req.headers['x-cron-secret'];
    if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Get campaign ID from request body
    const { campaignId } = req.body;
    if (!campaignId) {
      res.json({ message: 'No campaign specified', processed: 0 });
      return;
    }

    // Create snapshots for today (UTC)
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const processed = createDailySnapshots(campaignId, today);

    res.json({
      message: 'Snapshot complete',
      processed,
      date: today,
      campaignId,
    });
  } catch (error) {
    console.error('Error creating volume snapshots:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create volume snapshots',
    });
  }
});

/**
 * GET /volume
 * Get current user's volume for a campaign
 * Returns snapshot volume + live delta = total volume
 */
router.get('/volume', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const campaignId = req.query.campaignId as string;

    if (!campaignId) {
      res.status(400).json({
        error: 'Validation error',
        message: 'campaignId query parameter is required',
      });
      return;
    }

    const volumeData = getUserTotalVolume(userId, campaignId);

    res.json({
      userId,
      campaignId,
      totalVolume: volumeData.total_volume,
      uniquePayers: volumeData.unique_payers,
      snapshotVolume: volumeData.snapshot_volume,
      liveVolume: volumeData.live_volume,
      lastSnapshotDate: volumeData.last_snapshot_date,
    });
  } catch (error) {
    console.error('Error getting user volume:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get volume data',
    });
  }
});

/**
 * GET /volume/breakdown
 * Get per-address volume breakdown for the current user
 * Returns each tracked address with its individual volume contribution
 */
router.get('/volume/breakdown', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const campaignId = req.query.campaignId as string;

    if (!campaignId) {
      res.status(400).json({
        error: 'Validation error',
        message: 'campaignId query parameter is required',
      });
      return;
    }

    const breakdown = getVolumeBreakdownByUser(userId, campaignId);

    res.json(breakdown);
  } catch (error) {
    console.error('Error getting volume breakdown:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get volume breakdown',
    });
  }
});

/**
 * GET /volume/facilitator/:facilitatorId
 * Get volume for a specific facilitator
 * Returns the volume processed through this facilitator since enrollment
 */
router.get('/volume/facilitator/:facilitatorId', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { facilitatorId } = req.params;
    const campaignId = req.query.campaignId as string;

    if (!campaignId) {
      res.status(400).json({
        error: 'Validation error',
        message: 'campaignId query parameter is required',
      });
      return;
    }

    // Get enrollment date for this user (when they enrolled in rewards)
    const db = getDatabase();
    const enrollmentStmt = db.prepare(`
      SELECT ra.created_at
      FROM reward_addresses ra
      WHERE ra.user_id = ?
        AND ra.verification_status = 'verified'
        AND ra.chain_type = 'facilitator'
      LIMIT 1
    `);
    const enrollment = enrollmentStmt.get(userId) as { created_at: string } | undefined;

    if (!enrollment) {
      res.json({
        facilitatorId,
        campaignId,
        volume: '0',
        uniquePayers: 0,
        enrolled: false,
      });
      return;
    }

    // Import the function dynamically to avoid circular dependency
    const { getVolumeByFacilitator } = await import('../db/volume-aggregation.js');
    const volumeData = getVolumeByFacilitator(facilitatorId, enrollment.created_at);

    res.json({
      facilitatorId,
      campaignId,
      volume: volumeData.volume,
      uniquePayers: volumeData.unique_payers,
      enrolled: true,
      enrolledAt: enrollment.created_at,
    });
  } catch (error) {
    console.error('Error getting facilitator volume:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get facilitator volume',
    });
  }
});

// ============================================================================
// Campaign API Routes
// ============================================================================

// Validation schemas for campaigns
const createCampaignSchema = z.object({
  name: z.string().min(1).max(100),
  pool_amount: z.string().regex(/^\d+$/, 'Must be numeric string'),
  threshold_amount: z.string().regex(/^\d+$/, 'Must be numeric string'),
  multiplier_facilitator: z.number().min(1).max(10).optional(),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
});

const updateCampaignSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  pool_amount: z.string().regex(/^\d+$/, 'Must be numeric string').optional(),
  threshold_amount: z.string().regex(/^\d+$/, 'Must be numeric string').optional(),
  multiplier_facilitator: z.number().min(1).max(10).optional(),
  starts_at: z.string().datetime().optional(),
  ends_at: z.string().datetime().optional(),
});

/**
 * GET /campaigns/active
 * Get current campaign for users (published or active)
 * Public route (authenticated users only)
 */
router.get('/campaigns/active', requireAuth, async (req: Request, res: Response) => {
  try {
    const campaign = getPublishedCampaign();

    if (!campaign) {
      res.json({ campaign: null, totalVolume: '0' });
      return;
    }

    // Calculate total qualifying volume for this campaign (includes live transactions)
    const volumeData = getTotalPoolVolume(campaign.id);

    res.json({
      campaign: {
        ...campaign,
        totalQualifyingVolume: volumeData.total_volume,
        participantCount: volumeData.participant_count,
      },
      totalVolume: volumeData.total_volume,
    });
  } catch (error) {
    console.error('Error getting active campaign:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get active campaign',
    });
  }
});

/**
 * GET /campaigns/history
 * Get user's campaign history with participation data
 * Public route (authenticated users only)
 */
router.get('/campaigns/history', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    // Get all completed campaigns
    const campaigns = getCompletedCampaigns();

    // Get user's claims for context
    const userClaims = getRewardClaimsByUser(userId);
    const claimsByChunk = new Map(
      userClaims.map(c => [c.campaign_id, c])
    );

    // Build history with user stats per campaign
    const history = campaigns.map(campaign => {
      const claim = claimsByChunk.get(campaign.id);
      const volumeData = getUserTotalVolume(userId, campaign.id);

      return {
        campaign: {
          id: campaign.id,
          name: campaign.name,
          pool_amount: campaign.pool_amount,
          threshold_amount: campaign.threshold_amount,
          multiplier_facilitator: campaign.multiplier_facilitator,
          starts_at: campaign.starts_at,
          ends_at: campaign.ends_at,
          distributed_amount: campaign.distributed_amount,
        },
        userStats: {
          volume: volumeData.total_volume,
          uniquePayers: volumeData.unique_payers,
          meetsThreshold: BigInt(volumeData.total_volume) >= BigInt(campaign.threshold_amount),
          claim: claim ? {
            status: claim.status,
            rewardAmount: claim.final_reward_amount,
            multiplier: claim.multiplier,
            claimedAt: claim.claimed_at,
          } : null,
        },
      };
    });

    res.json(history);
  } catch (error) {
    console.error('Error getting campaign history:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get campaign history',
    });
  }
});

/**
 * GET /campaigns/:id/stats
 * Get campaign statistics
 * Public route (authenticated users only)
 */
router.get('/campaigns/:id/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const campaignId = req.params.id;

    const campaign = getCampaignById(campaignId);
    if (!campaign) {
      res.status(404).json({
        error: 'Not found',
        message: 'Campaign not found',
      });
      return;
    }

    const db = getDatabase();

    // Get total qualifying volume and participant count
    const volumeStmt = db.prepare(`
      SELECT
        COALESCE(SUM(CAST(vs.volume AS INTEGER)), 0) as total_volume,
        COUNT(DISTINCT ra.user_id) as participant_count
      FROM volume_snapshots vs
      JOIN reward_addresses ra ON vs.reward_address_id = ra.id
      WHERE vs.campaign_id = ?
    `);
    const volumeData = volumeStmt.get(campaignId) as {
      total_volume: number;
      participant_count: number;
    };

    // Get user's volume and rank
    const userVolume = getUserTotalVolume(userId, campaignId);

    // Calculate user's rank (position among participants)
    const rankStmt = db.prepare(`
      SELECT COUNT(*) + 1 as rank
      FROM (
        SELECT ra.user_id, SUM(CAST(vs.volume AS INTEGER)) as total_vol
        FROM volume_snapshots vs
        JOIN reward_addresses ra ON vs.reward_address_id = ra.id
        WHERE vs.campaign_id = ?
        GROUP BY ra.user_id
        HAVING total_vol > ?
      )
    `);
    const rankData = rankStmt.get(campaignId, userVolume.total_volume) as { rank: number };

    res.json({
      campaignId,
      totalQualifyingVolume: String(volumeData.total_volume),
      participantCount: volumeData.participant_count,
      userVolume: userVolume.total_volume,
      userRank: rankData.rank,
      userMeetsThreshold: BigInt(userVolume.total_volume) >= BigInt(campaign.threshold_amount),
    });
  } catch (error) {
    console.error('Error getting campaign stats:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get campaign stats',
    });
  }
});

// ============================================================================
// Admin Campaign Routes (all require isAdmin check)
// ============================================================================

/**
 * POST /campaigns
 * Create a new draft campaign (Admin only)
 */
router.post('/campaigns', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    // Check admin permission
    if (!isAdmin(userId)) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
      return;
    }

    // Validate request body
    const parseResult = createCampaignSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'Validation error',
        message: parseResult.error.errors[0]?.message || 'Invalid request body',
      });
      return;
    }

    const { name, pool_amount, threshold_amount, multiplier_facilitator, starts_at, ends_at } = parseResult.data;

    // Create campaign with status='draft'
    const campaign = createCampaign({
      name,
      pool_amount,
      threshold_amount,
      multiplier_facilitator,
      starts_at,
      ends_at,
    });

    // Create audit record
    createCampaignAudit({
      campaign_id: campaign.id,
      admin_user_id: userId,
      action: 'create',
      changes: { name, pool_amount, threshold_amount, multiplier_facilitator, starts_at, ends_at },
    });

    res.status(201).json(campaign);
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create campaign',
    });
  }
});

/**
 * GET /campaigns
 * List all campaigns (Admin only - sees all statuses)
 */
router.get('/campaigns', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    // Check admin permission
    if (!isAdmin(userId)) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
      return;
    }

    // Optional status filter
    const statusFilter = req.query.status as CampaignStatus | undefined;

    let campaigns;
    if (statusFilter) {
      campaigns = getCampaignsByStatus(statusFilter);
    } else {
      campaigns = getAllCampaigns();
    }

    res.json(campaigns);
  } catch (error) {
    console.error('Error listing campaigns:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to list campaigns',
    });
  }
});

/**
 * GET /campaigns/:id
 * Get campaign details with audit history (Admin only)
 */
router.get('/campaigns/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const campaignId = req.params.id;

    // Check admin permission
    if (!isAdmin(userId)) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
      return;
    }

    const campaign = getCampaignById(campaignId);
    if (!campaign) {
      res.status(404).json({
        error: 'Not found',
        message: 'Campaign not found',
      });
      return;
    }

    // Get audit history
    const auditHistory = getCampaignAuditHistory(campaignId);

    // Get claims for this campaign
    const claims = getRewardClaimsByCampaign(campaignId);

    res.json({
      ...campaign,
      auditHistory,
      claimsCount: claims.length,
    });
  } catch (error) {
    console.error('Error getting campaign:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get campaign',
    });
  }
});

/**
 * PATCH /campaigns/:id
 * Update campaign (Admin only, with audit logging)
 */
router.patch('/campaigns/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const campaignId = req.params.id;

    // Check admin permission
    if (!isAdmin(userId)) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
      return;
    }

    // Validate request body
    const parseResult = updateCampaignSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'Validation error',
        message: parseResult.error.errors[0]?.message || 'Invalid request body',
      });
      return;
    }

    // Get current campaign for comparison
    const oldCampaign = getCampaignById(campaignId);
    if (!oldCampaign) {
      res.status(404).json({
        error: 'Not found',
        message: 'Campaign not found',
      });
      return;
    }

    const updates = parseResult.data;

    // Build changes object comparing old vs new
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    if (updates.name !== undefined && updates.name !== oldCampaign.name) {
      changes.name = { from: oldCampaign.name, to: updates.name };
    }
    if (updates.pool_amount !== undefined && updates.pool_amount !== oldCampaign.pool_amount) {
      changes.pool_amount = { from: oldCampaign.pool_amount, to: updates.pool_amount };
    }
    if (updates.threshold_amount !== undefined && updates.threshold_amount !== oldCampaign.threshold_amount) {
      changes.threshold_amount = { from: oldCampaign.threshold_amount, to: updates.threshold_amount };
    }
    if (updates.multiplier_facilitator !== undefined && updates.multiplier_facilitator !== oldCampaign.multiplier_facilitator) {
      changes.multiplier_facilitator = { from: oldCampaign.multiplier_facilitator, to: updates.multiplier_facilitator };
    }
    if (updates.starts_at !== undefined && updates.starts_at !== oldCampaign.starts_at) {
      changes.starts_at = { from: oldCampaign.starts_at, to: updates.starts_at };
    }
    if (updates.ends_at !== undefined && updates.ends_at !== oldCampaign.ends_at) {
      changes.ends_at = { from: oldCampaign.ends_at, to: updates.ends_at };
    }

    // Only create audit and update if there are actual changes
    if (Object.keys(changes).length > 0) {
      const updated = updateCampaign(campaignId, updates);
      if (!updated) {
        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to update campaign',
        });
        return;
      }

      // Create audit record
      createCampaignAudit({
        campaign_id: campaignId,
        admin_user_id: userId,
        action: 'update',
        changes,
      });

      res.json(updated);
    } else {
      res.json(oldCampaign);
    }
  } catch (error) {
    console.error('Error updating campaign:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update campaign',
    });
  }
});

/**
 * POST /campaigns/:id/publish
 * Transition campaign from draft -> published (Admin only)
 */
router.post('/campaigns/:id/publish', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const campaignId = req.params.id;

    // Check admin permission
    if (!isAdmin(userId)) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
      return;
    }

    const campaign = getCampaignById(campaignId);
    if (!campaign) {
      res.status(404).json({
        error: 'Not found',
        message: 'Campaign not found',
      });
      return;
    }

    // Verify current status is 'draft'
    if (campaign.status !== 'draft') {
      res.status(400).json({
        error: 'Invalid status',
        message: `Cannot publish campaign with status '${campaign.status}'. Only draft campaigns can be published.`,
      });
      return;
    }

    // Update status to 'published'
    const updated = updateCampaign(campaignId, { status: 'published' });
    if (!updated) {
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to publish campaign',
      });
      return;
    }

    // Create audit record
    createCampaignAudit({
      campaign_id: campaignId,
      admin_user_id: userId,
      action: 'publish',
      changes: { status: { from: 'draft', to: 'published' } },
    });

    res.json(updated);
  } catch (error) {
    console.error('Error publishing campaign:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to publish campaign',
    });
  }
});

/**
 * POST /campaigns/:id/end
 * End campaign early (Admin only)
 */
router.post('/campaigns/:id/end', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const campaignId = req.params.id;

    // Check admin permission
    if (!isAdmin(userId)) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
      return;
    }

    const campaign = getCampaignById(campaignId);
    if (!campaign) {
      res.status(404).json({
        error: 'Not found',
        message: 'Campaign not found',
      });
      return;
    }

    // Verify status is 'active' or 'published'
    if (campaign.status !== 'active' && campaign.status !== 'published') {
      res.status(400).json({
        error: 'Invalid status',
        message: `Cannot end campaign with status '${campaign.status}'. Only active or published campaigns can be ended.`,
      });
      return;
    }

    const previousStatus = campaign.status;

    // Update status to 'ended'
    const updated = updateCampaign(campaignId, { status: 'ended' });
    if (!updated) {
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to end campaign',
      });
      return;
    }

    // Create audit record
    createCampaignAudit({
      campaign_id: campaignId,
      admin_user_id: userId,
      action: 'end',
      changes: { status: { from: previousStatus, to: 'ended' } },
    });

    res.json(updated);
  } catch (error) {
    console.error('Error ending campaign:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to end campaign',
    });
  }
});

/**
 * DELETE /campaigns/:id
 * Delete draft campaign only (Admin only)
 */
router.delete('/campaigns/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const campaignId = req.params.id;

    // Check admin permission
    if (!isAdmin(userId)) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
      return;
    }

    const campaign = getCampaignById(campaignId);
    if (!campaign) {
      res.status(404).json({
        error: 'Not found',
        message: 'Campaign not found',
      });
      return;
    }

    // Verify status is 'draft' (cannot delete published/active/ended)
    if (campaign.status !== 'draft') {
      res.status(400).json({
        error: 'Invalid status',
        message: `Cannot delete campaign with status '${campaign.status}'. Only draft campaigns can be deleted.`,
      });
      return;
    }

    const deleted = deleteCampaign(campaignId);
    if (!deleted) {
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to delete campaign',
      });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting campaign:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete campaign',
    });
  }
});

// ============================================================================
// Claim Routes
// ============================================================================

/**
 * Validate Solana address format (basic check)
 * Base58 characters, 32-44 chars typical for Solana addresses
 */
function isValidSolanaAddress(address: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

// Validation schema for initiate claim
const initiateClaimSchema = z.object({
  claim_wallet: z.string().min(1, 'Claim wallet is required'),
});

/**
 * POST /claims/:id/initiate
 * Initiate and execute a pending claim - atomic operation that:
 * 1. Sets the claim wallet address
 * 2. Executes the SPL token transfer
 * 3. Updates claim status to completed with tx_signature
 *
 * This combines initiate + execute into one atomic operation.
 * User clicks "Confirm Claim" once and receives their tokens.
 */
router.post('/claims/:id/initiate', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const claimId = req.params.id;

    // Validate request body
    const parseResult = initiateClaimSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'Validation error',
        message: parseResult.error.errors[0]?.message || 'Invalid request body',
      });
      return;
    }

    const { claim_wallet } = parseResult.data;

    // Validate Solana address format
    if (!isValidSolanaAddress(claim_wallet)) {
      res.status(400).json({
        error: 'Validation error',
        message: 'Invalid Solana address format',
      });
      return;
    }

    // Get the claim
    const claim = getRewardClaimById(claimId);
    if (!claim) {
      res.status(404).json({
        error: 'Not found',
        message: 'Claim not found',
      });
      return;
    }

    // Verify ownership - claim must belong to authenticated user
    if (claim.user_id !== userId) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'You can only initiate your own claims',
      });
      return;
    }

    // Verify claim status is 'pending'
    if (claim.status !== 'pending') {
      res.status(400).json({
        error: 'Invalid status',
        message: `Cannot initiate claim with status '${claim.status}'. Only pending claims can be initiated.`,
      });
      return;
    }

    // Update claim with wallet address and set status to 'processing'
    const processingClaim = updateRewardClaim(claimId, {
      claim_wallet,
      status: 'processing',
    });

    if (!processingClaim) {
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to update claim',
      });
      return;
    }

    // Execute the SPL token transfer immediately
    const transferResult = await executeRewardTransfer({
      recipientAddress: claim_wallet,
      amount: claim.final_reward_amount,
    });

    if (transferResult.success) {
      // Transfer succeeded - update claim to completed with signature
      const completedClaim = updateRewardClaim(claimId, {
        status: 'completed',
        tx_signature: transferResult.signature!,
        claimed_at: new Date().toISOString(),
      });

      res.json({
        success: true,
        tx_signature: transferResult.signature,
        claim: completedClaim,
      });
    } else {
      // Transfer failed - determine if retryable or permanent failure
      const isPermanent = transferResult.error?.includes('insufficient') ||
                         transferResult.error?.includes('invalid') ||
                         transferResult.error?.includes('Invalid');

      if (isPermanent) {
        // Permanent error - mark as failed
        updateRewardClaim(claimId, { status: 'failed' });
      } else {
        // Transient error - revert to pending for retry
        // Keep claim_wallet so user doesn't have to re-enter
        updateRewardClaim(claimId, { status: 'pending' });
      }

      res.status(500).json({
        success: false,
        error: transferResult.error || 'Transfer failed',
        retryable: !isPermanent,
      });
    }
  } catch (error) {
    console.error('Error initiating claim:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to initiate claim',
    });
  }
});

/**
 * GET /campaigns/:id/eligibility
 * Check if current user is eligible to claim for a campaign
 * Creates claim record if eligible and none exists
 */
router.get('/campaigns/:id/eligibility', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const campaignId = req.params.id;

    // Check eligibility using the service
    const eligibilityResult = checkClaimEligibility(userId, campaignId);

    // If eligible and has calculated reward but no claim yet, create the claim record
    if (eligibilityResult.eligible && eligibilityResult.calculatedReward && !eligibilityResult.claim) {
      const claim = createOrGetClaimRecord(
        userId,
        campaignId,
        eligibilityResult.calculatedReward
      );

      res.json({
        eligible: true,
        claim,
        calculatedReward: eligibilityResult.calculatedReward,
      });
      return;
    }

    // Return eligibility status with claim if exists
    res.json({
      eligible: eligibilityResult.eligible,
      reason: eligibilityResult.reason,
      claim: eligibilityResult.claim || null,
      calculatedReward: eligibilityResult.calculatedReward || null,
    });
  } catch (error) {
    console.error('Error checking claim eligibility:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to check eligibility',
    });
  }
});

/**
 * GET /campaigns/:id/my-claim
 * Get the current user's claim for a specific campaign
 */
router.get('/campaigns/:id/my-claim', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const campaignId = req.params.id;

    const claim = getRewardClaimByUserAndCampaign(userId, campaignId);

    res.json({
      claim: claim || null,
    });
  } catch (error) {
    console.error('Error getting user claim:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get user claim',
    });
  }
});

/**
 * GET /claims/history
 * Get current user's claim history across all campaigns
 */
router.get('/claims/history', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const claims = getRewardClaimsByUser(userId);

    // Enrich with campaign info
    const enrichedClaims = claims.map(claim => {
      const campaign = getCampaignById(claim.campaign_id);
      return {
        ...claim,
        campaign_name: campaign?.name ?? 'Unknown Campaign',
      };
    });

    res.json({ claims: enrichedClaims });
  } catch (error) {
    console.error('Error getting claim history:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get claim history',
    });
  }
});

export const rewardsRouter = router;
