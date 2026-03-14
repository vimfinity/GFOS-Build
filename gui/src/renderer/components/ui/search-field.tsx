import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/ui/tooltip';

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}

export function SearchField({ value, onChange, placeholder, className }: SearchFieldProps) {
  const hasValue = value.trim().length > 0;

  return (
    <div className={cn('search-shell', className)}>
      <Search size={14} className="shrink-0 text-muted-foreground" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="field-input"
      />
      {hasValue && (
        <Tooltip content="Clear search" side="bottom">
          <button
            type="button"
            onClick={() => onChange('')}
            className="field-icon-button shrink-0"
            aria-label="Clear search"
          >
            <X size={12} />
          </button>
        </Tooltip>
      )}
    </div>
  );
}
