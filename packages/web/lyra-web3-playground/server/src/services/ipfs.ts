/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Keep shining, keep coding 🌞
 */

import pinataSDK from '@pinata/sdk';
import { AppError } from '../middleware/errorHandler.js';

const pinata = (process.env.PINATA_API_KEY && process.env.PINATA_SECRET_KEY)
  ? new pinataSDK(process.env.PINATA_API_KEY, process.env.PINATA_SECRET_KEY)
  : null;

interface UploadOptions {
  content: string | Buffer;
  name: string;
  metadata?: Record<string, any>;
}

interface UploadResult {
  cid: string;
  url: string;
  gateway: string;
}

export async function uploadToIPFS(options: UploadOptions): Promise<UploadResult> {
  if (!pinata) {
    throw new AppError('IPFS service not configured. Please add PINATA_API_KEY and PINATA_SECRET_KEY.', 503);
  }

  try {
    const { content, name, metadata } = options;

    // Upload to IPFS
    const result = await pinata.pinJSONToIPFS({
      content: typeof content === 'string' ? content : content.toString(),
      metadata
    }, {
      pinataMetadata: {
        name
      }
    });

    const cid = result.IpfsHash;

    return {
      cid,
      url: `ipfs://${cid}`,
      gateway: `https://gateway.pinata.cloud/ipfs/${cid}`
    };
  } catch (error: any) {
    throw new AppError(`IPFS upload failed: ${error.message}`, 500);
  }
}

export async function pinFile(cid: string, name?: string): Promise<{ success: boolean; message: string }> {
  if (!pinata) {
    throw new AppError('IPFS service not configured. Please add PINATA_API_KEY and PINATA_SECRET_KEY.', 503);
  }

  try {
    await pinata.pinByHash(cid, {
      pinataMetadata: {
        name: name || `pinned-${cid}`
      }
    });

    return {
      success: true,
      message: `Successfully pinned ${cid}`
    };
  } catch (error: any) {
    throw new AppError(`IPFS pinning failed: ${error.message}`, 500);
  }
}

export async function getPinnedFiles(): Promise<any[]> {
  if (!pinata) {
    throw new AppError('IPFS service not configured', 503);
  }

  try {
    const result = await pinata.pinList({
      status: 'pinned',
      pageLimit: 100
    });

    return result.rows;
  } catch (error: any) {
    throw new AppError(`Failed to get pinned files: ${error.message}`, 500);
  }
}
