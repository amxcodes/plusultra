import React from 'react';
import { cn } from '../../../lib/utils';

interface StudioBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
}

const toneClass: Record<NonNullable<StudioBadgeProps['tone']>, string> = {
  neutral: 'border-white/12 bg-black/62 text-white/86 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]',
  accent: 'border-white/14 bg-black/68 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]',
  success: 'border-emerald-400/25 bg-emerald-500/12 text-emerald-200',
  warning: 'border-amber-300/25 bg-amber-400/12 text-amber-100',
  danger: 'border-red-400/25 bg-red-500/12 text-red-100',
};

export const StudioBadge: React.FC<StudioBadgeProps> = ({ className, tone = 'neutral', ...props }) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none backdrop-blur-sm',
      'max-w-full whitespace-nowrap',
      toneClass[tone],
      className
    )}
    {...props}
  />
);
