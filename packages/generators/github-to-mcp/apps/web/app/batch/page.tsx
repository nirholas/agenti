/**
 * Batch Convert Page - Convert multiple repositories to MCP servers
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

import { Suspense } from 'react';
import { Metadata } from 'next';
import BatchConvertClient from './BatchConvertClient';

export const metadata: Metadata = {
  title: 'Batch Convert | GitHub to MCP',
  description: 'Convert multiple GitHub repositories to MCP servers simultaneously',
  openGraph: {
    title: 'Batch Convert | GitHub to MCP',
    description: 'Convert multiple GitHub repositories to MCP servers simultaneously',
  },
};

export default function BatchConvertPage() {
  return (
    <Suspense fallback={<BatchConvertLoading />}>
      <BatchConvertClient />
    </Suspense>
  );
}

function BatchConvertLoading() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
        <p className="text-neutral-400">Loading batch converter...</p>
      </div>
    </div>
  );
}
