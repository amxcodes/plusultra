import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold tracking-normal transition-[background-color,border-color,color,box-shadow,transform,filter] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--studio-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97]',
  {
    variants: {
      variant: {
        primary: 'studio-button-glass studio-button-glass--emphasis text-white hover:text-white',
        glass: 'studio-button-glass text-white hover:text-white',
        ghost: 'studio-button-glass studio-button-glass--quiet text-white/76 hover:text-white',
        subtle: 'studio-button-glass studio-button-glass--quiet text-white/82 hover:text-white',
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
