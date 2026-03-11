import { Select as BaseSelect } from '@base-ui-components/react/select';
import { cn } from '@/lib/utils';
import { ChevronDown, Check } from 'lucide-react';

/* ── Root ── */
const Select = BaseSelect.Root;

/* ── Trigger ── */
function SelectTrigger({
  className,
  children,
  placeholder,
}: {
  className?: string;
  children?: React.ReactNode;
  placeholder?: string;
}) {
  return (
    <BaseSelect.Trigger
      className={cn(
        'flex h-8 items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-xs',
        'shadow-xs transition-colors hover:bg-accent',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
      <BaseSelect.Value placeholder={placeholder} />
      {children}
      <BaseSelect.Icon>
        <ChevronDown className="h-3.5 w-3.5 opacity-50" />
      </BaseSelect.Icon>
    </BaseSelect.Trigger>
  );
}

/* ── Content (translucent popup) ── */
function SelectContent({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <BaseSelect.Portal>
      <BaseSelect.Positioner side="bottom" sideOffset={4}>
        <BaseSelect.Popup
          className={cn(
            'z-50 min-w-[var(--anchor-width)] overflow-hidden rounded-md border border-border p-1 shadow-lg',
            'bg-popover text-popover-foreground',
            'backdrop-blur-[var(--backdrop-blur-popover)]',
            'animate-in fade-in-0 zoom-in-95 data-[ending-style]:animate-out data-[ending-style]:fade-out-0 data-[ending-style]:zoom-out-95',
            className,
          )}
        >
          {children}
        </BaseSelect.Popup>
      </BaseSelect.Positioner>
    </BaseSelect.Portal>
  );
}

/* ── Option ── */
function SelectOption({
  className,
  children,
  value,
}: {
  className?: string;
  children: React.ReactNode;
  value: string;
}) {
  return (
    <BaseSelect.Option
      value={value}
      className={cn(
        'relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-xs outline-none',
        'transition-colors data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground',
        className,
      )}
    >
      <BaseSelect.OptionIndicator className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <Check className="h-3 w-3" />
      </BaseSelect.OptionIndicator>
      <BaseSelect.OptionText>{children}</BaseSelect.OptionText>
    </BaseSelect.Option>
  );
}

export { Select, SelectTrigger, SelectContent, SelectOption };
