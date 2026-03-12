import { cn } from '@/lib/utils';
import { useRef, useState, type KeyboardEvent } from 'react';

export interface TagInputProps {
  id?: string;
  label?: string;
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function TagInput({ id, label, value, onChange, placeholder, className }: TagInputProps) {
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
        <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
          {label}
        </label>
      )}
      <div
        className={cn(
          'flex flex-wrap gap-1.5 rounded-md border border-input bg-background px-3 py-2',
          'focus-within:ring-2 focus-within:ring-ring focus-within:border-transparent',
          'min-h-9 cursor-text',
          className,
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tag, i) => (
          <span
            key={i}
            className="text-xs bg-secondary text-secondary-foreground rounded px-2 py-0.5 flex items-center gap-1 shrink-0"
          >
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(i);
              }}
              className="leading-none hover:text-destructive transition-colors focus:outline-none"
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
          className="text-xs text-foreground bg-transparent flex-1 min-w-[8rem] outline-none placeholder:text-muted-foreground/50"
        />
      </div>
    </div>
  );
}
