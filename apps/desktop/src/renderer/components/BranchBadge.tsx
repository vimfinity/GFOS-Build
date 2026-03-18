import { GitBranch } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BranchBadgeProps {
  branch: string | null;
  isDirty?: boolean;
  className?: string;
}

export function BranchBadge({ branch, isDirty, className }: BranchBadgeProps) {
  if (!branch) return null;

  return (
    <span
      className={cn('pill-meta max-w-[180px] bg-violet-500/10 text-violet-400', className)}
    >
      <GitBranch size={11} className="shrink-0" />
      <span className="truncate">{branch}</span>
      {isDirty && (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
      )}
    </span>
  );
}
