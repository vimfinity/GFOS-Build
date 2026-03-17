import { Select as BaseSelect } from '@base-ui-components/react/select';
import { cn } from '@/lib/utils';
import { Check, ChevronDown } from 'lucide-react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

export const Select = BaseSelect.Root;

export function SelectTrigger({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<typeof BaseSelect.Trigger>) {
  return (
    <BaseSelect.Trigger
      className={cn('select-trigger', className)}
      {...props}
    >
      {children}
      <BaseSelect.Icon className="select-trigger-icon">
        <ChevronDown size={15} />
      </BaseSelect.Icon>
    </BaseSelect.Trigger>
  );
}

export function SelectValue({
  children,
  className,
  placeholder = 'Select an option',
  ...props
}: Omit<ComponentPropsWithoutRef<typeof BaseSelect.Value>, 'children'> & {
  children?: ReactNode | ((value: unknown) => ReactNode);
  placeholder?: ReactNode;
}) {
  return (
    <BaseSelect.Value className={cn('select-value', className)} {...props}>
      {children ??
        ((value: unknown) =>
          value == null || value === '' ? (
            <span className="text-muted-foreground">{placeholder}</span>
          ) : (
            String(value)
          ))}
    </BaseSelect.Value>
  );
}

export function SelectContent({
  children,
  className,
  sideOffset = 10,
  alignItemWithTrigger = false,
  ...props
}: ComponentPropsWithoutRef<typeof BaseSelect.Positioner>) {
  return (
    <BaseSelect.Portal>
      <BaseSelect.Positioner sideOffset={sideOffset} alignItemWithTrigger={alignItemWithTrigger} {...props}>
        <BaseSelect.Popup className="glass-card select-popup">
          <BaseSelect.List className={cn('select-list', className)}>
            {children}
          </BaseSelect.List>
        </BaseSelect.Popup>
      </BaseSelect.Positioner>
    </BaseSelect.Portal>
  );
}

export function SelectItem({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<typeof BaseSelect.Item>) {
  return (
    <BaseSelect.Item className={cn('select-item', className)} {...props}>
      <BaseSelect.ItemText className="select-item-text">{children}</BaseSelect.ItemText>
      <BaseSelect.ItemIndicator className="select-item-indicator">
        <Check size={13} />
      </BaseSelect.ItemIndicator>
    </BaseSelect.Item>
  );
}
