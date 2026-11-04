import { useMemo } from 'react';
import { TrendingUp, Receipt } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { Card, CardHeader } from '../components/ui/Card';
import { DonutChart, DonutLegend } from '../components/charts/DonutChart';
import { formatGBP } from '../lib/format';
import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_COLORS, AccountType, EXCLUDED_FROM_NET_WORTH } from '../lib/types';

export function BreakdownsPage() {
  const { accounts, outgoings, loading } = useFinance();

  // Exclude credit accounts from financial breakdown
  const financialAccounts = accounts.filter((a) => !EXCLUDED_FROM_NET_WORTH.includes(a.type));

  const breakdown = useMemo(() => {
    const byType: Partial<Record<AccountType, number>> = {};
    for (const a of financialAccounts) {
      byType[a.type] = (byType[a.type] ?? 0) + Number(a.current_value);
    }
    return byType;
  }, [financialAccounts]);

  const cashAssets = financialAccounts.filter((a) => a.type !== 'property').reduce((s, a) => s + Number(a.current_value), 0);
  const totalMonthlyOutgoings = outgoings.reduce((s, o) => s + Number(o.amount), 0);

  const cashDonutData = (Object.keys(breakdown) as AccountType[])
    .filter((t) => t !== 'property' && !EXCLUDED_FROM_NET_WORTH.includes(t) && (breakdown[t] ?? 0) > 0)
    .map((t) => ({ label: ACCOUNT_TYPE_LABELS[t], value: breakdown[t]!, color: ACCOUNT_TYPE_COLORS[t] }));

  const outgoingDonutData = useMemo(() => {
    if (outgoings.length === 0) return [];
    const palette = ['#338cff', '#f59e0b', '#22c55e', '#a855f7', '#ef4444', '#14b8a6', '#f97316', '#6366f1', '#ec4899', '#84cc16', '#06b6d4', '#eab308'];
    return outgoings
      .map((o, i) => ({ label: o.name, value: Number(o.amount), color: palette[i % palette.length] }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [outgoings]);

  if (loading) return null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink-900 dark:text-ink-50">Breakdowns</h1>
        <p className="text-sm text-ink-400 mt-0.5">Detailed breakdown of your assets and spending</p>
      </div>

      <Card>
        <CardHeader title="Cash Assets Breakdown" icon={<TrendingUp size={16} />} />
        <div className="flex flex-col sm:flex-row items-center gap-6 px-5 pb-5">
          {cashDonutData.length > 0 ? (
            <>
              <DonutChart data={cashDonutData} centerLabel="Cash" centerValue={formatGBP(cashAssets, { compact: true })} />
              <div className="flex-1 w-full">
                <DonutLegend data={cashDonutData} />
              </div>
            </>
          ) : (
            <p className="text-sm text-ink-400 py-8 text-center w-full">No accounts yet. Add accounts to see the breakdown.</p>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Monthly Expenditure Breakdown" icon={<Receipt size={16} />} />
        <div className="flex flex-col sm:flex-row items-center gap-6 px-5 pb-5">
          {outgoingDonutData.length > 0 ? (
            <>
              <DonutChart data={outgoingDonutData} centerLabel="Monthly" centerValue={formatGBP(totalMonthlyOutgoings, { compact: true })} />
              <div className="flex-1 w-full">
                <DonutLegend data={outgoingDonutData} />
              </div>
            </>
          ) : (
            <p className="text-sm text-ink-400 py-8 text-center w-full">No outgoings recorded yet. Add regular outgoings to see your monthly expenditure breakdown.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
