/**
 * App Providers - Client-side context providers
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import { ReactNode } from 'react';
import { PlaygroundProvider } from '@/lib/playground-store';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <PlaygroundProvider>
      {children}
    </PlaygroundProvider>
  );
}
