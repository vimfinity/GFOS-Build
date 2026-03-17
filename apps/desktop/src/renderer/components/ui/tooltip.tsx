import { Tooltip as BaseTooltip } from '@base-ui-components/react/tooltip';
import type { ReactElement, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <BaseTooltip.Provider delay={500} closeDelay={80}>
      {children}
    </BaseTooltip.Provider>
  );
}

export function ShortcutKey({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={cn('tooltip-kbd', className)}>{children}</span>;
}

interface TooltipProps {
  content: ReactNode;
  shortcut?: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  disabled?: boolean;
  children: ReactElement<Record<string, unknown>>;
}

export function Tooltip({
  content,
  shortcut,
  side = 'top',
  align = 'center',
  disabled = false,
  children,
}: TooltipProps) {
  if (disabled) return children;

  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger render={children} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner side={side} align={align} sideOffset={10}>
          <BaseTooltip.Popup className={(state) => cn('tooltip-popup', `tooltip-popup-${state.side}`)}>
            <div className="flex items-center gap-2">
              <span>{content}</span>
              {shortcut ? shortcut : null}
            </div>
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
}
