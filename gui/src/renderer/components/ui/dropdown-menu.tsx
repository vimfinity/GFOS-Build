import { Menu } from '@base-ui-components/react/menu';
import { cn } from '@/lib/utils';
import { forwardRef, type ComponentPropsWithoutRef } from 'react';

/* ── Root ── */
const DropdownMenu = Menu.Root;

/* ── Trigger ── */
const DropdownMenuTrigger = Menu.Trigger;

/* ── Content ── */
const DropdownMenuContent = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof Menu.Popup> & { sideOffset?: number; side?: 'top' | 'bottom' | 'left' | 'right' }
>(({ className, sideOffset = 4, side = 'bottom', children, ...props }, ref) => (
  <Menu.Portal>
    <Menu.Positioner side={side} sideOffset={sideOffset}>
      <Menu.Popup
        ref={ref}
        className={cn(
          'z-50 min-w-[8rem] overflow-hidden rounded-md border border-border p-1 shadow-lg',
          'bg-popover text-popover-foreground',
          'backdrop-blur-[var(--backdrop-blur-popover)]',
          'animate-in fade-in-0 zoom-in-95 data-[ending-style]:animate-out data-[ending-style]:fade-out-0 data-[ending-style]:zoom-out-95',
          className,
        )}
        {...props}
      >
        {children}
      </Menu.Popup>
    </Menu.Positioner>
  </Menu.Portal>
));
DropdownMenuContent.displayName = 'DropdownMenuContent';

/* ── Item ── */
const DropdownMenuItem = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof Menu.Item>
>(({ className, ...props }, ref) => (
  <Menu.Item
    ref={ref}
    className={cn(
      'relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none',
      'transition-colors data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className,
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = 'DropdownMenuItem';

/* ── Separator ── */
function DropdownMenuSeparator({ className }: { className?: string }) {
  return (
    <Menu.Separator className={cn('-mx-1 my-1 h-px bg-border', className)} />
  );
}

/* ── Label ── */
function DropdownMenuLabel({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('px-2 py-1.5 text-xs font-semibold text-muted-foreground', className)}>
      {children}
    </div>
  );
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
};
