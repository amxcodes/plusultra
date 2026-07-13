import React from 'react';
import { cn } from '../../../lib/utils';

export const StudioSkeleton: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div
    className={cn('animate-pulse rounded-[var(--studio-radius-md)] bg-white/[0.065]', className)}
    {...props}
  />
);
