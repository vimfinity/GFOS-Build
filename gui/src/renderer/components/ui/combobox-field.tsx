import { ChevronDown } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface ComboboxOption {
  value: string;
  label: string;
  description?: string;
  keywords?: string[];
}

interface ComboboxFieldProps {
  value: string;
  options: ComboboxOption[];
  onValueChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
}

export function ComboboxField({
  value,
  options,
  onValueChange,
  placeholder = 'Select an option',
  emptyText = 'No matching results',
}: ComboboxFieldProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  );

  const filteredOptions = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      return options;
    }
    return options.filter((option) =>
      option.label.toLowerCase().includes(trimmed) ||
      option.description?.toLowerCase().includes(trimmed) ||
      option.keywords?.some((keyword) => keyword.toLowerCase().includes(trimmed)),
    );
  }, [options, query]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) return;

    const listbox = listboxRef.current;
    const activeOption = listbox?.querySelector<HTMLElement>(`[data-option-index="${highlightedIndex}"]`);
    activeOption?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex, open]);

  useEffect(() => {
    if (!open) return undefined;

    function onPointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  function selectValue(nextValue: string) {
    onValueChange(nextValue);
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        value={open ? query : selectedOption?.label ?? ''}
        onChange={(event) => {
          setQuery(event.target.value);
          if (!open) setOpen(true);
        }}
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter')) {
            event.preventDefault();
            setOpen(true);
            return;
          }

          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
            setHighlightedIndex((current) => Math.min(current + 1, Math.max(filteredOptions.length - 1, 0)));
            return;
          }

          if (event.key === 'ArrowUp') {
            event.preventDefault();
            setHighlightedIndex((current) => Math.max(current - 1, 0));
            return;
          }

          if (event.key === 'Enter') {
            event.preventDefault();
            const option = filteredOptions[highlightedIndex];
            if (!option) return;
            selectValue(option.value);
            return;
          }

          if (event.key === 'Escape') {
            event.preventDefault();
            setOpen(false);
            setQuery('');
            inputRef.current?.blur();
          }
        }}
        placeholder={placeholder}
        className="field-input h-11 w-full rounded-2xl border pr-10 pl-4 [background:var(--field-bg)] [border-color:var(--field-border)] focus:outline-none focus:border-ring focus:[box-shadow:0_0_0_1px_var(--color-ring)]"
      />
      <ChevronDown
        size={15}
        className={cn(
          'pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-transform',
          open && 'rotate-180',
        )}
      />

      {open && (
        <div
          ref={listboxRef}
          id={listboxId}
          role="listbox"
          className="glass-card listbox-panel absolute left-0 right-0 top-full z-50 mt-2 max-h-64 overflow-auto"
        >
          {filteredOptions.length === 0 ? (
            <div className="px-4 py-3 text-xs text-muted-foreground">{emptyText}</div>
          ) : (
            filteredOptions.map((option, index) => (
              <button
                key={option.value || `__empty__-${index}`}
                data-option-index={index}
                role="option"
                aria-selected={value === option.value}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => selectValue(option.value)}
                className={cn(
                  'listbox-option listbox-option-compact transition-colors',
                  value === option.value && 'is-active',
                  highlightedIndex === index && 'is-highlighted',
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-foreground">
                    {option.label}
                  </span>
                  {option.description ? (
                    <span className="block truncate font-mono text-[11px] text-muted-foreground">
                      {option.description}
                    </span>
                  ) : null}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
