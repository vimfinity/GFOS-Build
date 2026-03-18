import { GitBranch } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BranchBadgeProps {
  branch: string | null;
  isDirty?: boolean;
  className?: string;
}

export function BranchBadge({ branch, isDirty, className }: BranchBadgeProps) {
  if (!branch) return null;

  const label = isDirty ? `${branch}*` : branch;

  return (
    <span
      className={cn('pill-meta max-w-[180px] bg-violet-500/10 text-violet-400', className)}
      title={label}
    >
      <GitBranch size={11} className="shrink-0" />
      <span className="truncate">
        {branch}
        {isDirty && <span className="text-violet-400/60">*</span>}
      </span>
    </span>
  );
}
