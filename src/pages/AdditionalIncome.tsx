import { useState, useMemo } from 'react';
import { Plus, Coins, Trash2, Pencil, CalendarPlus, TrendingUp } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { supabase } from '../lib/supabase';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/Feedback';
import { formatGBPFull, parseAmount } from '../lib/format';
import { AdditionalIncomeSource, AdditionalIncomeEntry, IncomeType, INCOME_TYPE_LABELS, INCOME_TYPE_ORDER } from '../lib/types';

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 30 }, (_, i) => CURRENT_YEAR - 10 + i);

const TYPE_COLORS: Record<IncomeType, { bg: string; bgDark: string; text: string; textDark: string; icon: string }> = {
  state_pension:     { bg: 'bg-blue-100',     bgDark: 'dark:bg-blue-950/40',   text: 'text-blue-800',     textDark: 'dark:text-blue-200',     icon: 'text-blue-500' },
  pension:           { bg: 'bg-purple-100',   bgDark: 'dark:bg-purple-950/40', text: 'text-purple-800',   textDark: 'dark:text-purple-200',   icon: 'text-purple-500' },
  investment_income: { bg: 'bg-green-100',    bgDark: 'dark:bg-green-950/40',  text: 'text-green-800',    textDark: 'dark:text-green-200',    icon: 'text-green-500' },
  other:             { bg: 'bg-ink-100',      bgDark: 'dark:bg-ink-800',       text: 'text-ink-700',      textDark: 'dark:text-ink-300',      icon: 'text-ink-500' },
};

