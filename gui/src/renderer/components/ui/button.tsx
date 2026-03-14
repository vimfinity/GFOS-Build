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
    'rounded-full bg-primary text-primary-foreground shadow-[0_1px_2px_rgb(0_0_0_/_0.05)] hover:bg-primary/92 active:bg-primary/86',
  secondary:
    'rounded-full bg-secondary text-secondary-foreground hover:bg-accent active:bg-accent/80',
  ghost:
    'rounded-full text-muted-foreground hover:bg-accent hover:text-accent-foreground active:bg-accent/90',
  destructive:
    'rounded-full border border-destructive/25 bg-destructive/10 text-destructive hover:bg-destructive/15 active:bg-destructive/20',
  outline:
    'rounded-full border border-input bg-card/80 text-foreground shadow-[0_1px_2px_rgb(0_0_0_/_0.03)] hover:bg-accent active:bg-accent/80',
  link:
    'text-primary underline-offset-4 hover:underline',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-9 px-4 text-[13px] gap-1.5',
  default: 'h-10 px-5 py-2 text-sm',
  lg: 'h-11 px-6 text-sm',
  icon: 'h-9 w-9',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        className={cn(
          'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium',
          'cursor-pointer transition-colors duration-150',
          'outline-none focus:outline-none focus-visible:outline-none focus-visible:[box-shadow:0_0_0_1px_var(--color-ring),0_0_0_4px_color-mix(in_oklab,var(--color-ring)_18%,transparent),inset_0_0_0_1px_color-mix(in_oklab,var(--color-foreground)_10%,transparent)]',
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
