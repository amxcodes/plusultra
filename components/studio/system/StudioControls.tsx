import React from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Select from '@radix-ui/react-select';
import * as Switch from '@radix-ui/react-switch';
import * as Tabs from '@radix-ui/react-tabs';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '../../../lib/utils';

export const StudioTabsRoot = Tabs.Root;
export const StudioTabsContent = Tabs.Content;

export const StudioTabsList = React.forwardRef<
  React.ElementRef<typeof Tabs.List>,
  React.ComponentPropsWithoutRef<typeof Tabs.List>
>(({ className, ...props }, ref) => (
  <Tabs.List
    ref={ref}
    className={cn('studio-glass inline-flex rounded-full p-1', className)}
    {...props}
  />
));
StudioTabsList.displayName = 'StudioTabsList';

export const StudioTabsTrigger = React.forwardRef<
  React.ElementRef<typeof Tabs.Trigger>,
  React.ComponentPropsWithoutRef<typeof Tabs.Trigger>
>(({ className, ...props }, ref) => (
  <Tabs.Trigger
    ref={ref}
    className={cn(
      'rounded-full px-4 py-2 text-xs font-semibold text-white/55 transition-colors data-[state=active]:bg-white data-[state=active]:text-black',
      className
    )}
    {...props}
  />
));
StudioTabsTrigger.displayName = 'StudioTabsTrigger';

export const StudioSwitch = React.forwardRef<
  React.ElementRef<typeof Switch.Root>,
  React.ComponentPropsWithoutRef<typeof Switch.Root>
>(({ className, ...props }, ref) => (
  <Switch.Root
    ref={ref}
    className={cn(
      'relative h-6 w-11 rounded-full border border-white/10 bg-white/10 transition-colors data-[state=checked]:bg-[var(--studio-accent)]',
      className
    )}
    {...props}
  >
    <Switch.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-5" />
  </Switch.Root>
));
StudioSwitch.displayName = 'StudioSwitch';

export const StudioSelectRoot = Select.Root;
export const StudioSelectValue = Select.Value;

export const StudioSelectTrigger = React.forwardRef<
  React.ElementRef<typeof Select.Trigger>,
  React.ComponentPropsWithoutRef<typeof Select.Trigger>
>(({ className, children, ...props }, ref) => (
  <Select.Trigger
    ref={ref}
    className={cn(
      'inline-flex h-10 min-w-[150px] items-center justify-between gap-2 rounded-full border border-white/10 bg-white/6 px-4 text-sm font-medium text-white outline-none transition-colors hover:bg-white/10 focus:ring-2 focus:ring-[var(--studio-accent)]',
      className
    )}
    {...props}
  >
    {children}
    <Select.Icon asChild>
      <ChevronDown size={14} />
    </Select.Icon>
  </Select.Trigger>
));
StudioSelectTrigger.displayName = 'StudioSelectTrigger';

export const StudioSelectContent = React.forwardRef<
  React.ElementRef<typeof Select.Content>,
  React.ComponentPropsWithoutRef<typeof Select.Content>
>(({ className, children, ...props }, ref) => (
  <Select.Portal>
    <Select.Content
      ref={ref}
      className={cn('z-[120] overflow-hidden rounded-[20px] border border-white/10 bg-[#111216] p-1 text-white shadow-[var(--studio-shadow)]', className)}
      {...props}
    >
      <Select.Viewport>{children}</Select.Viewport>
    </Select.Content>
  </Select.Portal>
));
StudioSelectContent.displayName = 'StudioSelectContent';

export const StudioSelectItem = React.forwardRef<
  React.ElementRef<typeof Select.Item>,
  React.ComponentPropsWithoutRef<typeof Select.Item>
>(({ className, children, ...props }, ref) => (
  <Select.Item
    ref={ref}
    className={cn('relative flex cursor-pointer select-none items-center rounded-2xl px-3 py-2 text-sm text-white/75 outline-none data-[highlighted]:bg-white/10 data-[highlighted]:text-white', className)}
    {...props}
  >
    <Select.ItemText>{children}</Select.ItemText>
    <Select.ItemIndicator className="ml-auto">
      <Check size={14} />
    </Select.ItemIndicator>
  </Select.Item>
));
StudioSelectItem.displayName = 'StudioSelectItem';

export const StudioDropdownRoot = DropdownMenu.Root;
export const StudioDropdownTrigger = DropdownMenu.Trigger;

export const StudioDropdownContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenu.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenu.Content>
>(({ className, ...props }, ref) => (
  <DropdownMenu.Portal>
    <DropdownMenu.Content
      ref={ref}
      align="end"
      sideOffset={10}
      className={cn('z-[120] min-w-[230px] rounded-[24px] border border-white/10 bg-[#111216] p-2 text-white shadow-[var(--studio-shadow)]', className)}
      {...props}
    />
  </DropdownMenu.Portal>
));
StudioDropdownContent.displayName = 'StudioDropdownContent';

export const StudioDropdownItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenu.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenu.Item>
>(({ className, ...props }, ref) => (
  <DropdownMenu.Item
    ref={ref}
    className={cn('flex cursor-pointer items-center gap-2 rounded-[18px] px-3 py-2 text-sm text-white/72 outline-none transition-colors data-[highlighted]:bg-white/10 data-[highlighted]:text-white', className)}
    {...props}
  />
));
StudioDropdownItem.displayName = 'StudioDropdownItem';

export const StudioTooltipProvider = Tooltip.Provider;
export const StudioTooltipRoot = Tooltip.Root;
export const StudioTooltipTrigger = Tooltip.Trigger;

export const StudioTooltipContent = React.forwardRef<
  React.ElementRef<typeof Tooltip.Content>,
  React.ComponentPropsWithoutRef<typeof Tooltip.Content>
>(({ className, ...props }, ref) => (
  <Tooltip.Portal>
    <Tooltip.Content
      ref={ref}
      sideOffset={8}
      className={cn('z-[130] rounded-full border border-white/10 bg-[#111216] px-3 py-1.5 text-xs font-medium text-white shadow-xl', className)}
      {...props}
    />
  </Tooltip.Portal>
));
StudioTooltipContent.displayName = 'StudioTooltipContent';
