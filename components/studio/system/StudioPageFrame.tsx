import React from 'react';
import { cn } from '../../../lib/utils';

interface StudioPageFrameProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}

export const StudioPageFrame: React.FC<StudioPageFrameProps> = ({ title, subtitle, children, className, actions }) => (
  <section className={cn('mx-auto w-full max-w-[1500px] px-4 pt-24 md:px-8 md:pt-28', className)}>
    {(title || subtitle || actions) && (
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          {subtitle && <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--studio-subtle)]">{subtitle}</div>}
          {title && <h1 className="text-3xl font-semibold tracking-tight text-white md:text-5xl">{title}</h1>}
        </div>
        {actions}
      </div>
    )}
    {children}
  </section>
);
