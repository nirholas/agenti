/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Building the future, one commit at a time 🌟
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Initialize Supabase client (only if configured)
const createSupabaseClient = (): SupabaseClient => {
  if (supabaseUrl && supabaseAnonKey) {
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  }
  
  // Return a mock client that logs warnings when Supabase is not configured
  console.warn('[Supabase] Not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.');
  
  // Create a minimal mock that won't make network requests to placeholder URLs
  const mockClient = createClient('https://localhost.invalid', 'not-configured', {
    auth: { 
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      fetch: () => Promise.reject(new Error('Supabase is not configured. Please set environment variables.')),
    },
  });
  
  return mockClient;
};

export const supabase: SupabaseClient = createSupabaseClient();

// Check if Supabase is properly configured
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Database types
export interface Project {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  code: string;
  language: string;
  category: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  share_token?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  username: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}
