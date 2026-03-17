import { cn } from '@/lib/utils';

export function SkeletonRow({ width, className }: { width?: string; className?: string }) {
  return (
    <div className={cn('h-4 rounded-full bg-border/80 animate-pulse', width ?? 'w-full', className)} />
  );
}

export function SkeletonRows({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonRow key={i} width={i % 3 === 2 ? 'w-3/4' : 'w-full'} />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('glass-card rounded-[18px] border border-border p-5 flex flex-col gap-3', className)}>
      <SkeletonRow width="w-1/3" />
      <SkeletonRow width="w-2/3" />
      <SkeletonRow width="w-1/2" />
    </div>
  );
}
