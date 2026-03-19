'use client';

import { type ReactNode } from 'react';
import Link from 'next/link';

interface FeatureCardProps {
  icon: ReactNode;
  headline: string;
  description: string;
  ctaText: string;
  ctaHref?: string;
  onClick?: () => void;
  badge?: string;
}

export function FeatureCard({
  icon,
  headline,
  description,
  ctaText,
  ctaHref,
  onClick,
  badge,
}: FeatureCardProps) {
  const content = (
    <>
      {/* Badge */}
      {badge && (
        <div className="absolute top-4 right-4">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
            {badge}
          </span>
        </div>
      )}

      {/* Icon */}
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
        {icon}
      </div>

      {/* Headline */}
      <h3 className="font-semibold text-foreground mt-4">{headline}</h3>

      {/* Description */}
      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
        {description}
      </p>

      {/* CTA */}
      <span className="text-sm font-medium text-primary mt-4 inline-block">
        {ctaText}
      </span>
    </>
  );

  const baseClasses = `
    relative
    border border-border rounded-xl p-6 bg-card
    flex flex-col min-w-[280px] flex-1
    cursor-pointer
    transition-all duration-150
    hover:border-primary/50 hover:bg-muted/30 hover:scale-[1.02]
    active:scale-[0.98]
    focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background
  `;

  if (ctaHref) {
    return (
      <Link href={ctaHref} className={baseClasses}>
        {content}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={`${baseClasses} text-left`}>
      {content}
    </button>
  );
}
