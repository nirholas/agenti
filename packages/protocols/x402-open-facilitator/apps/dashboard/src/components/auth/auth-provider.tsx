'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { useSession, signOut as authSignOut } from '@/lib/auth-client';
import { api, type RewardsStatus } from '@/lib/api';

interface User {
  id: string;
  email: string;
  name?: string;
  emailVerified: boolean;
  createdAt: Date;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isEnrolled: boolean;
  isFacilitatorOwner: boolean;
  hasClaimable: boolean;
  signOut: () => Promise<void>;
  refetchRewardsStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  isAdmin: false,
  isEnrolled: false,
  isFacilitatorOwner: false,
  hasClaimable: false,
  signOut: async () => {},
  refetchRewardsStatus: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending } = useSession();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [rewardsStatus, setRewardsStatus] = useState<RewardsStatus | null>(null);
  const [rewardsChecked, setRewardsChecked] = useState(false);
  const [hasClaimable, setHasClaimable] = useState(false);

  const fetchRewardsStatus = useCallback(async () => {
    if (!session?.user) return;

    try {
      const status = await api.getRewardsStatus();
      setRewardsStatus(status);

      // Check for claimable rewards if user is enrolled
      if (status.isEnrolled || status.isFacilitatorOwner) {
        try {
          const { campaign } = await api.getActiveCampaign();
          // Check if there's an ended campaign with claimable rewards
          if (campaign && campaign.status === 'ended') {
            const eligibility = await api.getClaimEligibility(campaign.id);
            // Has claimable if eligible and claim is pending (or null - not yet created)
            setHasClaimable(
              eligibility.eligible &&
              (!eligibility.claim || eligibility.claim.status === 'pending')
            );
          } else {
            setHasClaimable(false);
          }
        } catch {
          // Silently fail claim check - not critical
          setHasClaimable(false);
        }
      } else {
        setHasClaimable(false);
      }
    } catch (error) {
      // Log error but don't crash - rewards status is supplementary
      console.error('Failed to fetch rewards status:', error);
      setRewardsStatus(null);
      setHasClaimable(false);
    } finally {
      setRewardsChecked(true);
    }
  }, [session?.user]);

  // Fetch rewards status when authenticated
  useEffect(() => {
    if (session?.user && !isSigningOut) {
      fetchRewardsStatus();
    } else {
      // Clear rewards status when signed out
      setRewardsStatus(null);
      setRewardsChecked(false);
      setHasClaimable(false);
    }
  }, [session?.user, isSigningOut, fetchRewardsStatus]);

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      await authSignOut();
      window.location.href = '/';
    } finally {
      setIsSigningOut(false);
    }
  };

  const isAuthenticated = !!session?.user;

  return (
    <AuthContext.Provider
      value={{
        user: session?.user || null,
        isLoading: isPending || isSigningOut || (isAuthenticated && !rewardsChecked),
        isAuthenticated,
        isAdmin: rewardsStatus?.isAdmin ?? false,
        isEnrolled: rewardsStatus?.isEnrolled ?? false,
        isFacilitatorOwner: rewardsStatus?.isFacilitatorOwner ?? false,
        hasClaimable,
        signOut: handleSignOut,
        refetchRewardsStatus: fetchRewardsStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
