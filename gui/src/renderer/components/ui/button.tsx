import { cn } from '@/lib/utils';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'default' | 'secondary' | 'ghost' | 'destructive' | 'outline' | 'link';
type ButtonSize = 'sm' | 'default' | 'lg' | 'icon';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantStyles: Record<ButtonVariant, string> = {
  default:
    'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90',
  secondary:
    'bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80',
  ghost:
    'hover:bg-accent hover:text-accent-foreground',
  destructive:
    'bg-destructive/15 text-destructive shadow-xs hover:bg-destructive/25 border-destructive/30',
  outline:
    'border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground',
  link:
    'text-primary underline-offset-4 hover:underline',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-8 rounded-md px-3 text-xs gap-1.5',
  default: 'h-9 rounded-md px-4 py-2 text-sm',
  lg: 'h-10 rounded-md px-6 text-sm',
  icon: 'h-9 w-9 rounded-md',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        className={cn(
          'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium',
          'transition-colors duration-150 cursor-pointer',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:pointer-events-none disabled:opacity-50',
          variantStyles[variant],
          sizeStyles[size],
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button };
