import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium transition-all active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none select-none',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-base-950 hover:bg-accent-dim shadow-[0_0_0_1px_rgba(124,226,129,0.2)]',
        secondary: 'bg-base-800 text-base-50 hover:bg-base-700 border border-base-700',
        ghost: 'bg-transparent text-base-200 hover:bg-base-800',
        danger: 'bg-danger/15 text-danger hover:bg-danger/25 border border-danger/30',
        outline: 'bg-transparent border border-base-600 text-base-100 hover:bg-base-800',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-11 px-4 text-[15px]',
        lg: 'h-14 px-6 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = 'Button';
