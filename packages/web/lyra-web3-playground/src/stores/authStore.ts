/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 From concept to creation, you're crushing it 💥
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, UserProfile } from '@/lib/supabase';
import { User, Session } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  isLoading: boolean;
  isInitialized: boolean;
  
  // Actions
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, username?: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  signInWithProvider: (provider: 'github' | 'google') => Promise<{ error?: string }>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error?: string }>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      profile: null,
      session: null,
      isLoading: false,
      isInitialized: false,

      initialize: async () => {
        try {
          // Get current session
          const { data: { session } } = await supabase.auth.getSession();
          
          if (session) {
            set({ 
              user: session.user, 
              session,
              isInitialized: true 
            });
            
            // Fetch user profile
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();
            
            if (profile) {
              set({ profile });
            }
          } else {
            set({ isInitialized: true });
          }

          // Listen for auth changes
          supabase.auth.onAuthStateChange(async (_event, session) => {
            if (session) {
              set({ user: session.user, session });
              
              // Fetch profile on auth change
              const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();
              
              if (profile) {
                set({ profile });
              }
            } else {
              set({ user: null, profile: null, session: null });
            }
          });
        } catch (error) {
          console.error('Error initializing auth:', error);
          set({ isInitialized: true });
        }
      },

      signIn: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (error) throw error;

          set({ 
            user: data.user, 
            session: data.session,
            isLoading: false 
          });
          
          return {};
        } catch (error: any) {
          set({ isLoading: false });
          return { error: error.message || 'Failed to sign in' };
        }
      },

      signUp: async (email: string, password: string, username?: string) => {
        set({ isLoading: true });
        try {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                username,
              },
            },
          });

          if (error) throw error;

          set({ 
            user: data.user,
            session: data.session,
            isLoading: false 
          });
          
          return {};
        } catch (error: any) {
          set({ isLoading: false });
          return { error: error.message || 'Failed to sign up' };
        }
      },

      signOut: async () => {
        set({ isLoading: true });
        try {
          await supabase.auth.signOut();
          set({ 
            user: null, 
            profile: null, 
            session: null,
            isLoading: false 
          });
        } catch (error) {
          console.error('Error signing out:', error);
          set({ isLoading: false });
        }
      },

      signInWithProvider: async (provider: 'github' | 'google') => {
        set({ isLoading: true });
        try {
          const { error } = await supabase.auth.signInWithOAuth({
            provider,
            options: {
              redirectTo: window.location.origin,
            },
          });

          if (error) throw error;
          
          set({ isLoading: false });
          return {};
        } catch (error: any) {
          set({ isLoading: false });
          return { error: error.message || `Failed to sign in with ${provider}` };
        }
      },

      updateProfile: async (updates: Partial<UserProfile>) => {
        const { user } = get();
        if (!user) return { error: 'Not authenticated' };

        set({ isLoading: true });
        try {
          const { error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', user.id);

          if (error) throw error;

          // Update local profile state
          set((state) => ({
            profile: state.profile ? { ...state.profile, ...updates } : null,
            isLoading: false,
          }));
          
          return {};
        } catch (error: any) {
          set({ isLoading: false });
          return { error: error.message || 'Failed to update profile' };
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        // Only persist session info, not the full user object
        session: state.session,
      }),
    }
  )
);
