import { useState, useMemo } from 'react';
import { History, Plus, Trash2, TrendingUp, Pencil, ArrowDownRight } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { supabase } from '../lib/supabase';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/Feedback';
import { AreaChart } from '../components/charts/AreaChart';
import { formatGBP, formatPercent, parseAmount } from '../lib/format';
import { HistoricalData } from '../lib/types';

type SectionId = 'balanceChange' | 'yearlyData' | 'balanceGraph' | 'fireGraph' | 'bondGraph';

const sectionLabels: { id: SectionId; label: string }[] = [
  { id: 'balanceChange', label: 'Balance & Change' },
  { id: 'yearlyData',    label: 'Yearly Data' },
  { id: 'balanceGraph',  label: 'Balance Graph' },
  { id: 'fireGraph',     label: 'Fire Pension Graph' },
  { id: 'bondGraph',     label: 'Bond Winnings Graph' },
];

export function HistoricalPage() {
  const { historicalData, refresh, loading } = useFinance();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<HistoricalData | null>(null);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [firePension, setFirePension] = useState('');
  const [bondWinnings, setBondWinnings] = useState('');
  const [yearStartBalance, setYearStartBalance] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<HistoricalData | null>(null);

  // Single-select: only one section visible at a time; default = balanceChange
  const [activeSection, setActiveSection] = useState<SectionId>('balanceChange');

  const sorted = [...historicalData].sort((a, b) => b.year - a.year);
  const chartSorted = [...historicalData].sort((a, b) => a.year - b.year);

  const openAdd = () => {
    setEditing(null);
    setYear(String(new Date().getFullYear()));
    setFirePension('');
    setBondWinnings('');
    setYearStartBalance('');
    setModalOpen(true);
  };

  const openEdit = (h: HistoricalData) => {
    setEditing(h);
    setYear(String(h.year));
    setFirePension(String(h.fire_pension));
    setBondWinnings(String(h.bond_winnings));
    setYearStartBalance(String(h.year_start_balance));
    setModalOpen(true);
  };

  const save = async () => {
    setBusy(true);
    const payload = {
      year: parseInt(year),
      fire_pension: parseAmount(firePension),
      bond_winnings: parseAmount(bondWinnings),
      year_start_balance: parseAmount(yearStartBalance),
      updated_at: new Date().toISOString(),
    };
    if (editing) {
      await supabase.from('historical_data').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('historical_data').insert(payload);
    }
    await refresh();
    setBusy(false);
    setModalOpen(false);
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    await supabase.from('historical_data').delete().eq('id', confirmDelete.id);
    await refresh();
    setBusy(false);
    setConfirmDelete(null);
  };

  const pctIncrease = (first: number, last: number) => {
    if (first === 0) return null;
    return ((last - first) / first) * 100;
  };

  const firePct    = chartSorted.length >= 2 ? pctIncrease(Number(chartSorted[0].fire_pension),       Number(chartSorted[chartSorted.length - 1].fire_pension))       : null;
  const bondPct    = chartSorted.length >= 2 ? pctIncrease(Number(chartSorted[0].bond_winnings),       Number(chartSorted[chartSorted.length - 1].bond_winnings))       : null;
  const balancePct = chartSorted.length >= 2 ? pctIncrease(Number(chartSorted[0].year_start_balance),  Number(chartSorted[chartSorted.length - 1].year_start_balance))  : null;

  const fireChart    = useMemo(() => chartSorted.map((h) => ({ label: String(h.year), value: Number(h.fire_pension) })),       [chartSorted]);
  const bondChart    = useMemo(() => chartSorted.map((h) => ({ label: String(h.year), value: Number(h.bond_winnings) })),      [chartSorted]);
  const balanceChart = useMemo(() => chartSorted.map((h) => ({ label: String(h.year), value: Number(h.year_start_balance) })), [chartSorted]);

  // Yearly change: current year total minus previous year total.
  // sorted is descending (most recent first), so previous year is at i + 1.
  const yearlyChanges = useMemo(() =>
    sorted.map((h, i) => {
      if (i === sorted.length - 1) return { year: h.year, change: null as number | null, prevTotal: null as number | null };
      const prev = sorted[i + 1];
      const prevTotal = Number(prev.year_start_balance);
      return { year: h.year, change: Number(h.year_start_balance) - prevTotal, prevTotal };
    }),
    [sorted]
  );

  const avgYearlyDrawdown = useMemo(() => {
    const valid = yearlyChanges.filter((y) => y.change !== null).map((y) => y.change!);
    if (valid.length === 0) return 0;
    return valid.reduce((s, v) => s + v, 0) / valid.length;
  }, [yearlyChanges]);

  const drawdownColors = avgYearlyDrawdown < 0
    ? { bg: 'bg-gradient-to-br from-red-600 to-red-800', text: 'text-white', sub: 'text-red-100', label: 'text-red-50', icon: 'text-red-100' }
    : avgYearlyDrawdown > 0
    ? { bg: 'bg-gradient-to-br from-green-600 to-green-800', text: 'text-white', sub: 'text-green-100', label: 'text-green-50', icon: 'text-green-100' }
    : { bg: 'bg-ink-100 dark:bg-ink-800', text: 'text-ink-900 dark:text-ink-50', sub: 'text-ink-500 dark:text-ink-400', label: 'text-ink-500 dark:text-ink-400', icon: 'text-ink-400' };

  if (loading) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink-900 dark:text-ink-50">Historical Data</h1>
          <p className="text-sm text-ink-400">Yearly values & long-term trends</p>
        </div>
        <Button onClick={openAdd} size="sm"><Plus size={16} /> Add year</Button>
      </div>

      {sorted.length === 0 ? (
        <Card>
          <EmptyState
            icon={<History size={40} />}
            title="No historical data yet"
            message="Enter yearly values for fire service pension, bond winnings, and year-start balances to track long-term trends."
            action={<Button onClick={openAdd} size="sm"><Plus size={16} /> Add first year</Button>}
          />
        </Card>
      ) : (
        <>
          {/* Average Yearly Drawdown — green gradient matching Cash Assets */}
          <div className={`rounded-2xl ${drawdownColors.bg} p-5 ${drawdownColors.text} shadow-sm`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <ArrowDownRight size={18} className={drawdownColors.icon} />
                  <span className={`text-sm font-medium ${drawdownColors.label}`}>Average Yearly Drawdown From Cash Assets</span>
                </div>
                <p className="text-3xl font-bold tracking-tight">{formatGBP(avgYearlyDrawdown, { sign: true })}</p>
                <p className={`text-xs ${drawdownColors.sub} mt-1`}>
                  Average of {yearlyChanges.filter((y) => y.change !== null).length} yearly change{yearlyChanges.filter((y) => y.change !== null).length !== 1 ? 's' : ''} across {sorted.length} year{sorted.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="text-right">
                <span className={`text-xs font-medium ${drawdownColors.label}`}>Years tracked</span>
                <p className="text-2xl font-bold">{sorted.length}</p>
              </div>
            </div>
          </div>

          {/* Section selector — single-select tab pills */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {sectionLabels.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors shrink-0 ${
                  activeSection === s.id
                    ? 'bg-brand-600 text-white'
                    : 'bg-ink-100 dark:bg-ink-800 text-ink-500 dark:text-ink-400 hover:bg-ink-200 dark:hover:bg-ink-700'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Year-start balance table with yearly change */}
          {activeSection === 'balanceChange' && (
            <Card>
              <div className="p-5 pb-3">
                <h3 className="font-semibold text-ink-900 dark:text-ink-50 text-sm">Year-Start Balance & Yearly Change</h3>
              </div>
              <div className="max-h-[400px] overflow-y-auto overscroll-contain">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white dark:bg-ink-900 z-10">
                    <tr className="border-b border-ink-100 dark:border-ink-800 text-xs text-ink-400">
                      <th className="text-left font-medium px-5 py-2">Year</th>
                      <th className="text-right font-medium px-3 py-2">Start Balance</th>
                      <th className="text-right font-medium px-3 py-2">Yearly Change</th>
                      <th className="px-3 py-2 w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((h, i) => {
                      const yc = yearlyChanges[i];
                      const change = yc.change;
                      const pct = change !== null && yc.prevTotal !== null && yc.prevTotal !== 0
                        ? (change / yc.prevTotal) * 100
                        : null;
                      return (
                        <tr
                          key={h.id}
                          className="border-b border-ink-50 dark:border-ink-850 hover:bg-ink-50 dark:hover:bg-ink-850/50 transition-colors cursor-pointer"
                          onClick={() => openEdit(h)}
                        >
                          <td className="px-5 py-3 font-medium text-ink-900 dark:text-ink-50">{h.year}</td>
                          <td className="text-right px-3 py-3 text-ink-700 dark:text-ink-200">{formatGBP(Number(h.year_start_balance))}</td>
                          <td className="text-right px-3 py-3 whitespace-nowrap">
                            {change === null ? (
                              <span className="text-ink-300 dark:text-ink-600">—</span>
                            ) : (
                              <span className={`font-semibold ${change > 0 ? 'text-green-600 dark:text-green-400' : change < 0 ? 'text-red-500' : 'text-ink-400'}`}>
                                {formatGBP(change, { sign: true })}
                                {pct !== null && (
                                  <span className="ml-1.5 text-xs font-medium">
                                    ({formatPercent(pct)})
                                  </span>
                                )}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => openEdit(h)} className="p-1.5 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 transition-colors" title="Edit">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => setConfirmDelete(h)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-ink-400 hover:text-red-500 transition-colors ml-1" title="Delete">
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              </div>
            </Card>
          )}

          {/* Full yearly data table */}
          {activeSection === 'yearlyData' && (
            <Card>
              <div className="p-5 pb-3">
                <h3 className="font-semibold text-ink-900 dark:text-ink-50 text-sm">Yearly Data ({sorted.length})</h3>
              </div>
              <div className="max-h-[400px] overflow-y-auto overscroll-contain">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink-100 dark:border-ink-800 text-xs text-ink-400">
                      <th className="text-left font-medium px-5 py-2">Year</th>
                      <th className="text-right font-medium px-3 py-2">Fire Pension</th>
                      <th className="text-right font-medium px-3 py-2">Bond Winnings</th>
                      <th className="text-right font-medium px-3 py-2">Year-Start Balance</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.slice(0, 10).map((h) => (
                      <tr
                        key={h.id}
                        className="border-b border-ink-50 dark:border-ink-850 hover:bg-ink-50 dark:hover:bg-ink-850/50 transition-colors cursor-pointer"
                        onClick={() => openEdit(h)}
                      >
                        <td className="px-5 py-3 font-medium text-ink-900 dark:text-ink-50">{h.year}</td>
                        <td className="text-right px-3 py-3 text-ink-700 dark:text-ink-200">{formatGBP(Number(h.fire_pension))}</td>
                        <td className="text-right px-3 py-3 text-ink-700 dark:text-ink-200">{formatGBP(Number(h.bond_winnings))}</td>
                        <td className="text-right px-3 py-3 text-ink-700 dark:text-ink-200">{formatGBP(Number(h.year_start_balance))}</td>
                        <td className="px-3 py-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => openEdit(h)} className="p-1.5 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 transition-colors" title="Edit">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => setConfirmDelete(h)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-ink-400 hover:text-red-500 transition-colors ml-1" title="Delete">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </div>
            </Card>
          )}

          {/* Trend charts */}
          {sorted.length >= 2 && (
            <>
              {activeSection === 'balanceGraph' && (
                <Card>
                  <CardHeader
                    title="Year-Start Total Balance"
                    icon={<TrendingUp size={16} />}
                    action={
                      balancePct !== null && (
                        <span className={`text-xs font-semibold ${balancePct >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                          {balancePct >= 0 ? '+' : ''}{balancePct.toFixed(1)}% since {chartSorted[0].year}
                        </span>
                      )
                    }
                  />
                  <div className="px-3 pb-4">
                    <AreaChart data={balanceChart} color="#338cff" formatValue={(v) => formatGBP(v, { compact: true })} />
                  </div>
                </Card>
              )}

              {activeSection === 'fireGraph' && (
                <Card>
                  <CardHeader
                    title="Fire Service Pension"
                    icon={<TrendingUp size={16} />}
                    action={
                      firePct !== null && (
                        <span className={`text-xs font-semibold ${firePct >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                          {firePct >= 0 ? '+' : ''}{firePct.toFixed(1)}% since {chartSorted[0].year}
                        </span>
                      )
                    }
                  />
                  <div className="px-3 pb-4">
                    <AreaChart data={fireChart} color="#a855f7" formatValue={(v) => formatGBP(v, { compact: true })} />
                  </div>
                </Card>
              )}

              {activeSection === 'bondGraph' && (
                <Card>
                  <CardHeader
                    title="Premium Bond Winnings"
                    icon={<TrendingUp size={16} />}
                    action={
                      bondPct !== null && (
                        <span className={`text-xs font-semibold ${bondPct >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                          {bondPct >= 0 ? '+' : ''}{bondPct.toFixed(1)}% since {chartSorted[0].year}
                        </span>
                      )
                    }
                  />
                  <div className="px-3 pb-4">
                    <AreaChart data={bondChart} color="#f59e0b" formatValue={(v) => formatGBP(v, { compact: true })} />
                  </div>
                </Card>
              )}
            </>
          )}
        </>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Year' : 'Add Year'}
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" fullWidth onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button fullWidth onClick={save} disabled={busy || !year}>{busy ? 'Saving…' : 'Save'}</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input label="Year" type="number" placeholder="e.g. 2024" value={year} onChange={(e) => setYear(e.target.value)} />
          <Input label="Fire service pension (annual)" type="number" inputMode="decimal" prefix="£" placeholder="0" value={firePension} onChange={(e) => setFirePension(e.target.value)} />
          <Input label="Premium Bond winnings (annual total)" type="number" inputMode="decimal" prefix="£" placeholder="0" value={bondWinnings} onChange={(e) => setBondWinnings(e.target.value)} />
          <Input label="Year-start total balance (1st January)" type="number" inputMode="decimal" prefix="£" placeholder="0" value={yearStartBalance} onChange={(e) => setYearStartBalance(e.target.value)} hint="Total net worth at the start of this year" />
        </div>
      </Modal>

      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete year?"
        size="sm"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" fullWidth onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="danger" fullWidth onClick={doDelete} disabled={busy}>{busy ? 'Deleting…' : 'Delete'}</Button>
          </div>
        }
      >
        <p className="text-sm text-ink-600 dark:text-ink-300">Delete data for <strong>{confirmDelete?.year}</strong>?</p>
      </Modal>
    </div>
  );
}
