import * as RadixSwitch from '@radix-ui/react-switch';
import { cn } from '@/lib/cn';

export function Switch({ checked, onCheckedChange, className, ariaLabel }: { checked: boolean; onCheckedChange: (v: boolean) => void; className?: string; ariaLabel?: string }) {
  return (
    <RadixSwitch.Root aria-label={ariaLabel} checked={checked} onCheckedChange={onCheckedChange} className={cn('relative h-6 w-10 rounded-full bg-surface-3 border border-line data-[state=checked]:bg-accent data-[state=checked]:border-accent transition-colors outline-none shrink-0', className)}>
      <RadixSwitch.Thumb className="block h-[18px] w-[18px] translate-x-[2px] rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[18px]" />
    </RadixSwitch.Root>
  );
}
