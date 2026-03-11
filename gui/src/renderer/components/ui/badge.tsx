import { cn } from '@/lib/utils';
import type { HTMLAttributes } from 'react';

type BadgeVariant = 'default' | 'secondary' | 'success' | 'destructive' | 'warning' | 'outline';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, string> = {
  default:
    'bg-primary/15 text-primary border-primary/30',
  secondary:
    'bg-secondary text-secondary-foreground border-secondary',
  success:
    'bg-success/15 text-success border-success/30',
  destructive:
    'bg-destructive/15 text-destructive border-destructive/30',
  warning:
    'bg-warning/15 text-warning border-warning/30',
  outline:
    'text-foreground border-border',
};

export function Badge({ variant = 'default', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
        variantStyles[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  if (status === 'success') return <Badge variant="success">Success</Badge>;
  if (status === 'failed') return <Badge variant="destructive">Failed</Badge>;
  if (status === 'running') return <Badge variant="warning">Running</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
}
