/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Privy authentication hook
 */

import { useMemo } from 'react';
import { isPrivyConfigured } from '@/providers/PrivyProvider';

export interface UserProfile {
  id: string;
  email?: string;
  wallet?: string;
  name?: string | null;
  avatar?: string;
  createdAt: Date;
  linkedAccounts: {
    type: string;
    address?: string;
    email?: string;
    username?: string | null;
  }[];
}

// Default empty auth state when Privy is not configured
const emptyAuthState = {
  ready: true,
  isAuthenticated: false,
  user: null,
  profile: null,
  wallets: [],
  primaryWallet: null,
  login: () => {},
  logout: () => {},
  linkEmail: () => {},
  linkWallet: () => {},
  linkGoogle: () => {},
  linkGithub: () => {},
  linkTwitter: () => {},
  unlinkEmail: () => {},
  unlinkWallet: () => {},
};

export function useAuth() {
  // If Privy is not configured, return empty state
  if (!isPrivyConfigured) {
    return emptyAuthState;
  }

  // Dynamic import of Privy hooks - they're only available when configured
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { usePrivy, useWallets } = require('@privy-io/react-auth');
  
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { 
    ready, 
    authenticated, 
    user, 
    login, 
    logout,
    linkEmail,
    linkWallet,
    linkGoogle,
    linkGithub,
    linkTwitter,
    unlinkEmail,
    unlinkWallet,
  } = usePrivy();
  
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { wallets } = useWallets();

  // Get primary wallet
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const primaryWallet = useMemo(() => {
    return wallets.find((w: any) => w.walletClientType === 'privy') || wallets[0];
  }, [wallets]);

  // Build user profile from Privy user
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const profile: UserProfile | null = useMemo(() => {
    if (!user) return null;

    const linkedAccounts = [];
    
    // Email
    if (user.email) {
      linkedAccounts.push({
        type: 'email',
        email: user.email.address,
      });
    }
    
    // Wallets
    for (const wallet of user.linkedAccounts.filter((a: any) => a.type === 'wallet')) {
      linkedAccounts.push({
        type: 'wallet',
        address: (wallet as any).address,
      });
    }
    
    // Google
    if (user.google) {
      linkedAccounts.push({
        type: 'google',
        email: user.google.email,
        username: user.google.name,
      });
    }
    
    // GitHub
    if (user.github) {
      linkedAccounts.push({
        type: 'github',
        username: user.github.username,
      });
    }
    
    // Twitter
    if (user.twitter) {
      linkedAccounts.push({
        type: 'twitter',
        username: user.twitter.username,
      });
    }

    return {
      id: user.id,
      email: user.email?.address,
      wallet: user.wallet?.address,
      name: user.google?.name || user.twitter?.name || user.github?.username,
      avatar: (user.google as any)?.picture || user.twitter?.profilePictureUrl,
      createdAt: new Date(user.createdAt),
      linkedAccounts,
    };
  }, [user]);

  return {
    // State
    ready,
    isAuthenticated: authenticated,
    user,
    profile,
    wallets,
    primaryWallet,
    
    // Actions
    login,
    logout,
    
    // Link accounts
    linkEmail,
    linkWallet,
    linkGoogle,
    linkGithub,
    linkTwitter,
    
    // Unlink accounts
    unlinkEmail,
    unlinkWallet,
  };
}

export default useAuth;
