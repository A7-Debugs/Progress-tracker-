import * as RadixTabs from '@radix-ui/react-tabs';
import { cn } from '@/lib/cn';

export const Tabs = RadixTabs.Root;
export const TabsContent = RadixTabs.Content;

export function TabsList({ className, ...props }: React.ComponentProps<typeof RadixTabs.List>) {
  return <RadixTabs.List className={cn('inline-flex items-center gap-0.5 rounded-lg bg-surface-2 p-0.5 border border-line', className)} {...props} />;
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof RadixTabs.Trigger>) {
  return <RadixTabs.Trigger className={cn('rounded-md px-3 h-7 text-[13px] font-medium text-fg-3 transition-colors data-[state=active]:bg-surface data-[state=active]:text-fg data-[state=active]:shadow-[var(--shadow)]', className)} {...props} />;
}
