import { ReactNode } from 'react';

import type { CSSProperties } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  hover?: boolean;
}

export function Card({
  children,
  className = '',
  style,
  onClick,
  hover = false,
}: CardProps) {
  const hasBgOverride = /\bbg-/.test(className);
  return (
    <div
      onClick={onClick}
      style={style}
      className={`rounded-2xl shadow-card border border-ink-100 dark:border-ink-800 ${
        !hasBgOverride ? 'bg-white dark:bg-ink-900' : ''
      } ${
        hover ? 'transition-all duration-200 hover:shadow-card-hover hover:border-ink-200 dark:hover:border-ink-700 cursor-pointer' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export function CardHeader({ title, subtitle, action, icon }: CardHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-3 p-5 pb-3">
      <div className="flex items-center gap-2.5 min-w-0">
        {icon && <div className="text-brand-500 shrink-0">{icon}</div>}
        <div className="min-w-0">
          <h3 className="font-semibold text-ink-900 dark:text-ink-50 text-sm leading-tight truncate">{title}</h3>
          {subtitle && <p className="text-xs text-ink-400 dark:text-ink-500 mt-0.5 truncate">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
