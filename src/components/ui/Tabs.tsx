import * as RadixTabs from '@radix-ui/react-tabs';
import { cn } from '@/lib/cn';

export const Tabs = RadixTabs.Root;

export function TabsList({ className, ...props }: React.ComponentProps<typeof RadixTabs.List>) {
  return (
    <RadixTabs.List
      className={cn('inline-flex items-center gap-1 rounded-xl bg-base-850 p-1 border border-base-800', className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof RadixTabs.Trigger>) {
  return (
    <RadixTabs.Trigger
      className={cn(
        'rounded-lg px-3 h-8 text-sm font-medium text-base-400 transition-colors data-[state=active]:bg-base-700 data-[state=active]:text-base-50',
        className,
      )}
      {...props}
    />
  );
}

export const TabsContent = RadixTabs.Content;
