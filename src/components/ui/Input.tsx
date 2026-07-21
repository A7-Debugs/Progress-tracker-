import { type InputHTMLAttributes, forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-11 w-full rounded-xl bg-base-850 border border-base-700 px-3 text-[15px] text-base-50 placeholder:text-base-400 outline-none transition-colors focus:border-accent/60 focus:ring-2 focus:ring-accent/15',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'w-full rounded-xl bg-base-850 border border-base-700 px-3 py-2 text-[15px] text-base-50 placeholder:text-base-400 outline-none transition-colors focus:border-accent/60 focus:ring-2 focus:ring-accent/15 resize-none',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';

export const NumberField = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      type="number"
      inputMode="decimal"
      className={cn(
        'h-12 w-full rounded-xl bg-base-850 border border-base-700 px-3 text-center text-lg font-semibold text-base-50 placeholder:text-base-400 placeholder:font-normal outline-none transition-colors focus:border-accent/60 focus:ring-2 focus:ring-accent/15',
        className,
      )}
      {...props}
    />
  ),
);
NumberField.displayName = 'NumberField';
