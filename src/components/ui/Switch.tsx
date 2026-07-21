import * as RadixSwitch from '@radix-ui/react-switch';
import { cn } from '@/lib/cn';

export function Switch({
  checked,
  onCheckedChange,
  className,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  className?: string;
}) {
  return (
    <RadixSwitch.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      className={cn(
        'relative h-7 w-12 rounded-full bg-base-700 data-[state=checked]:bg-accent transition-colors outline-none shrink-0',
        className,
      )}
    >
      <RadixSwitch.Thumb className="block h-5 w-5 translate-x-1 rounded-full bg-base-50 transition-transform data-[state=checked]:translate-x-6" />
    </RadixSwitch.Root>
  );
}
