import { cn } from '@/lib/utils';
import type { HTMLAttributes } from 'react';

type BadgeVariant = 'default' | 'secondary' | 'success' | 'destructive' | 'warning' | 'outline';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: 'control' | 'meta';
}

const variantStyles: Record<BadgeVariant, string> = {
  default:
    'bg-primary/10 text-primary border-primary/20',
  secondary:
    'bg-secondary text-secondary-foreground border-secondary/80',
  success:
    'bg-success/10 text-success border-success/20',
  destructive:
    'bg-destructive/10 text-destructive border-destructive/20',
  warning:
    'bg-warning/10 text-warning border-warning/20',
  outline:
    'text-foreground border-border',
};

export function Badge({ variant = 'default', size = 'control', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'border transition-colors',
        size === 'control' ? 'pill-control' : 'pill-meta',
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
  if (status === 'launched') return <Badge variant="warning">Launched</Badge>;
  if (status === 'running') return <Badge variant="default">Running</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
}
