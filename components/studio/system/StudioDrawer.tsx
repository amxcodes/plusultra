import React from 'react';
import { Drawer } from 'vaul';
import { X } from 'lucide-react';
import { cn } from '../../../lib/utils';

export const StudioDrawerRoot = Drawer.Root;
export const StudioDrawerTrigger = Drawer.Trigger;
export const StudioDrawerClose = Drawer.Close;

export const StudioDrawerContent: React.FC<React.ComponentProps<typeof Drawer.Content>> = ({ className, children, ...props }) => (
  <Drawer.Portal>
    <Drawer.Overlay className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm" />
    <Drawer.Content
      className={cn(
        'fixed bottom-0 left-0 right-0 z-[90] mx-auto flex max-h-[92dvh] max-w-[1180px] flex-col overflow-hidden rounded-t-[28px] border border-b-0 border-white/10 bg-black shadow-[0_-24px_80px_rgba(0,0,0,0.7)] outline-none md:rounded-t-[32px]',
        className
      )}
      {...props}
    >
      <div className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-white/20 md:hidden" />
      {children}
    </Drawer.Content>
  </Drawer.Portal>
);

export const StudioDrawerHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div className={cn('flex items-start justify-between gap-4 p-4 md:p-6', className)} {...props} />
);

export const StudioDrawerTitle = Drawer.Title;
export const StudioDrawerDescription = Drawer.Description;

export const StudioDrawerX: React.FC<{ className?: string }> = ({ className }) => (
  <Drawer.Close
    className={cn(
      'absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/45 text-white/70 backdrop-blur-md transition-colors hover:bg-white/10 hover:text-white',
      className
    )}
    aria-label="Close"
  >
    <X size={16} />
  </Drawer.Close>
);
