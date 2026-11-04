import { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

const baseField = 'w-full rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-950 px-3.5 py-2.5 text-sm text-ink-900 dark:text-ink-100 placeholder:text-ink-400 dark:placeholder:text-ink-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition-all';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string;
  hint?: string;
  prefix?: ReactNode;
}

export function Input({ label, hint, prefix, className = '', ...props }: InputProps) {
  return (
    <label className="block">
      {label && <span className="block text-xs font-medium text-ink-600 dark:text-ink-300 mb-1.5">{label}</span>}
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 text-sm pointer-events-none">{prefix}</span>}
        <input className={`${baseField} ${prefix ? 'pl-7' : ''} ${className}`} {...props} />
      </div>
      {hint && <span className="block text-xs text-ink-400 mt-1">{hint}</span>}
    </label>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  children: ReactNode;
}

export function Select({ label, className = '', children, ...props }: SelectProps) {
  return (
    <label className="block">
      {label && <span className="block text-xs font-medium text-ink-600 dark:text-ink-300 mb-1.5">{label}</span>}
      <select className={`${baseField} appearance-none bg-[length:16px] bg-[right_0.75rem_center] bg-no-repeat pr-9 ${className}`}
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%238590a8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")" }}
        {...props}
      >
        {children}
      </select>
    </label>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export function Textarea({ label, className = '', ...props }: TextareaProps) {
  return (
    <label className="block">
      {label && <span className="block text-xs font-medium text-ink-600 dark:text-ink-300 mb-1.5">{label}</span>}
      <textarea className={`${baseField} resize-none ${className}`} {...props} />
    </label>
  );
}
