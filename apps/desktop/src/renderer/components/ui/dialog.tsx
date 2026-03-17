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
  showCloseButton = true,
  ...props
}: ComponentPropsWithoutRef<typeof BaseDialog.Popup> & {
  children: ReactNode;
  showCloseButton?: boolean;
}) {
  return (
    <BaseDialog.Portal>
      <BaseDialog.Backdrop className="fixed inset-0 z-[70] bg-black/34 backdrop-blur-md transition-opacity" />
      <BaseDialog.Popup
        className={cn(
          'fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto p-4 outline-none focus:outline-none focus-visible:outline-none',
        )}
        {...props}
      >
        <div
          className={cn(
            'glass-card relative flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col overflow-visible rounded-[24px] border border-border p-6 md:p-7',
            className,
          )}
        >
          {children}
          {showCloseButton && (
            <BaseDialog.Close className="absolute top-4 right-4 inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors cursor-pointer hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:[box-shadow:inset_0_0_0_1px_var(--color-ring)]">
              <X size={16} />
            </BaseDialog.Close>
          )}
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
    <BaseDialog.Title className={cn('page-title text-[1.375rem] font-semibold text-foreground', className)}>
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
    <BaseDialog.Description className={cn('mt-1 text-sm leading-relaxed text-muted-foreground', className)}>
      {children}
    </BaseDialog.Description>
  );
}
