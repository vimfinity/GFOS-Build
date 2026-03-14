import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ConfirmationDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  confirmVariant?: 'default' | 'destructive';
  isPending?: boolean;
}

export function ConfirmationDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onOpenChange,
  confirmVariant = 'default',
  isPending = false,
}: ConfirmationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>

        <div className="mt-6 flex justify-end gap-2 border-t border-border pt-5">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button variant={confirmVariant} size="sm" onClick={onConfirm} disabled={isPending}>
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
