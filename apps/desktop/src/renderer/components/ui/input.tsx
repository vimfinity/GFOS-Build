import { cn } from '@/lib/utils';
import { Minus, Plus } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';
import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {label}
          </label>
        )}
        <input
          id={id}
          ref={ref}
          className={cn(
            'field-input h-11 rounded-2xl border px-4 [background:var(--field-bg)] [border-color:var(--field-border)]',
            'focus:outline-none focus:border-ring focus:[box-shadow:0_0_0_1px_var(--color-ring)]',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error && 'border-destructive focus:border-destructive focus:[box-shadow:0_0_0_1px_var(--color-destructive)]',
            className,
          )}
          {...props}
        />
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    );
  },
);
Input.displayName = 'Input';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {label}
          </label>
        )}
        <textarea
          id={id}
          ref={ref}
          className={cn(
            'field-input min-h-[104px] resize-y rounded-[18px] border px-4 py-3 [background:var(--field-bg)] [border-color:var(--field-border)]',
            'focus:outline-none focus:border-ring focus:[box-shadow:0_0_0_1px_var(--color-ring)]',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error && 'border-destructive focus:border-destructive focus:[box-shadow:0_0_0_1px_var(--color-destructive)]',
            className,
          )}
          {...props}
        />
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    );
  },
);
Textarea.displayName = 'Textarea';

export interface NumberFieldProps {
  id?: string;
  label?: string;
  error?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}

function clampNumber(value: number, min?: number, max?: number) {
  let next = value;
  if (min != null) next = Math.max(min, next);
  if (max != null) next = Math.min(max, next);
  return next;
}

export function NumberField({
  id,
  label,
  error,
  value,
  onChange,
  min,
  max,
  step = 1,
  className,
}: NumberFieldProps) {
  function applyValue(next: number) {
    onChange(clampNumber(next, min, max));
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={id} className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </label>
      )}
      <div className="field-shell h-11 rounded-2xl px-1.5 pl-4">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={String(value)}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D+/g, '');
            if (digits === '') return;
            applyValue(Number(digits));
          }}
          onBlur={() => applyValue(value)}
          className="field-input text-sm"
        />
        <div className="flex items-center gap-1">
          <Tooltip content="Decrease" side="bottom" disabled={min != null && value <= min}>
            <button
              type="button"
              onClick={() => applyValue(value - step)}
              disabled={min != null && value <= min}
              className="field-icon-button h-8 w-8 rounded-full disabled:pointer-events-none disabled:opacity-40"
              aria-label="Decrease value"
            >
              <Minus size={13} />
            </button>
          </Tooltip>
          <Tooltip content="Increase" side="bottom" disabled={max != null && value >= max}>
            <button
              type="button"
              onClick={() => applyValue(value + step)}
              disabled={max != null && value >= max}
              className="field-icon-button h-8 w-8 rounded-full disabled:pointer-events-none disabled:opacity-40"
              aria-label="Increase value"
            >
              <Plus size={13} />
            </button>
          </Tooltip>
        </div>
      </div>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
