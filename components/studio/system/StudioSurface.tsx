import React from 'react';
import { cn } from '../../../lib/utils';

interface StudioSurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  glass?: boolean;
  elevated?: boolean;
}

export const StudioSurface = React.forwardRef<HTMLDivElement, StudioSurfaceProps>(
  ({ className, glass, elevated, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-[var(--studio-radius-lg)] border border-[var(--studio-border)]',
        glass ? 'studio-glass' : 'bg-[var(--studio-surface)]',
        elevated && 'shadow-[var(--studio-shadow)]',
        className
      )}
      {...props}
    />
  )
);

StudioSurface.displayName = 'StudioSurface';
