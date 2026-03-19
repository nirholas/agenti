// Re-export types from central API types
export type {
  Claim,
  ClaimStats,
} from '@/lib/api';

// Component-specific types (not in api.ts)
export interface RefundWallet {
  network: string;
  address: string;
  balance: string;
  createdAt: string;
}

export interface RegisteredServer {
  id: string;
  url: string;
  name: string | null;
  active: boolean;
  createdAt: string;
}

export interface ResourceOwner {
  id: string;
  facilitatorId: string;
  userId: string;
  refundAddress: string | null;
  name: string | null;
  createdAt: string;
}
