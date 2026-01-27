/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Trust the process, enjoy the journey 🎢
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ThemeState {
  mode: 'light' | 'dark';
  toggleTheme: () => void;
  setTheme: (mode: 'light' | 'dark') => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'dark',
      toggleTheme: () =>
        set((state) => ({
          mode: state.mode === 'light' ? 'dark' : 'light',
        })),
      setTheme: (mode) => set({ mode }),
    }),
    {
      name: 'theme-storage',
    }
  )
);

// Apply theme to document
if (typeof window !== 'undefined') {
  useThemeStore.subscribe((state) => {
    if (state.mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  });

  // Initialize theme on load
  const theme = useThemeStore.getState().mode;
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  }
}
