import React from 'react';
import { cn } from '../../../lib/utils';

interface StudioBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
}

const toneClass: Record<NonNullable<StudioBadgeProps['tone']>, string> = {
  neutral: 'border-white/12 bg-black/35 text-white/80',
  accent: 'border-[var(--studio-accent)]/35 bg-[var(--studio-accent-soft)] text-white',
  success: 'border-emerald-400/25 bg-emerald-500/12 text-emerald-200',
  warning: 'border-amber-300/25 bg-amber-400/12 text-amber-100',
  danger: 'border-red-400/25 bg-red-500/12 text-red-100',
};

export const StudioBadge: React.FC<StudioBadgeProps> = ({ className, tone = 'neutral', ...props }) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none backdrop-blur-sm',
      toneClass[tone],
      className
    )}
    {...props}
  />
);
