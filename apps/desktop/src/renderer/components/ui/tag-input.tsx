import { cn } from '@/lib/utils';
import { useRef, useState, type KeyboardEvent } from 'react';

export interface TagInputProps {
  id?: string;
  label?: string;
  description?: string;
  required?: boolean;
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function TagInput({ id, label, description, required, value, onChange, placeholder, className }: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function addTag(tag: string) {
    const trimmed = tag.trim();
    if (!trimmed || value.includes(trimmed)) return;
    onChange([...value, trimmed]);
    setInputValue('');
  }

  function removeTag(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && inputValue === '') {
      if (value.length > 0) {
        onChange(value.slice(0, -1));
      }
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {label}
          {required ? <span className="ml-1 text-destructive">*</span> : null}
        </label>
      )}
      <div
        className={cn(
          'flex min-h-11 flex-wrap gap-1.5 rounded-[18px] border px-4 py-3 [background:var(--field-bg)] [border-color:var(--field-border)]',
          'focus-within:border-ring focus-within:[box-shadow:0_0_0_1px_var(--color-ring)]',
          'cursor-text',
          className,
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tag, i) => (
          <span
            key={i}
            className="flex shrink-0 items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-1 text-xs text-secondary-foreground transition-colors focus-within:border-ring focus-within:[box-shadow:0_0_0_1px_var(--color-ring)]"
          >
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(i);
              }}
              className="rounded-full px-0.5 leading-none transition-colors hover:text-destructive focus-visible:outline-none focus-visible:text-destructive"
              aria-label={`Remove ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? placeholder : undefined}
          className="field-input min-w-[8rem] flex-1"
        />
      </div>
      {description ? <span className="text-xs text-muted-foreground">{description}</span> : null}
    </div>
  );
}
