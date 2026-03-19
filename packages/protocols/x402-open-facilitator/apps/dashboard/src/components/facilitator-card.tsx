'use client';

import { useState } from 'react';
import { formatDate } from '@/lib/utils';
import type { Facilitator } from '@/lib/api';

interface FacilitatorCardProps {
  facilitator: Facilitator;
  onManageClick?: () => void;
}

function FaviconImage({ url, favicon }: { url: string; favicon?: string | null }) {
  const [hasError, setHasError] = useState(false);

  // If we have a stored favicon from the API, use it directly
  if (favicon) {
    return (
      <img
        src={favicon}
        alt=""
        className="w-8 h-8 rounded shrink-0"
      />
    );
  }

  // Fallback: try to load from the facilitator's live URL
  if (!hasError) {
    return (
      <img
        src={`${url}/favicon.ico`}
        alt=""
        className="w-8 h-8 rounded shrink-0"
        onError={() => setHasError(true)}
      />
    );
  }

  // Final fallback: show default OpenFacilitator icon
  return (
    <img
      src="/icon.svg"
      alt=""
      className="w-8 h-8 rounded shrink-0"
    />
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toFixed(2);
}

export function FacilitatorCard({ facilitator, onManageClick }: FacilitatorCardProps) {
  const domain = facilitator.customDomain || facilitator.subdomain;
  const url = facilitator.url;
  const networksConfigured = facilitator.supportedChains.length;
  const totalSettled = parseFloat(facilitator.stats?.totalSettled || '0');

  const handleCardClick = () => {
    onManageClick?.();
  };

  return (
    <div
      onClick={handleCardClick}
      className="
        border border-border rounded-lg p-5 bg-card
        flex flex-col h-full
        cursor-pointer
        transition-all duration-150
        hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 hover:scale-[1.02]
        active:scale-[0.98]
      "
    >
      {/* Content - grows to fill space */}
      <div className="flex-1">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          {/* Favicon */}
          <FaviconImage url={url} favicon={facilitator.favicon} />

          {/* Domain */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate">{domain}</h3>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
          <span>{networksConfigured} chain{networksConfigured !== 1 ? 's' : ''}</span>
          <span>·</span>
          <span>${formatNumber(totalSettled)} settled</span>
        </div>
      </div>

      {/* Footer - pinned to bottom */}
      <div className="flex items-center justify-between mt-auto pt-4 border-t border-border">
        <span className="text-xs text-muted-foreground">
          Created {formatDate(facilitator.createdAt)}
        </span>
        <span className="text-xs font-medium text-primary">
          Manage →
        </span>
      </div>
    </div>
  );
}
