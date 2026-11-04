import { useState, useEffect, useMemo } from 'react';
import { TrendingUp, Wallet, Flame, PiggyBank, Clock, ArrowUpRight, ArrowDownRight, Award, Percent, Coins } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { supabase } from '../lib/supabase';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { formatGBP, formatGBPFull } from '../lib/format';
import { EXCLUDED_FROM_NET_WORTH, INCOME_TYPE_LABELS } from '../lib/types';

export function RetirementPage() {
  const { accounts, settings, winnings, interestRecords, historicalData, additionalIncomeSources, additionalIncomeEntries, refresh } = useFinance();
  const [annualSpending, setAnnualSpending] = useState('0');
  const [spendingOverridden, setSpendingOverridden] = useState(false);
  const [firePension, setFirePension] = useState('0');
  const [privateDrawdown, setPrivateDrawdown] = useState('0');
  const [busy, setBusy] = useState(false);
  const [positionYear, setPositionYear] = useState(new Date().getFullYear());

  // Auto-calculate average yearly spend from historical data
  const avgYearlySpend = useMemo(() => {
    const sorted = [...historicalData].sort((a, b) => a.year - b.year);
    const decreases: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const change = Number(sorted[i].year_start_balance) - Number(sorted[i - 1].year_start_balance);
      if (change < 0) decreases.push(Math.abs(change));
    }
    if (decreases.length === 0) return 0;
    return decreases.reduce((s, v) => s + v, 0) / decreases.length;
  }, [historicalData]);

  useEffect(() => {
    if (settings) {
      setAnnualSpending(String(settings.annual_spending));
      setFirePension(String(settings.fire_pension_income));
      setPrivateDrawdown(String(settings.private_pension_drawdown));
    }
  }, [settings]);

  // Auto-update spending from historical data unless user has overridden
  useEffect(() => {
    if (!spendingOverridden && avgYearlySpend > 0) {
      setAnnualSpending(String(Math.round(avgYearlySpend)));
    }
  }, [avgYearlySpend, spendingOverridden]);

  const totalAssets = accounts.filter((a) => !EXCLUDED_FROM_NET_WORTH.includes(a.type)).reduce((s, a) => s + Number(a.current_value), 0);
  const propertyTotal = accounts.filter((a) => a.type === 'property').reduce((s, a) => s + Number(a.current_value), 0);
  const cashAssets = totalAssets - propertyTotal;
  const pensionAccounts = accounts.filter((a) => a.type === 'pension');
  const pensionTotal = pensionAccounts.reduce((s, a) => s + Number(a.current_value), 0);

  const spending = parseFloat(annualSpending) || 0;
  const fireIncome = parseFloat(firePension) || 0;
  const drawdown = parseFloat(privateDrawdown) || 0;

  // Bond winnings: prefer historical data (more accurate annual totals); fall back to live records
  const annualBondWinnings = useMemo(() => {
    if (historicalData.length > 0) {
      const total = historicalData.reduce((s, h) => s + Number(h.bond_winnings), 0);
      return total / historicalData.length;
    }
    if (winnings.length === 0) return 0;
    const total = winnings.reduce((s, w) => s + Number(w.amount), 0);
    const years = new Set(winnings.map((w) => new Date(w.date).getFullYear())).size;
    return total / Math.max(years, 1);
  }, [historicalData, winnings]);

  // Additional income: bank interest (annual average from records)
  const totalInterest = interestRecords.reduce((s, r) => s + Number(r.amount), 0);
  const intYears = interestRecords.length > 0 ? new Set(interestRecords.map((r) => new Date(r.date).getFullYear())).size : 1;
  const annualBankInterest = intYears > 0 ? totalInterest / intYears : 0;

  // Fire Service Pension = genuine income (paid externally, not from your accounts)
  // Private Pension Drawdown = withdrawal from existing pension account balance (NOT additional income)
  const additionalIncome = annualBondWinnings + annualBankInterest;

  // Additional income sources applicable to the selected year
  const yearAdditionalIncome = useMemo(() => {
    return additionalIncomeSources
      .map((src) => {
        const entry = additionalIncomeEntries.find((e) => e.source_id === src.id && e.year === positionYear);
        return entry ? { source: src, amount: Number(entry.amount) } : null;
      })
      .filter((x): x is { source: typeof additionalIncomeSources[0]; amount: number } => x !== null);
  }, [additionalIncomeSources, additionalIncomeEntries, positionYear]);
  const yearAdditionalIncomeTotal = yearAdditionalIncome.reduce((s, x) => s + x.amount, 0);

  const annualIncome = fireIncome + additionalIncome + yearAdditionalIncomeTotal;
  const netAnnualPosition = annualIncome - spending;
  // Exclude property from coverable assets — only liquid/cash assets
  const drawdownAssets = Math.max(0, cashAssets - pensionTotal);
  // Shortfall is covered by: drawdown from pension + depletion of non-pension assets
  const annualShortfall = Math.max(0, spending - annualIncome);
  // Total cash/pension assets available to cover shortfall (property excluded)
  const totalCoverableAssets = pensionTotal + drawdownAssets;
  const totalAnnualDraw = annualShortfall + drawdown;

  // Estimate time until funds run out
  let yearsUntilDepletion: number | null = null;
  if (totalAnnualDraw > 0 && totalCoverableAssets > 0) {
    yearsUntilDepletion = Math.round(totalCoverableAssets / totalAnnualDraw);
  } else if (totalAnnualDraw > 0 && totalCoverableAssets === 0) {
    yearsUntilDepletion = 0;
  } else {
    yearsUntilDepletion = null; // sustainable
  }

  const saveSettings = async () => {
    setBusy(true);
    const payload = {
      annual_spending: parseFloat(annualSpending) || 0,
      fire_pension_income: parseFloat(firePension) || 0,
      private_pension_drawdown: parseFloat(privateDrawdown) || 0,
      updated_at: new Date().toISOString(),
    };
    if (settings) {
      await supabase.from('settings').update(payload).eq('id', settings.id);
    } else {
      await supabase.from('settings').insert(payload);
    }
    await refresh();
    setBusy(false);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-ink-900 dark:text-ink-50">Retirement Overview</h1>
        <p className="text-sm text-ink-400">Projection & sustainability</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <Wallet size={16} className="text-brand-500" />
            <span className="text-xs font-medium text-ink-500 dark:text-ink-400">Total Assets</span>
          </div>
          <p className="text-lg font-bold text-ink-900 dark:text-ink-50">{formatGBP(totalAssets, { compact: true })}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <PiggyBank size={16} className="text-purple-500" />
            <span className="text-xs font-medium text-ink-500 dark:text-ink-400">Pension Value</span>
          </div>
          <p className="text-lg font-bold text-ink-900 dark:text-ink-50">{formatGBP(pensionTotal, { compact: true })}</p>
        </Card>
      </div>

      {/* Projection inputs */}
      <Card>
        <CardHeader title="Projection Inputs" icon={<TrendingUp size={16} />} />
        <div className="px-5 pb-5 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-ink-700 dark:text-ink-200">Annual spending estimate</label>
              {spendingOverridden ? (
                <button onClick={() => { setSpendingOverridden(false); setAnnualSpending(String(Math.round(avgYearlySpend))); }} className="text-xs font-medium text-brand-600 dark:text-brand-400">
                  Reset to auto
                </button>
              ) : (
                avgYearlySpend > 0 && <span className="text-xs text-ink-400">Auto from historical data</span>
              )}
            </div>
            <Input type="number" inputMode="decimal" prefix="£" value={annualSpending} onChange={(e) => { setAnnualSpending(e.target.value); setSpendingOverridden(true); }} placeholder="e.g. 35000" />
          </div>
          <Input label="Fire service pension (annual)" type="number" inputMode="decimal" prefix="£" value={firePension} onChange={(e) => setFirePension(e.target.value)} placeholder="e.g. 18000" hint="Fixed pension income" />
          <Input label="Private pension drawdown (annual)" type="number" inputMode="decimal" prefix="£" value={privateDrawdown} onChange={(e) => setPrivateDrawdown(e.target.value)} placeholder="e.g. 12000" hint="Withdrawal from your pension pot — not additional income" />
          <Button onClick={saveSettings} disabled={busy} size="sm">{busy ? 'Saving…' : 'Save projection'}</Button>
        </div>
      </Card>

      {/* Results */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between p-5 pb-3">
          <h3 className="font-semibold text-ink-900 dark:text-ink-50 text-sm">Annual Position</h3>
          <Select value={positionYear} onChange={(e) => setPositionYear(parseInt(e.target.value))} className="w-auto text-xs py-1.5">
            {Array.from({ length: 30 }, (_, i) => new Date().getFullYear() - 10 + i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </Select>
        </div>
        <div className="px-5 pb-5 space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-ink-100 dark:border-ink-800">
            <div className="flex items-center gap-2">
              <Flame size={16} className="text-orange-500" />
              <span className="text-sm text-ink-600 dark:text-ink-300">Fire service pension</span>
            </div>
            <span className="text-sm font-semibold text-green-600 dark:text-green-400">+{formatGBPFull(fireIncome)}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-ink-100 dark:border-ink-800">
            <div className="flex items-center gap-2">
              <Award size={16} className="text-amber-500" />
              <span className="text-sm text-ink-600 dark:text-ink-300">Premium bond winnings (avg/yr)</span>
            </div>
            <span className="text-sm font-semibold text-green-600 dark:text-green-400">+{formatGBPFull(annualBondWinnings)}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-ink-100 dark:border-ink-800">
            <div className="flex items-center gap-2">
              <Percent size={16} className="text-brand-500" />
              <span className="text-sm text-ink-600 dark:text-ink-300">Bank interest (avg/yr)</span>
            </div>
            <span className="text-sm font-semibold text-green-600 dark:text-green-400">+{formatGBPFull(annualBankInterest)}</span>
          </div>
          {yearAdditionalIncome.map(({ source, amount }) => (
            <div key={source.id} className="flex items-center justify-between py-2 border-b border-ink-100 dark:border-ink-800">
              <div className="flex items-center gap-2 min-w-0">
                <Coins size={16} className="text-brand-500 shrink-0" />
                <span className="text-sm text-ink-600 dark:text-ink-300 truncate">{source.name} <span className="text-xs text-ink-400">({INCOME_TYPE_LABELS[source.income_type]})</span></span>
              </div>
              <span className="text-sm font-semibold text-green-600 dark:text-green-400 shrink-0">+{formatGBPFull(amount)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between py-2 border-b border-ink-100 dark:border-ink-800">
            <div className="flex items-center gap-2">
              <ArrowUpRight size={16} className="text-green-500" />
              <span className="text-sm font-medium text-ink-700 dark:text-ink-200">Total annual income</span>
            </div>
            <span className="text-sm font-bold text-green-600 dark:text-green-400">{formatGBPFull(annualIncome)}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-ink-100 dark:border-ink-800">
            <div className="flex items-center gap-2">
              <ArrowDownRight size={16} className="text-red-500" />
              <span className="text-sm text-ink-600 dark:text-ink-300">Annual spending</span>
            </div>
            <span className="text-sm font-semibold text-red-500">−{formatGBPFull(spending)}</span>
          </div>

          {/* Net annual surplus/deficit */}
          <div className={`rounded-xl p-4 mt-2 ${netAnnualPosition >= 0 ? 'bg-green-50 dark:bg-green-950/30' : 'bg-red-50 dark:bg-red-950/30'}`}>
            <p className="text-xs font-medium text-ink-500 dark:text-ink-400">
              {netAnnualPosition >= 0 ? 'Net annual surplus' : 'Net annual deficit'}
            </p>
            <p className={`text-2xl font-bold mt-1 ${netAnnualPosition >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
              {formatGBP(Math.abs(netAnnualPosition), { sign: netAnnualPosition < 0 })}
            </p>
            <p className="text-xs text-ink-400 mt-1">
              {netAnnualPosition >= 0
                ? 'Your income covers your spending — assets can grow or be drawn down optionally.'
                : 'Your income does not cover spending — you must draw down savings to cover the gap.'}
            </p>
          </div>

          {/* Drawdown impact */}
          {drawdown > 0 && (
            <div className="rounded-xl p-4 mt-2 bg-amber-50 dark:bg-amber-950/20">
              <p className="text-xs font-medium text-ink-500 dark:text-ink-400">Private pension drawdown (asset depletion)</p>
              <p className="text-lg font-bold mt-1 text-amber-600 dark:text-amber-400">
                {formatGBPFull(drawdown)}/yr withdrawn from pension pot
              </p>
              <p className="text-xs text-ink-400 mt-1">
                {pensionTotal > 0
                  ? `Pension pot of ${formatGBP(pensionTotal, { compact: true })} included in coverable assets above.`
                  : 'No pension pot balance recorded — drawdown is not reflected in depletion calc.'}
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Time until depletion */}
      <Card className="overflow-hidden">
        <div className={`p-5 ${yearsUntilDepletion === null ? 'bg-green-50 dark:bg-green-950/20' : yearsUntilDepletion > 20 ? 'bg-brand-50 dark:bg-brand-900/20' : 'bg-amber-50 dark:bg-amber-950/20'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Clock size={18} className={yearsUntilDepletion === null ? 'text-green-500' : yearsUntilDepletion > 20 ? 'text-brand-500' : 'text-amber-500'} />
            <span className="text-sm font-medium text-ink-600 dark:text-ink-300">Estimated time until funds run out</span>
          </div>
          {yearsUntilDepletion === null ? (
            <>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">Sustainable</p>
              <p className="text-xs text-ink-400 mt-1">Your income covers spending without depleting savings.</p>
            </>
          ) : yearsUntilDepletion === 0 ? (
            <>
              <p className="text-3xl font-bold text-red-500">Now</p>
              <p className="text-xs text-ink-400 mt-1">No assets available to cover the shortfall.</p>
            </>
          ) : (
            <>
              <p className="text-3xl font-bold text-ink-900 dark:text-ink-50">{yearsUntilDepletion} year{yearsUntilDepletion !== 1 ? 's' : ''}</p>
              <p className="text-xs text-ink-400 mt-1">
                Based on {formatGBP(totalCoverableAssets, { compact: true })} in cash/pension assets (property excluded) and an annual draw of {formatGBP(totalAnnualDraw, { compact: true })} (shortfall {formatGBP(annualShortfall, { compact: true })} + drawdown {formatGBP(drawdown, { compact: true })}).
              </p>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
