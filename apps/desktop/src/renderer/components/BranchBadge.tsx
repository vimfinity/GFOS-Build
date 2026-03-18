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
    <span className={cn('pill-meta bg-violet-500/10 text-violet-400', className)}>
      <GitBranch size={11} className="shrink-0" />
      {branch}
      {isDirty && <span className="text-violet-400/60">*</span>}
    </span>
  );
}
