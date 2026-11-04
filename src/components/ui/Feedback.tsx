import { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export function Spinner({ size = 24, className = '' }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={`animate-spin text-brand-500 ${className}`} />;
}

export function FullPageSpinner({ label }: { label?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-ink-50 dark:bg-ink-950">
      <Spinner size={32} />
      {label && <p className="text-sm text-ink-400">{label}</p>}
    </div>
  );
}

export function EmptyState({ icon, title, message, action }: { icon?: ReactNode; title: string; message?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      {icon && <div className="text-ink-300 dark:text-ink-600 mb-3">{icon}</div>}
      <p className="font-medium text-ink-600 dark:text-ink-300">{title}</p>
      {message && <p className="text-sm text-ink-400 mt-1 max-w-xs">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