export function AdditionalIncomePage() {
  const { additionalIncomeSources, additionalIncomeEntries, loading, refresh } = useFinance();
  const [sourceModalOpen, setSourceModalOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<AdditionalIncomeSource | null>(null);
  const [sourceName, setSourceName] = useState('');
  const [sourceType, setSourceType] = useState<IncomeType>('state_pension');
  const [busy, setBusy] = useState(false);

  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [entrySource, setEntrySource] = useState<AdditionalIncomeSource | null>(null);
  const [editingEntry, setEditingEntry] = useState<AdditionalIncomeEntry | null>(null);
  const [entryYear, setEntryYear] = useState(CURRENT_YEAR);
  const [entryAmount, setEntryAmount] = useState('');

  const [confirmDeleteSource, setConfirmDeleteSource] = useState<AdditionalIncomeSource | null>(null);
  const [confirmDeleteEntry, setConfirmDeleteEntry] = useState<{ entry: AdditionalIncomeEntry; source: AdditionalIncomeSource } | null>(null);

  const entriesBySource = useMemo(() => {
    const map = new Map<string, AdditionalIncomeEntry[]>();
    for (const e of additionalIncomeEntries) {
      const arr = map.get(e.source_id) ?? [];
      arr.push(e);
      map.set(e.source_id, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.year - b.year);
    return map;
  }, [additionalIncomeEntries]);

  const totalAnnual = useMemo(() => {
    return additionalIncomeEntries
      .filter((e) => e.year === CURRENT_YEAR)
      .reduce((s, e) => s + Number(e.amount), 0);
  }, [additionalIncomeEntries]);

  const openAddSource = () => {
    setEditingSource(null);
    setSourceName('');
    setSourceType('state_pension');
    setSourceModalOpen(true);
  };

  const openEditSource = (src: AdditionalIncomeSource) => {
    setEditingSource(src);
    setSourceName(src.name);
    setSourceType(src.income_type);
    setSourceModalOpen(true);
  };

  const saveSource = async () => {
    if (!sourceName.trim()) return;
    setBusy(true);
    if (editingSource) {
      await supabase.from('additional_income_sources')
        .update({ name: sourceName.trim(), income_type: sourceType, updated_at: new Date().toISOString() })
        .eq('id', editingSource.id);
    } else {
      await supabase.from('additional_income_sources').insert({ name: sourceName.trim(), income_type: sourceType });
    }
    await refresh();
    setBusy(false);
    setSourceModalOpen(false);
  };

  const openAddEntry = (src: AdditionalIncomeSource) => {
    setEntrySource(src);
    setEditingEntry(null);
    setEntryYear(CURRENT_YEAR);
    setEntryAmount('');
    setEntryModalOpen(true);
  };

  const openEditEntry = (entry: AdditionalIncomeEntry, src: AdditionalIncomeSource) => {
    setEntrySource(src);
    setEditingEntry(entry);
    setEntryYear(entry.year);
    setEntryAmount(String(entry.amount));
    setEntryModalOpen(true);
  };

  const saveEntry = async () => {
    if (!entrySource) return;
    setBusy(true);
    const amount = parseAmount(entryAmount);
    if (editingEntry) {
      await supabase.from('additional_income_entries')
        .update({ year: entryYear, amount, updated_at: new Date().toISOString() })
        .eq('id', editingEntry.id);
    } else {
      await supabase.from('additional_income_entries').insert({ source_id: entrySource.id, year: entryYear, amount });
    }
    await refresh();
    setBusy(false);
    setEntryModalOpen(false);
  };

  const doDeleteSource = async () => {
    if (!confirmDeleteSource) return;
    setBusy(true);
    await supabase.from('additional_income_sources').delete().eq('id', confirmDeleteSource.id);
    await refresh();
    setBusy(false);
    setConfirmDeleteSource(null);
  };

  const doDeleteEntry = async () => {
    if (!confirmDeleteEntry) return;
    setBusy(true);
    await supabase.from('additional_income_entries').delete().eq('id', confirmDeleteEntry.entry.id);
    await refresh();
    setBusy(false);
    setConfirmDeleteEntry(null);
  };

  if (loading) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink-900 dark:text-ink-50">Additional Income</h1>
          <p className="text-sm text-ink-400">Recurring annual income sources</p>
        </div>
        <Button onClick={openAddSource} size="sm"><Plus size={16} /> Add</Button>
      </div>

      {totalAnnual > 0 && (
        <Card className="p-4 bg-brand-50 dark:bg-brand-900/20 border-brand-200 dark:border-brand-800">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={16} className="text-brand-500" />
            <span className="text-xs font-medium text-ink-500 dark:text-ink-400">Total for {CURRENT_YEAR}</span>
          </div>
          <p className="text-2xl font-bold text-brand-700 dark:text-brand-300">{formatGBPFull(totalAnnual)}</p>
        </Card>
      )}

      {additionalIncomeSources.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Coins size={40} />}
            title="No income sources yet"
            message="Add recurring annual income sources like State Pension, pension, or investment income. These are used in the Retirement Annual Position and do not affect account balances."
            action={<Button onClick={openAddSource} size="sm"><Plus size={16} /> Add income source</Button>}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {additionalIncomeSources.map((src) => {
            const c = TYPE_COLORS[src.income_type];
            const entries = entriesBySource.get(src.id) ?? [];
            const latestAmount = entries.length > 0 ? Number(entries[entries.length - 1].amount) : 0;

            return (
              <Card key={src.id}>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${c.bg} ${c.bgDark}`}>
                        <Coins size={18} className={c.icon} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-sm text-ink-900 dark:text-ink-50 truncate">{src.name}</h3>
                        <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-md mt-0.5 ${c.bg} ${c.bgDark} ${c.text} ${c.textDark}`}>
                          {INCOME_TYPE_LABELS[src.income_type]}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => openEditSource(src)} className="p-1.5 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-400 hover:text-ink-600 dark:hover:text-ink-200 transition-colors" aria-label="Edit source">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => setConfirmDeleteSource(src)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-ink-400 hover:text-red-500 transition-colors" aria-label="Delete source">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {entries.length > 0 ? (
                    <div className="mt-3 space-y-1.5">
                      {entries.map((entry) => (
                        <div key={entry.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-ink-50 dark:bg-ink-800/50 group">
                          <span className="text-sm font-medium text-ink-600 dark:text-ink-300">{entry.year}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-ink-900 dark:text-ink-50">{formatGBPFull(Number(entry.amount))}</span>
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => openEditEntry(entry, src)} className="p-1 rounded-md hover:bg-ink-200 dark:hover:bg-ink-700 text-ink-400 hover:text-ink-600 dark:hover:text-ink-200 transition-colors" aria-label="Edit year">
                                <Pencil size={13} />
                              </button>
                              <button onClick={() => setConfirmDeleteEntry({ entry, source: src })} className="p-1 rounded-md hover:bg-red-100 dark:hover:bg-red-950/50 text-ink-400 hover:text-red-500 transition-colors" aria-label="Delete year">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                      <div className="flex items-center justify-between py-2 px-3 mt-1 rounded-lg bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-800/50">
                        <span className="text-xs font-medium text-brand-600 dark:text-brand-400">Latest annual amount</span>
                        <span className="text-sm font-bold text-brand-700 dark:text-brand-300">{formatGBPFull(latestAmount)}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-ink-400 mt-3">No annual amounts recorded yet.</p>
                  )}

                  <button onClick={() => openAddEntry(src)} className="mt-3 flex items-center gap-1.5 text-xs font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors">
                    <CalendarPlus size={14} /> Add year
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Source Modal */}
      <Modal
        open={sourceModalOpen}
        onClose={() => setSourceModalOpen(false)}
        title={editingSource ? 'Edit Income Source' : 'Add Income Source'}
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" fullWidth onClick={() => setSourceModalOpen(false)}>Cancel</Button>
            <Button fullWidth onClick={saveSource} disabled={busy || !sourceName.trim()}>{busy ? 'Saving…' : 'Save'}</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input label="Income name" placeholder="e.g. Carl State Pension" value={sourceName} onChange={(e) => setSourceName(e.target.value)} />
          <Select label="Income type" value={sourceType} onChange={(e) => setSourceType(e.target.value as IncomeType)}>
            {INCOME_TYPE_ORDER.map((t) => <option key={t} value={t}>{INCOME_TYPE_LABELS[t]}</option>)}
          </Select>
        </div>
      </Modal>

      {/* Add/Edit Entry Modal */}
      <Modal
        open={entryModalOpen}
        onClose={() => setEntryModalOpen(false)}
        title={editingEntry ? 'Edit Annual Amount' : `Add Annual Amount — ${entrySource?.name ?? ''}`}
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" fullWidth onClick={() => setEntryModalOpen(false)}>Cancel</Button>
            <Button fullWidth onClick={saveEntry} disabled={busy || !entryAmount.trim()}>{busy ? 'Saving…' : 'Save'}</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Select label="Year" value={entryYear} onChange={(e) => setEntryYear(parseInt(e.target.value))}>
            {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
          </Select>
          <Input label="Annual amount" type="number" inputMode="decimal" prefix="£" placeholder="e.g. 12000" value={entryAmount} onChange={(e) => setEntryAmount(e.target.value)} hint="Amount per year for the selected year. Previous years are not overwritten." />
        </div>
      </Modal>

      {/* Delete Source Confirmation */}
      <Modal
        open={!!confirmDeleteSource}
        onClose={() => setConfirmDeleteSource(null)}
        title="Delete income source?"
        size="sm"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" fullWidth onClick={() => setConfirmDeleteSource(null)}>Cancel</Button>
            <Button variant="danger" fullWidth onClick={doDeleteSource} disabled={busy}>{busy ? 'Deleting…' : 'Delete'}</Button>
          </div>
        }
      >
        <p className="text-sm text-ink-600 dark:text-ink-300">
          Permanently delete <strong>{confirmDeleteSource?.name}</strong> and all its annual amounts?
        </p>
      </Modal>

      {/* Delete Entry Confirmation */}
      <Modal
        open={!!confirmDeleteEntry}
        onClose={() => setConfirmDeleteEntry(null)}
        title="Delete year entry?"
        size="sm"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" fullWidth onClick={() => setConfirmDeleteEntry(null)}>Cancel</Button>
            <Button variant="danger" fullWidth onClick={doDeleteEntry} disabled={busy}>{busy ? 'Deleting…' : 'Delete'}</Button>
          </div>
        }
      >
        <p className="text-sm text-ink-600 dark:text-ink-300">
          Delete the <strong>{confirmDeleteEntry?.entry.year}</strong> entry ({formatGBPFull(Number(confirmDeleteEntry?.entry.amount ?? 0))}) for <strong>{confirmDeleteEntry?.source.name}</strong>?
          <br />
          <span className="text-xs text-ink-400 mt-1 block">This only removes this year's amount — the income source and other years remain.</span>
        </p>
      </Modal>
    </div>
  );
}
