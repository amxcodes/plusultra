import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold tracking-normal transition-[background-color,border-color,color,box-shadow,transform,filter] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--studio-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97]',
  {
    variants: {
      variant: {
        primary: 'border border-white/85 bg-white text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_12px_34px_rgba(255,255,255,0.16)] hover:bg-zinc-100 hover:shadow-[inset_0_1px_0_rgba(255,255,255,1),0_14px_42px_rgba(255,255,255,0.20)]',
        glass: 'studio-control-glass text-white hover:border-white/24 hover:bg-white/[0.14] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_14px_36px_rgba(0,0,0,0.36)]',
        ghost: 'border border-transparent text-white/70 hover:bg-white/[0.075] hover:text-white',
        subtle: 'border border-white/10 bg-white/[0.075] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:border-white/18 hover:bg-white/[0.12]',
        danger: 'border border-red-400/22 bg-red-500/10 text-red-100 hover:bg-red-500/18 hover:border-red-300/30',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4',
        lg: 'h-11 px-5 text-[15px]',
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
