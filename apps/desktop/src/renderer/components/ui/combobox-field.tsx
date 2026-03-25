import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
  disabled?: boolean;
}

export function ComboboxField({
  value,
  options,
  onValueChange,
  placeholder = 'Select an option',
  emptyText = 'No matching results',
  disabled = false,
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
    const trimmed = query.trim();
    if (!trimmed) {
      return options;
    }
    return options
      .map((option, index) => ({
        option,
        index,
        score: getComboboxOptionScore(option, trimmed),
      }))
      .filter((entry) => entry.score !== null)
      .toSorted((left, right) => {
        if (left.score !== right.score) {
          return left.score - right.score;
        }
        return left.index - right.index;
      })
      .map((entry) => entry.option);
  }, [options, query]);

  useEffect(() => {
    if (!disabled) return;
    setOpen(false);
    setQuery('');
  }, [disabled]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    const listbox = listboxRef.current;
    const activeOption = listbox?.querySelector<HTMLElement>(`[data-option-index="${highlightedIndex}"]`);
    activeOption?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex, open]);

  useLayoutEffect(() => {
    if (!open) return;
    const inputEl = inputRef.current;
    const dropdownEl = listboxRef.current;
    if (!inputEl || !dropdownEl) return;

    function applyPosition() {
      if (!inputEl || !dropdownEl) return;
      const rect = inputEl.getBoundingClientRect();
      const GAP = 6;
      const MAX_H = 256;
      const spaceBelow = window.innerHeight - rect.bottom - GAP;
      const spaceAbove = rect.top - GAP;
      dropdownEl.style.left = `${rect.left}px`;
      dropdownEl.style.width = `${rect.width}px`;
      if (spaceBelow >= 120 || spaceBelow >= spaceAbove) {
        dropdownEl.style.top = `${rect.bottom + GAP}px`;
        dropdownEl.style.bottom = '';
        dropdownEl.style.maxHeight = `${Math.max(Math.min(MAX_H, spaceBelow), 80)}px`;
      } else {
        dropdownEl.style.top = '';
        dropdownEl.style.bottom = `${window.innerHeight - rect.top + GAP}px`;
        dropdownEl.style.maxHeight = `${Math.max(Math.min(MAX_H, spaceAbove), 80)}px`;
      }
    }

    applyPosition();
    window.addEventListener('scroll', applyPosition, { capture: true, passive: true });
    window.addEventListener('resize', applyPosition, { passive: true } as EventListenerOptions);
    return () => {
      window.removeEventListener('scroll', applyPosition, { capture: true } as EventListenerOptions);
      window.removeEventListener('resize', applyPosition);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (containerRef.current?.contains(target) || listboxRef.current?.contains(target)) return;
      setOpen(false);
      setQuery('');
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
        onClick={() => {
          if (!disabled) setOpen(true);
        }}
        onKeyDown={(event) => {
          if (disabled) {
            return;
          }
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
            if (open) {
              // Prevent the parent dialog from seeing this Escape so it doesn't
              // trigger the discard-confirmation while just closing the dropdown.
              event.nativeEvent.stopImmediatePropagation();
            }
            setOpen(false);
            setQuery('');
            inputRef.current?.blur();
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        className="field-input h-11 w-full rounded-2xl border pr-10 pl-4 [background:var(--field-bg)] [border-color:var(--field-border)] focus:outline-none focus:border-ring focus:[box-shadow:0_0_0_1px_var(--color-ring)] disabled:cursor-not-allowed disabled:opacity-70"
      />
      <ChevronDown
        size={15}
        className={cn(
          'pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-transform',
          open && 'rotate-180',
        )}
      />

      {open && !disabled && createPortal(
        <div
          ref={listboxRef}
          id={listboxId}
          role="listbox"
          className="glass-card listbox-panel fixed z-[9999] overflow-auto"
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
        </div>,
        document.body,
      )}
    </div>
  );
}

function getComboboxOptionScore(option: ComboboxOption, query: string): number | null {
  const normalizedQuery = normalizeComboboxSearchValue(query);
  if (!normalizedQuery) {
    return 0;
  }

  const candidates = [
    option.label,
    option.description,
    ...(option.keywords ?? []),
  ].filter((value): value is string => Boolean(value));

  let bestScore: number | null = null;
  for (const candidate of candidates) {
    const score = scoreFuzzyMatch(normalizeComboboxSearchValue(candidate), normalizedQuery);
    if (score === null) {
      continue;
    }
    if (bestScore === null || score < bestScore) {
      bestScore = score;
    }
  }

  return bestScore;
}

function normalizeComboboxSearchValue(value: string): string {
  return value.trim().toLowerCase();
}

function scoreFuzzyMatch(candidate: string, query: string): number | null {
  if (!query) {
    return 0;
  }

  const substringIndex = candidate.indexOf(query);
  if (substringIndex >= 0) {
    return substringIndex;
  }

  let queryIndex = 0;
  let firstMatch = -1;
  let lastMatch = -1;

  for (let candidateIndex = 0; candidateIndex < candidate.length && queryIndex < query.length; candidateIndex += 1) {
    if (candidate[candidateIndex] !== query[queryIndex]) {
      continue;
    }
    if (firstMatch === -1) {
      firstMatch = candidateIndex;
    }
    lastMatch = candidateIndex;
    queryIndex += 1;
  }

  if (queryIndex !== query.length || firstMatch === -1 || lastMatch === -1) {
    return null;
  }

  const spreadPenalty = lastMatch - firstMatch - query.length + 1;
  return 1000 + firstMatch + spreadPenalty * 10;
}
