import { useMemo, useState } from 'react';
import { Wallet, ArrowUpRight, ArrowDownRight, TrendingUp, PiggyBank, Home, Landmark, Award, Gift, Percent, CreditCard, Pencil, Trash2 } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { Card, CardHeader } from '../components/ui/Card';
import { StackedBarChart } from '../components/charts/BarChart';
import { formatGBP, formatGBPFull, formatPercent, formatDate } from '../lib/format';
import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_COLORS, AccountType, EXCLUDED_FROM_NET_WORTH, Transaction } from '../lib/types';
import { EmptyState } from '../components/ui/Feedback';
import { Page } from '../components/Layout';
import { TransactionModal, DeleteTransactionModal } from '../components/shared/TransactionModal';

const typeIcons: Record<AccountType, typeof Wallet> = {
  bank: Landmark,
  savings: PiggyBank,
  premium_bonds: Award,
  pension: Wallet,
  credit: CreditCard,
  property: Home,
  isa: PiggyBank,
};

interface DashboardProps {
  onNavigate: (p: Page) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { accounts, updates, transactions, winnings, interestRecords, outgoings, loading } = useFinance();
  const [includeProperty, setIncludeProperty] = useState(false);
  const [incomeYear, setIncomeYear] = useState(new Date().getFullYear());
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [confirmDeleteTx, setConfirmDeleteTx] = useState<Transaction | null>(null);

  const openEditTx = (tx: Transaction) => { setEditingTx(tx); setTxModalOpen(true); };
  const openDeleteTx = (tx: Transaction) => setConfirmDeleteTx(tx);

  // Separate credit accounts — never included in net worth
  const creditAccounts = accounts.filter((a) => a.type === 'credit');
  const creditTotalOwed = creditAccounts.reduce((s, a) => s + Math.min(Number(a.current_value), 0), 0);
  const financialAccounts = accounts.filter((a) => !EXCLUDED_FROM_NET_WORTH.includes(a.type));

  const propertyValue = financialAccounts.filter((a) => a.type === 'property').reduce((s, a) => s + Number(a.current_value), 0);
  const liquidAssets = financialAccounts.filter((a) => a.type !== 'property').reduce((s, a) => s + Number(a.current_value), 0);
  const netWorth = liquidAssets + propertyValue;

  // Cash assets: always excludes pension tax liability
  const pensionTaxTotal = accounts
    .filter((a) => a.type === 'pension')
    .reduce((s, a) => s + Number(a.estimated_tax_liability || 0), 0);
  const cashAssets = (includeProperty ? liquidAssets + propertyValue : liquidAssets) - pensionTaxTotal;

  const totalMonthlyOutgoings = outgoings.reduce((s, o) => s + Number(o.amount), 0);

  const breakdown = useMemo(() => {
    const byType: Partial<Record<AccountType, number>> = {};
    for (const a of financialAccounts) {
      byType[a.type] = (byType[a.type] ?? 0) + Number(a.current_value);
    }
    return byType;
  }, [financialAccounts]);

