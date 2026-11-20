import * as RadixDialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

/** Bottom sheet on phones, centred dialog on larger screens. */
export function Dialog({ open, onOpenChange, children, title, description, className, footer }: { open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode; title: string; description?: string; className?: string; footer?: ReactNode }) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <RadixDialog.Content
          aria-describedby={description ? undefined : undefined}
          className={cn(
            'fixed z-50 flex flex-col bg-surface border border-line shadow-[var(--shadow-lg)] focus:outline-none',
            'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-2xl data-[state=open]:animate-sheet-up',
            'sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[calc(100vw-2rem)] sm:max-w-lg sm:max-h-[85dvh] sm:rounded-2xl sm:data-[state=open]:animate-pop',
            className,
          )}
        >
          <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-line">
            <div className="min-w-0">
              <RadixDialog.Title className="text-base font-semibold text-fg">{title}</RadixDialog.Title>
              {description ? <RadixDialog.Description className="text-[13px] text-fg-3 mt-0.5">{description}</RadixDialog.Description> : <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>}
            </div>
            <RadixDialog.Close className="shrink-0 -mr-1.5 h-8 w-8 flex items-center justify-center rounded-lg text-fg-3 hover:bg-surface-2 hover:text-fg" aria-label="Close">
              <X size={18} />
            </RadixDialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex gap-2 justify-end px-5 py-3 border-t border-line safe-bottom">{footer}</div>}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

export function Confirm({ open, onOpenChange, title, body, confirmLabel = 'Delete', onConfirm, danger = true }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; body: string; confirmLabel?: string; onConfirm: () => void; danger?: boolean }) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      footer={
        <>
          <button className="h-9 px-4 rounded-lg text-sm font-medium text-fg-2 hover:bg-surface-2" onClick={() => onOpenChange(false)}>
            Cancel
          </button>
          <button
            className={cn('h-9 px-4 rounded-lg text-sm font-medium', danger ? 'bg-danger text-white' : 'bg-accent text-accent-fg')}
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-fg-2">{body}</p>
    </Dialog>
  );
}
