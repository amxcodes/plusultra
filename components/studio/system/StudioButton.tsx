import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-[background-color,border-color,color,transform,filter] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--studio-accent)] disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        primary: 'border border-white/80 bg-white text-black shadow-[0_10px_28px_rgba(255,255,255,0.13)] hover:bg-zinc-200',
        glass: 'studio-glass text-white hover:border-white/20 hover:bg-white/10',
        ghost: 'border border-transparent text-white/70 hover:bg-white/8 hover:text-white',
        subtle: 'border border-white/8 bg-white/6 text-white hover:border-white/14 hover:bg-white/10',
        danger: 'border border-red-400/20 bg-red-500/10 text-red-200 hover:bg-red-500/18',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4',
        lg: 'h-12 px-6 text-base',
        icon: 'h-10 w-10 p-0',
      },
    },
    defaultVariants: {
      variant: 'glass',
      size: 'md',
    },
  }
);

export interface StudioButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const StudioButton = React.forwardRef<HTMLButtonElement, StudioButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
);

StudioButton.displayName = 'StudioButton';

export const studioButtonVariants = buttonVariants;
