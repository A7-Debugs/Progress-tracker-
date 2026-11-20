import { type InputHTMLAttributes, forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

const base = 'w-full rounded-lg bg-surface border border-line text-[15px] sm:text-sm text-fg placeholder:text-fg-3 outline-none transition-colors focus:border-accent focus:ring-3 focus:ring-accent/15';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => <input ref={ref} className={cn(base, 'h-10 px-3', className)} {...props} />);
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, rows = 3, ...props }, ref) => <textarea ref={ref} rows={rows} className={cn(base, 'px-3 py-2 resize-y min-h-[72px]', className)} {...props} />);
Textarea.displayName = 'Textarea';

export const NumberField = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => <input ref={ref} type="number" inputMode="decimal" className={cn(base, 'h-10 px-3 tnum', className)} {...props} />);
NumberField.displayName = 'NumberField';
