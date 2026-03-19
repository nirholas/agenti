import { createAuthClient } from 'better-auth/react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002';

export const authClient = createAuthClient({
  baseURL: API_BASE,
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
} = authClient;

