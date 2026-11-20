import * as RadixSelect from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

export const NONE = '__none__';

export function Select({ value, onValueChange, options, placeholder = 'Select…', className, ariaLabel }: { value: string; onValueChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string; className?: string; ariaLabel?: string }) {
  return (
    <RadixSelect.Root value={value} onValueChange={onValueChange}>
      <RadixSelect.Trigger aria-label={ariaLabel} className={cn('h-10 w-full inline-flex items-center justify-between gap-2 rounded-lg bg-surface border border-line px-3 text-[15px] sm:text-sm text-fg outline-none focus:border-accent data-[placeholder]:text-fg-3', className)}>
        <span className="truncate">
          <RadixSelect.Value placeholder={placeholder} />
        </span>
        <RadixSelect.Icon>
          <ChevronDown size={16} className="text-fg-3" />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content position="popper" sideOffset={4} className="z-[60] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg bg-surface border border-line shadow-[var(--shadow-lg)]">
          <RadixSelect.Viewport className="p-1 max-h-72">
            {options.map((opt) => (
              <RadixSelect.Item key={opt.value} value={opt.value} className="relative flex items-center h-9 pl-8 pr-3 rounded-md text-sm text-fg outline-none data-[highlighted]:bg-surface-2 cursor-pointer">
                <RadixSelect.ItemIndicator className="absolute left-2.5">
                  <Check size={14} className="text-accent" />
                </RadixSelect.ItemIndicator>
                <RadixSelect.ItemText>{opt.label}</RadixSelect.ItemText>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
