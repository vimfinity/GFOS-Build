import { Tooltip as BaseTooltip } from '@base-ui-components/react/tooltip';
import { cn } from '@/lib/utils';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  className?: string;
}

export function Tooltip({ content, children, side = 'right', delay = 300, className }: TooltipProps) {
  return (
    <BaseTooltip.Provider delay={delay}>
      <BaseTooltip.Root>
        <BaseTooltip.Trigger render={children as React.ReactElement<Record<string, unknown>>} />
        <BaseTooltip.Portal>
          <BaseTooltip.Positioner side={side} sideOffset={8}>
            <BaseTooltip.Popup
              className={cn(
                'z-50 rounded-md px-2.5 py-1.5 text-xs font-medium shadow-lg',
                'bg-popover text-popover-foreground border border-border',
                'backdrop-blur-[var(--backdrop-blur-popover)]',
                'animate-in fade-in-0 zoom-in-95 data-[ending-style]:animate-out data-[ending-style]:fade-out-0 data-[ending-style]:zoom-out-95',
                className,
              )}
            >
              {content}
            </BaseTooltip.Popup>
          </BaseTooltip.Positioner>
        </BaseTooltip.Portal>
      </BaseTooltip.Root>
    </BaseTooltip.Provider>
  );
}
