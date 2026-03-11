import { Dialog as BaseDialog } from '@base-ui-components/react/dialog';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

export const Dialog = BaseDialog.Root;
export const DialogTrigger = BaseDialog.Trigger;
export const DialogClose = BaseDialog.Close;

export function DialogContent({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<typeof BaseDialog.Popup> & { children: ReactNode }) {
  return (
    <BaseDialog.Portal>
      <BaseDialog.Backdrop className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" />
      <BaseDialog.Popup
        className={cn(
          'fixed inset-0 flex items-start justify-center overflow-y-auto p-4 pt-[10vh]',
        )}
        {...props}
      >
        <div
          className={cn(
            'relative bg-card rounded-xl border border-border shadow-2xl w-full max-w-lg p-6',
            className,
          )}
        >
          {children}
          <BaseDialog.Close className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
            <X size={16} />
          </BaseDialog.Close>
        </div>
      </BaseDialog.Popup>
    </BaseDialog.Portal>
  );
}

export function DialogTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <BaseDialog.Title className={cn('text-lg font-semibold text-foreground', className)}>
      {children}
    </BaseDialog.Title>
  );
}

export function DialogDescription({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <BaseDialog.Description className={cn('text-sm text-muted-foreground mt-1', className)}>
      {children}
    </BaseDialog.Description>
  );
}
