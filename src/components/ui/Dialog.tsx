import * as RadixDialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

export function Dialog({
  open,
  onOpenChange,
  children,
  title,
  description,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm data-[state=open]:animate-fade-in" />
        <RadixDialog.Content
          className={cn(
            'fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-2rem)] max-w-md max-h-[85dvh] overflow-y-auto rounded-2xl bg-base-900 border border-base-800 p-5 shadow-2xl focus:outline-none data-[state=open]:animate-slide-up',
            className,
          )}
        >
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <RadixDialog.Title className="text-lg font-semibold text-base-50">{title}</RadixDialog.Title>
              {description && (
                <RadixDialog.Description className="text-sm text-base-400 mt-0.5">
                  {description}
                </RadixDialog.Description>
              )}
            </div>
            <RadixDialog.Close className="shrink-0 h-8 w-8 flex items-center justify-center rounded-lg text-base-400 hover:bg-base-800 hover:text-base-100">
              <X size={18} />
            </RadixDialog.Close>
          </div>
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