  // Year-over-year change
  const yearAgoStr = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().slice(0, 10);
  }, []);

  const yearAgoNetWorth = useMemo(() => {
    let total = 0;
    for (const acc of financialAccounts) {
      const accUpdates = updates
        .filter((u) => u.account_id === acc.id && u.recorded_date <= yearAgoStr)
        .sort((a, b) => a.recorded_date.localeCompare(b.recorded_date));
      if (accUpdates.length > 0) total += Number(accUpdates[accUpdates.length - 1].balance);
    }
    return total;
  }, [updates, financialAccounts, yearAgoStr]);

  const yoyChange = netWorth - yearAgoNetWorth;
  const yoyPercent = yearAgoNetWorth > 0 ? (yoyChange / yearAgoNetWorth) * 100 : 0;

  // Monthly gains/losses (last 12 months, from adjustments)
  // YTD income — uses selected year
  const yearStart = `${incomeYear}-01-01`;
  const yearEnd = `${incomeYear}-12-31`;
  const ytdWinnings = useMemo(() => winnings.filter((w) => w.date >= yearStart && w.date <= yearEnd).reduce((s, w) => s + Number(w.amount), 0), [winnings, yearStart, yearEnd]);
  const ytdInterest = useMemo(() => interestRecords.filter((r) => r.date >= yearStart && r.date <= yearEnd).reduce((s, r) => s + Number(r.amount), 0), [interestRecords, yearStart, yearEnd]);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(new Date().getFullYear());
    for (const r of interestRecords) years.add(new Date(r.date.slice(0, 10)).getFullYear());
    for (const w of winnings) years.add(new Date(w.date.slice(0, 10)).getFullYear());
    return [...years].sort((a, b) => b - a);
  }, [interestRecords, winnings]);

  const monthlyIncomeSeries = useMemo(() => {
    const byMonth: Record<string, { interest: number; winnings: number }> = {};
    for (let m = 0; m < 12; m++) {
      const d = new Date(incomeYear, m, 1);
      byMonth[d.toISOString().slice(0, 7)] = { interest: 0, winnings: 0 };
    }
    for (const r of interestRecords) { if (byMonth[r.date.slice(0, 7)]) byMonth[r.date.slice(0, 7)].interest += Number(r.amount); }
    for (const w of winnings)        { if (byMonth[w.date.slice(0, 7)]) byMonth[w.date.slice(0, 7)].winnings += Number(w.amount); }
    return Object.entries(byMonth).map(([month, vals]) => ({
      label: new Date(month + '-01').toLocaleDateString('en-GB', { month: 'short' }),
      interest: Math.round(vals.interest),
      winnings: Math.round(vals.winnings),
    }));
  }, [interestRecords, winnings, incomeYear]);

  const recentTransactions = useMemo(
    () => [...transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5),
    [transactions]
  );

  if (loading) return null;

  const cashGradient = includeProperty
    ? 'from-green-700 to-green-900'
    : 'from-green-600 to-green-800';

  return (
    <div className="space-y-5">
      {/* Cash Assets hero */}
      <div className={`rounded-2xl bg-gradient-to-br ${cashGradient} p-5 text-white shadow-sm transition-all duration-300`}>
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-medium text-green-100">Cash Assets</p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-green-200 font-medium">
              {includeProperty ? 'Incl. Property' : 'Excl. Property'}
            </span>
            <button
              onClick={() => setIncludeProperty((p) => !p)}
              className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                includeProperty ? 'bg-white/30' : 'bg-white/15'
              }`}
              role="switch"
              aria-checked={includeProperty}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  includeProperty ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
        <p className="text-4xl font-bold tracking-tight">{formatGBPFull(cashAssets)}</p>
        {yearAgoNetWorth > 0 && (
          <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t border-white/20">
            <p className="text-xs text-green-100 mr-2">vs last year</p>
            <p className={`text-sm font-bold flex items-center gap-1 ${
              yoyChange >= 0 ? 'text-white' : 'text-red-200'
            }`}>
              {yoyChange >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              {formatGBP(Math.abs(yoyChange), { compact: true })} ({formatPercent(yoyPercent)})
            </p>
          </div>
        )}
      </div>

      {/* Tax Liability — strong red panel for pension tax owed */}
      {pensionTaxTotal > 0 && (
        <div className="rounded-2xl bg-gradient-to-br from-red-600 to-red-800 p-4 text-white shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-red-100">Estimated Tax Liabilities All Pension Accts</p>
              <p className="text-2xl font-bold tracking-tight mt-0.5">{formatGBP(pensionTaxTotal)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Monthly Outgoings — distinct darker emerald card */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-800 to-emerald-950 p-4 text-white shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-emerald-200">Monthly Outgoings</p>
            <p className="text-2xl font-bold tracking-tight mt-0.5">{formatGBP(totalMonthlyOutgoings)} <span className="text-sm font-normal text-emerald-300">per month</span></p>
            <p className="text-sm font-medium text-emerald-100 mt-2 pt-2 border-t border-white/20">
              Annual Outgoings: {formatGBP(totalMonthlyOutgoings * 12)} <span className="text-xs font-normal text-emerald-300">per year</span>
            </p>
          </div>
        </div>
      </div>

      {accounts.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Wallet size={40} />}
            title="No accounts yet"
            message="Add your first account to start tracking your net worth."
            action={<button onClick={() => onNavigate('accounts')} className="text-sm font-medium text-brand-600 dark:text-brand-400">Add an account →</button>}
          />
        </Card>
      ) : (
        <>
          {/* Account type breakdown cards (financial only, no credit) */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {(Object.keys(breakdown) as AccountType[]).map((t) => {
              if (!breakdown[t] && breakdown[t] !== 0) return null;
              const Icon = typeIcons[t];
              return (
                <Card key={t} className="p-4" style={{ backgroundColor: ACCOUNT_TYPE_COLORS[t] + '15', borderColor: ACCOUNT_TYPE_COLORS[t] + '30' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: ACCOUNT_TYPE_COLORS[t] + '25' }}>
                      <Icon size={16} style={{ color: ACCOUNT_TYPE_COLORS[t] }} />
                    </div>
                    <span className="text-xs font-medium text-ink-600 dark:text-ink-300">{ACCOUNT_TYPE_LABELS[t]}</span>
                  </div>
                  <p className="text-lg font-bold text-ink-900 dark:text-ink-50">{formatGBP(breakdown[t]!, { compact: true })}</p>
                </Card>
              );
            })}
            {/* Credit accounts — combined total card, same format as other types */}
            {creditAccounts.length > 0 && (
              <Card className="p-4" style={{ backgroundColor: ACCOUNT_TYPE_COLORS.credit + '15', borderColor: ACCOUNT_TYPE_COLORS.credit + '30' }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: ACCOUNT_TYPE_COLORS.credit + '25' }}>
                    <CreditCard size={16} style={{ color: ACCOUNT_TYPE_COLORS.credit }} />
                  </div>
                  <span className="text-xs font-medium text-ink-600 dark:text-ink-300">{ACCOUNT_TYPE_LABELS.credit}</span>
                </div>
                <p className="text-lg font-bold text-red-500">{formatGBP(creditTotalOwed, { compact: true })}</p>
              </Card>
            )}
          </div>

          {/* Additional Income */}
          <Card>
            <CardHeader title="Additional Income" subtitle={`${incomeYear} passive income`} icon={<Gift size={16} />} action={
              <div className="flex items-center gap-1">
                {availableYears.map((y) => (
                  <button key={y} onClick={() => setIncomeYear(y)}
                    className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                      incomeYear === y ? 'bg-brand-600 text-white' : 'text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800'
                    }`}>{y}</button>
                ))}
              </div>
            } />
            <div className="px-5 pb-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Award size={14} className="text-amber-500" />
                    <span className="text-xs font-medium text-ink-500 dark:text-ink-400">Bond Winnings</span>
                  </div>
                  <p className="text-base font-bold text-ink-900 dark:text-ink-50">{formatGBP(ytdWinnings, { compact: true })}</p>
                </div>
                <div className="rounded-xl bg-brand-50 dark:bg-brand-900/20 p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Percent size={14} className="text-brand-500" />
                    <span className="text-xs font-medium text-ink-500 dark:text-ink-400">Interest</span>
                  </div>
                  <p className="text-base font-bold text-ink-900 dark:text-ink-50">{formatGBP(ytdInterest, { compact: true })}</p>
                </div>
                <div className="rounded-xl bg-green-50 dark:bg-green-950/20 p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <TrendingUp size={14} className="text-green-500" />
                    <span className="text-xs font-medium text-ink-500 dark:text-ink-400">Combined</span>
                  </div>
                  <p className="text-base font-bold text-ink-900 dark:text-ink-50">{formatGBP(ytdWinnings + ytdInterest, { compact: true })}</p>
                </div>
              </div>
            </div>
            {monthlyIncomeSeries.some((m) => m.interest > 0 || m.winnings > 0) && (
              <div className="px-3 pb-4">
                <p className="text-xs font-medium text-ink-500 dark:text-ink-400 px-2 mb-1">Monthly income ({incomeYear})</p>
                <StackedBarChart data={monthlyIncomeSeries} />
              </div>
            )}
          </Card>

          {/* Recent Events */}
          <Card>
            <CardHeader title="Recent Events" icon={<Wallet size={16} />} action={
              <button onClick={() => onNavigate('transactions')} className="text-xs font-medium text-brand-600 dark:text-brand-400">View all</button>
            } />
            {recentTransactions.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-ink-400">No events recorded yet.</p>
            ) : (
              <div className="max-h-[240px] overflow-y-auto overscroll-contain divide-y divide-ink-100 dark:divide-ink-800">
                {recentTransactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between px-5 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink-800 dark:text-ink-100 truncate">{tx.description}</p>
                      <p className="text-xs text-ink-400">{formatDate(tx.date)}</p>
                      {tx.note && <p className="text-xs text-ink-400 mt-0.5 italic truncate">{tx.note}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-3">
                      <span className={`text-sm font-semibold ${tx.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                        {formatGBP(tx.amount, { sign: true })}
                      </span>
                      <button onClick={() => openEditTx(tx)} className="p-1.5 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-400 transition-colors">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => openDeleteTx(tx)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-ink-400 hover:text-red-500 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      <TransactionModal open={txModalOpen} onClose={() => setTxModalOpen(false)} editing={editingTx} />
      <DeleteTransactionModal transaction={confirmDeleteTx} onClose={() => setConfirmDeleteTx(null)} />
    </div>
  );
}

