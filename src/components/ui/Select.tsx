import * as RadixSelect from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

export function Select({
  value,
  onValueChange,
  options,
  placeholder = 'Select…',
  className,
}: {
  value: string;
  onValueChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}) {
  return (
    <RadixSelect.Root value={value} onValueChange={onValueChange}>
      <RadixSelect.Trigger
        className={cn(
          'h-11 w-full inline-flex items-center justify-between gap-2 rounded-xl bg-base-850 border border-base-700 px-3 text-[15px] text-base-50 outline-none focus:border-accent/60',
          className,
        )}
      >
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon>
          <ChevronDown size={16} className="text-base-400" />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content className="z-50 overflow-hidden rounded-xl bg-base-850 border border-base-700 shadow-2xl">
          <RadixSelect.Viewport className="p-1 max-h-72">
            {options.map((opt) => (
              <RadixSelect.Item
                key={opt.value}
                value={opt.value}
                className="relative flex items-center h-10 pl-8 pr-3 rounded-lg text-[15px] text-base-100 outline-none data-[highlighted]:bg-base-700 cursor-pointer"
              >
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
