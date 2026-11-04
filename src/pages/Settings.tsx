import { Moon, Sun, Download, LogOut, Info, ShieldCheck } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useFinance } from '../context/FinanceContext';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { formatDate } from '../lib/format';
import { ACCOUNT_TYPE_LABELS } from '../lib/types';

export function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const { signOut } = useAuth();
  const { accounts, transactions, updates, winnings, interestRecords, outgoings, historicalData } = useFinance();

  const exportCSV = () => {
    const rows: string[] = [];

    rows.push('SECTION,Accounts');
    rows.push('Name,Type,Current Value,Notes,Created');
    for (const a of accounts) {
      rows.push([csv(a.name), a.type, a.current_value, csv(a.notes), a.created_at.slice(0, 10)].join(','));
    }
    rows.push('');

    rows.push('SECTION,Account Updates (Balance History)');
    rows.push('Account,Date,Balance,Adjustment,Note');
    for (const u of updates) {
      const accName = accounts.find((a) => a.id === u.account_id)?.name ?? 'Unknown';
      rows.push([csv(accName), u.recorded_date, u.balance, u.adjustment ?? '', csv(u.note)].join(','));
    }
    rows.push('');

    rows.push('SECTION,Transactions / Events');
    rows.push('Date,Description,Amount,Linked Account');
    for (const t of transactions) {
      const accName = t.account_id ? accounts.find((a) => a.id === t.account_id)?.name ?? '' : '';
      rows.push([t.date, csv(t.description), t.amount, csv(accName)].join(','));
    }
    rows.push('');

    rows.push('SECTION,Bond Winnings');
    rows.push('Account,Date,Amount,Note');
    for (const w of winnings) {
      const accName = accounts.find((a) => a.id === w.account_id)?.name ?? 'Unknown';
      rows.push([csv(accName), w.date, w.amount, csv(w.note)].join(','));
    }
    rows.push('');

    rows.push('SECTION,Interest Records');
    rows.push('Account,Date,Amount,Note');
    for (const r of interestRecords) {
      const accName = accounts.find((a) => a.id === r.account_id)?.name ?? 'Unknown';
      rows.push([csv(accName), r.date, r.amount, csv(r.note)].join(','));
    }
    rows.push('');

    rows.push('SECTION,Outgoings');
    rows.push('Name,Amount (Monthly),Type,Notes');
    for (const o of outgoings) {
      rows.push([csv(o.name), o.amount, o.type, csv(o.notes)].join(','));
    }
    rows.push('');

    rows.push('SECTION,Historical Data');
    rows.push('Year,Fire Pension,Bond Winnings,Year-Start Balance');
    for (const h of historicalData) {
      rows.push([h.year, h.fire_pension, h.bond_winnings, h.year_start_balance].join(','));
    }

    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `finance-export-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-ink-900 dark:text-ink-50">Settings</h1>
        <p className="text-sm text-ink-400">Preferences & data</p>
      </div>

      {/* Appearance */}
      <Card>
        <CardHeader title="Appearance" icon={theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />} />
        <div className="px-5 pb-5">
          <button onClick={toggleTheme} className="w-full flex items-center justify-between p-3 rounded-xl bg-ink-50 dark:bg-ink-800 hover:bg-ink-100 dark:hover:bg-ink-700 transition-colors">
            <div className="flex items-center gap-3">
              {theme === 'dark' ? <Moon size={18} className="text-brand-400" /> : <Sun size={18} className="text-amber-500" />}
              <span className="text-sm font-medium text-ink-800 dark:text-ink-100">{theme === 'dark' ? 'Dark mode' : 'Light mode'}</span>
            </div>
            <span className="text-xs text-ink-400">Tap to switch</span>
          </button>
        </div>
      </Card>

      {/* Data export */}
      <Card>
        <CardHeader title="Data Export" icon={<Download size={16} />} />
        <div className="px-5 pb-5">
          <p className="text-sm text-ink-500 dark:text-ink-400 mb-3">
            Export all your accounts, balance history, events, outgoings, and historical data as a CSV file for your records.
          </p>
          <Button onClick={exportCSV} variant="secondary" size="sm"><Download size={16} /> Export to CSV</Button>
        </div>
      </Card>

      {/* Yearly comparison */}
      <Card>
        <CardHeader title="Yearly Comparison" icon={<Info size={16} />} />
        <div className="px-5 pb-5 space-y-2">
          <p className="text-sm text-ink-500 dark:text-ink-400 mb-2">Account totals by type:</p>
          {(['bank', 'savings', 'premium_bonds', 'pension', 'property', 'isa'] as const).map((t) => {
            const total = accounts.filter((a) => a.type === t).reduce((s, a) => s + Number(a.current_value), 0);
            const count = accounts.filter((a) => a.type === t).length;
            return (
              <div key={t} className="flex items-center justify-between text-sm py-1.5">
                <span className="text-ink-600 dark:text-ink-300">{ACCOUNT_TYPE_LABELS[t]} ({count})</span>
                <span className="font-medium text-ink-900 dark:text-ink-50">{total > 0 ? `£${total.toLocaleString('en-GB', { maximumFractionDigits: 0 })}` : '—'}</span>
              </div>
            );
          })}
          <div className="flex items-center justify-between text-sm py-2 mt-2 border-t border-ink-100 dark:border-ink-800">
            <span className="font-semibold text-ink-700 dark:text-ink-200">Total</span>
            <span className="font-bold text-ink-900 dark:text-ink-50">
              £{accounts.reduce((s, a) => s + Number(a.current_value), 0).toLocaleString('en-GB', { maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>
      </Card>

      {/* Privacy */}
      <Card>
        <CardHeader title="Privacy" icon={<ShieldCheck size={16} />} />
        <div className="px-5 pb-5">
          <ul className="text-sm text-ink-500 dark:text-ink-400 space-y-2">
            <li>• No real banking data is stored — only your custom labels and amounts</li>
            <li>• No bank integrations — all data is manually entered</li>
            <li>• Private, single-user access only</li>
            <li>• Data is stored securely with row-level protection</li>
          </ul>
        </div>
      </Card>

      {/* Account */}
      <Card>
        <CardHeader title="Account" icon={<LogOut size={16} />} />
        <div className="px-5 pb-5">
          <Button onClick={signOut} variant="danger" size="sm"><LogOut size={16} /> Sign out</Button>
        </div>
      </Card>

      <p className="text-center text-xs text-ink-400 pt-2">
        Retirement Finance Tracker · Last updated {formatDate(new Date().toISOString())}
      </p>
    </div>
  );
}

function csv(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
