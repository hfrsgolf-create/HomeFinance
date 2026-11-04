import { ReactNode, useState, useEffect } from 'react';
import { LayoutDashboard, Wallet, ShoppingBag, TrendingUp, Settings as SettingsIcon, Receipt, History, PieChart, Gauge, ChevronUp, FileText, Coins } from 'lucide-react';

export type Page = 'dashboard' | 'accounts' | 'additional-income' | 'transactions' | 'retirement' | 'providers' | 'outgoings' | 'historical' | 'breakdowns' | 'energy' | 'settings';

interface LayoutProps {
  current: Page;
  onNavigate: (p: Page) => void;
  children: ReactNode;
}

const navItems: { id: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard',    label: 'Dashboard',          icon: LayoutDashboard },
  { id: 'breakdowns',   label: 'Breakdowns',          icon: PieChart },
  { id: 'accounts',           label: 'Accounts',            icon: Wallet },
  { id: 'additional-income',  label: 'Additional Income',   icon: Coins },
  { id: 'transactions',       label: 'Big Spend',           icon: ShoppingBag },
  { id: 'outgoings',    label: 'Regular Outgoings',   icon: Receipt },
  { id: 'retirement',   label: 'Retirement',          icon: TrendingUp },
  { id: 'providers',    label: 'Providers',           icon: FileText },
  { id: 'historical',   label: 'History',             icon: History },
  { id: 'energy',       label: 'Energy',              icon: Gauge },
  { id: 'settings',     label: 'Settings',            icon: SettingsIcon },
];

export function Layout({ current, onNavigate, children }: LayoutProps) {
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 300);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <div className="min-h-screen bg-ink-50 dark:bg-ink-950 theme-transition">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 flex-col border-r border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 px-4 py-6 z-30">
        <div className="flex items-center gap-2 px-2 mb-8">
          <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center">
            <TrendingUp size={20} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-ink-900 dark:text-ink-50 text-sm leading-tight">Retirement</p>
            <p className="text-xs text-ink-400 leading-tight">Finance Tracker</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = current === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                    : 'text-ink-500 dark:text-ink-400 hover:bg-ink-50 dark:hover:bg-ink-800'
                }`}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 bg-white/80 dark:bg-ink-900/80 backdrop-blur-lg border-b border-ink-100 dark:border-ink-800 px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
            <TrendingUp size={16} className="text-white" />
          </div>
          <span className="font-bold text-ink-900 dark:text-ink-50 text-sm">Finance Tracker</span>
        </div>
      </header>

      {/* Main content */}
      <main className="md:pl-60 pb-20 md:pb-8 min-h-screen">
        <div className="max-w-5xl mx-auto px-4 py-6 md:px-8 md:py-8 animate-fade-in">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/90 dark:bg-ink-900/90 backdrop-blur-lg border-t border-ink-100 dark:border-ink-800 flex items-stretch px-0.5 h-16 pb-[env(safe-area-inset-bottom)] overflow-x-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = current === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 min-w-[52px] h-full rounded-lg transition-colors ${
                active ? 'text-brand-600 dark:text-brand-400' : 'text-ink-400 dark:text-ink-500'
              }`}
            >
              <Icon size={19} />
              <span className="text-[9px] font-medium leading-tight text-center">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Back to top */}
      <button
        onClick={scrollTop}
        aria-label="Back to top"
        className={`fixed bottom-20 left-4 md:bottom-8 md:left-8 z-40 w-11 h-11 rounded-full bg-brand-600 text-white shadow-lg flex items-center justify-center transition-all duration-300 hover:bg-brand-700 ${
          showTop ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <ChevronUp size={22} />
      </button>
    </div>
  );
}
