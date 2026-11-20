import type { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const badgeVariants = cva('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold', {
  variants: {
    variant: {
      accent: 'bg-accent-bg text-accent',
      neutral: 'bg-base-800 text-base-300',
      danger: 'bg-danger/15 text-danger',
      warn: 'bg-warn/15 text-warn',
      info: 'bg-info/15 text-info',
    },
  },
  defaultVariants: { variant: 'neutral' },
});

export function Badge({
  className,
  variant,
  ...props
}: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
