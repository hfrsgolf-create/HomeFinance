import { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Pencil, Trash2, FileText, AlertTriangle, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Select, Textarea } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/Feedback';
import { formatGBPFull, formatDate } from '../lib/format';
import { Provider, ProviderCategory, ProviderFrequency, PROVIDER_CATEGORY_LABELS, PROVIDER_CATEGORY_ORDER } from '../lib/types';

const PROVIDER_CATEGORY_COLORS: Record<ProviderCategory, { bg: string; bgDark: string; text: string; textDark: string; activeBg: string; activeText: string; border: string; borderDark: string }> = {
  tv_streaming:    { bg: 'bg-purple-100',   bgDark: 'dark:bg-purple-950/40',   text: 'text-purple-800',   textDark: 'dark:text-purple-200',   activeBg: 'bg-purple-200',   activeText: 'text-purple-900 dark:text-purple-100',   border: 'border border-purple-200',     borderDark: 'dark:border-purple-900/50' },
  utilities:       { bg: 'bg-blue-100',     bgDark: 'dark:bg-blue-950/40',     text: 'text-blue-800',     textDark: 'dark:text-blue-200',     activeBg: 'bg-blue-200',     activeText: 'text-blue-900 dark:text-blue-100',       border: 'border border-blue-200',       borderDark: 'dark:border-blue-900/50' },
  insurance:       { bg: 'bg-green-100',    bgDark: 'dark:bg-green-950/40',    text: 'text-green-800',    textDark: 'dark:text-green-200',    activeBg: 'bg-green-200',    activeText: 'text-green-900 dark:text-green-100',    border: 'border border-green-200',      borderDark: 'dark:border-green-900/50' },
  home:            { bg: 'bg-yellow-100',   bgDark: 'dark:bg-yellow-950/40',   text: 'text-yellow-800',   textDark: 'dark:text-yellow-200',   activeBg: 'bg-yellow-200',   activeText: 'text-yellow-900 dark:text-yellow-100',   border: 'border border-yellow-200',     borderDark: 'dark:border-yellow-900/50' },
  vehicle:         { bg: 'bg-orange-100',   bgDark: 'dark:bg-orange-950/40',   text: 'text-orange-800',   textDark: 'dark:text-orange-200',   activeBg: 'bg-orange-200',   activeText: 'text-orange-900 dark:text-orange-100',   border: 'border border-orange-200',     borderDark: 'dark:border-orange-900/50' },
  broadband_phone: { bg: 'bg-teal-100',     bgDark: 'dark:bg-teal-950/40',     text: 'text-teal-800',     textDark: 'dark:text-teal-200',     activeBg: 'bg-teal-200',     activeText: 'text-teal-900 dark:text-teal-100',       border: 'border border-teal-200',       borderDark: 'dark:border-teal-900/50' },
  subscriptions:   { bg: 'bg-pink-100',     bgDark: 'dark:bg-pink-950/40',     text: 'text-pink-800',     textDark: 'dark:text-pink-200',     activeBg: 'bg-pink-200',     activeText: 'text-pink-900 dark:text-pink-100',       border: 'border border-pink-200',       borderDark: 'dark:border-pink-900/50' },
  other:           { bg: 'bg-ink-100',      bgDark: 'dark:bg-ink-800',          text: 'text-ink-600',      textDark: 'dark:text-ink-300',      activeBg: 'bg-ink-200',      activeText: 'text-ink-900 dark:text-ink-100',         border: 'border border-ink-200',        borderDark: 'dark:border-ink-700' },
};

export function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Provider | null>(null);
  const [detailProvider, setDetailProvider] = useState<Provider | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Provider | null>(null);
  const [busy, setBusy] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ProviderCategory>('other');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<ProviderFrequency>('monthly');
  const [startDate, setStartDate] = useState('');
  const [renewalDate, setRenewalDate] = useState('');
  const [notes, setNotes] = useState('');

  // Filter
  const [filter, setFilter] = useState<ProviderCategory | 'all'>('all');

  const fetchProviders = useCallback(async () => {
    const { data } = await supabase.from('providers').select('*');
    setProviders((data ?? []) as Provider[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const openAdd = () => {
    setEditing(null);
    setName('');
    setCategory('other');
    setAmount('');
    setFrequency('monthly');
    setStartDate('');
    setRenewalDate('');
    setNotes('');
    setModalOpen(true);
  };

  const openEdit = (p: Provider) => {
    setEditing(p);
    setName(p.name);
    setCategory(p.category);
    setAmount(String(p.amount));
    setFrequency(p.frequency);
    setStartDate(p.contract_start_date ?? '');
    setRenewalDate(p.renewal_date ?? '');
    setNotes(p.notes ?? '');
    setModalOpen(true);
  };

  const save = async () => {
    setBusy(true);
    const payload = {
      name: name.trim(),
      category,
      amount: parseFloat(amount) || 0,
      frequency,
      contract_start_date: startDate || null,
      renewal_date: renewalDate || null,
      notes: notes.trim() || null,
      updated_at: new Date().toISOString(),
    };
    if (editing) {
      await supabase.from('providers').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('providers').insert(payload);
    }
    await fetchProviders();
    setBusy(false);
    setModalOpen(false);
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    await supabase.from('providers').delete().eq('id', confirmDelete.id);
    await fetchProviders();
    setBusy(false);
    setConfirmDelete(null);
    setDetailProvider(null);
  };

  // Sort: nearest renewal first, providers without renewal date last
  const sorted = useMemo(() => {
    const withDate = providers.filter((p) => p.renewal_date);
    const withoutDate = providers.filter((p) => !p.renewal_date);
    withDate.sort((a, b) => (a.renewal_date! < b.renewal_date! ? -1 : 1));
    return [...withDate, ...withoutDate];
  }, [providers]);

  const filtered = useMemo(
    () => (filter === 'all' ? sorted : sorted.filter((p) => p.category === filter)),
    [sorted, filter]
  );

  // Renewal status helper
  const getRenewalStatus = (renewalDate: string | null): 'none' | 'approaching' | 'close' | 'overdue' => {
    if (!renewalDate) return 'none';
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const renewal = new Date(renewalDate + 'T00:00:00');
    const diffDays = Math.round((renewal.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'overdue';
    if (diffDays <= 14) return 'close';
    if (diffDays <= 30) return 'approaching';
    return 'none';
  };

  if (loading) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink-900 dark:text-ink-50">Providers</h1>
          <p className="text-sm text-ink-400">Household services, subscriptions & contracts</p>
        </div>
        <Button onClick={openAdd} size="sm"><Plus size={16} /> Add</Button>
      </div>

      {providers.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileText size={40} />}
            title="No providers yet"
            message="Track household services, subscriptions, insurance, utilities, and vehicle costs with renewal dates."
            action={<Button onClick={openAdd} size="sm"><Plus size={16} /> Add provider</Button>}
          />
        </Card>
      ) : (
        <>
          {/* Category filter */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors shrink-0 ${
                filter === 'all'
                  ? 'bg-brand-600 text-white'
                  : 'bg-ink-100 dark:bg-ink-800 text-ink-500 dark:text-ink-400 hover:bg-ink-200 dark:hover:bg-ink-700'
              }`}
            >
              All
            </button>
            {PROVIDER_CATEGORY_ORDER.map((cat) => {
              const c = PROVIDER_CATEGORY_COLORS[cat];
              return (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors shrink-0 ${
                  filter === cat
                    ? `${c.activeBg} ${c.activeText} ${c.border} ${c.borderDark}`
                    : `${c.bg} ${c.bgDark} ${c.text} ${c.textDark} ${c.border} ${c.borderDark} hover:brightness-95`
                }`}
              >
                {PROVIDER_CATEGORY_LABELS[cat]}
              </button>
              );
            })}
          </div>

          {/* Provider list */}
          <div className="space-y-2">
            {filtered.map((p) => {
              const status = getRenewalStatus(p.renewal_date);
              return (
                <Card
                  key={p.id}
                  className={`p-4 cursor-pointer hover:ring-1 hover:ring-brand-400/40 transition-all ${
                    status === 'overdue' ? 'border-red-300 dark:border-red-800/60'
                    : status === 'close' ? 'border-amber-300 dark:border-amber-800/60'
                    : status === 'approaching' ? 'border-amber-200 dark:border-amber-900/40'
                    : ''
                  }`}
                >
                  <div className="flex items-center gap-3" onClick={() => setDetailProvider(p)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-semibold text-ink-900 dark:text-ink-50 truncate">{p.name}</p>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${PROVIDER_CATEGORY_COLORS[p.category].bg} ${PROVIDER_CATEGORY_COLORS[p.category].bgDark} ${PROVIDER_CATEGORY_COLORS[p.category].text} ${PROVIDER_CATEGORY_COLORS[p.category].textDark} shrink-0`}>
                          {PROVIDER_CATEGORY_LABELS[p.category]}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-ink-400">
                        <span>{formatGBPFull(Number(p.amount))} / {p.frequency === 'monthly' ? 'month' : 'year'}</span>
                        {p.renewal_date && (
                          <>
                            <span>·</span>
                            <span className={`flex items-center gap-1 ${
                              status === 'overdue' ? 'text-red-500 font-medium'
                              : status === 'close' ? 'text-amber-600 dark:text-amber-400 font-medium'
                              : status === 'approaching' ? 'text-amber-500 dark:text-amber-500'
                              : ''
                            }`}>
                              {status === 'overdue' && <AlertTriangle size={12} />}
                              Renewal: {formatDate(p.renewal_date)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-ink-300 dark:text-ink-600 shrink-0" />
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Add/Edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Provider' : 'Add Provider'}
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" fullWidth onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button fullWidth onClick={save} disabled={busy || !name.trim()}>{busy ? 'Saving…' : 'Save'}</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input label="Provider name" placeholder="e.g. Sky TV, BT Broadband" value={name} onChange={(e) => setName(e.target.value)} />
          <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value as ProviderCategory)}>
            {PROVIDER_CATEGORY_ORDER.map((cat) => (
              <option key={cat} value={cat}>{PROVIDER_CATEGORY_LABELS[cat]}</option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Amount" type="number" inputMode="decimal" prefix="£" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Select label="Frequency" value={frequency} onChange={(e) => setFrequency(e.target.value as ProviderFrequency)}>
              <option value="monthly">Monthly</option>
              <option value="annually">Annually</option>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Contract start date (optional)" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <Input label="Renewal / expiry date" type="date" value={renewalDate} onChange={(e) => setRenewalDate(e.target.value)} />
          </div>
          <Textarea label="Notes (optional)" rows={2} placeholder="Any notes about this provider" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </Modal>

      {/* Detail modal */}
      <Modal
        open={!!detailProvider}
        onClose={() => setDetailProvider(null)}
        title="Provider Details"
        footer={
          <div className="flex gap-2">
            <Button variant="danger" onClick={() => setConfirmDelete(detailProvider)} disabled={busy}>
              <Trash2 size={15} /> Delete
            </Button>
            <Button variant="secondary" fullWidth onClick={() => { if (detailProvider) openEdit(detailProvider); setDetailProvider(null); }}>
              <Pencil size={15} /> Edit
            </Button>
            <Button fullWidth onClick={() => setDetailProvider(null)}>Close</Button>
          </div>
        }
      >
        {detailProvider && (
          <div className="space-y-3">
            <div>
              <h3 className="text-lg font-bold text-ink-900 dark:text-ink-50">{detailProvider.name}</h3>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${PROVIDER_CATEGORY_COLORS[detailProvider.category].bg} ${PROVIDER_CATEGORY_COLORS[detailProvider.category].bgDark} ${PROVIDER_CATEGORY_COLORS[detailProvider.category].text} ${PROVIDER_CATEGORY_COLORS[detailProvider.category].textDark}`}>
                {PROVIDER_CATEGORY_LABELS[detailProvider.category]}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="rounded-xl bg-ink-50 dark:bg-ink-850/50 p-3">
                <p className="text-xs text-ink-400 mb-0.5">Amount</p>
                <p className="text-sm font-semibold text-ink-900 dark:text-ink-50">
                  {formatGBPFull(Number(detailProvider.amount))} / {detailProvider.frequency === 'monthly' ? 'month' : 'year'}
                </p>
              </div>
              <div className="rounded-xl bg-ink-50 dark:bg-ink-850/50 p-3">
                <p className="text-xs text-ink-400 mb-0.5">Frequency</p>
                <p className="text-sm font-semibold text-ink-900 dark:text-ink-50 capitalize">{detailProvider.frequency}</p>
              </div>
              {detailProvider.contract_start_date && (
                <div className="rounded-xl bg-ink-50 dark:bg-ink-850/50 p-3">
                  <p className="text-xs text-ink-400 mb-0.5">Contract start</p>
                  <p className="text-sm font-semibold text-ink-900 dark:text-ink-50">{formatDate(detailProvider.contract_start_date)}</p>
                </div>
              )}
              {detailProvider.renewal_date && (
                <div className={`rounded-xl p-3 ${
                  getRenewalStatus(detailProvider.renewal_date) === 'overdue' ? 'bg-red-50 dark:bg-red-950/30'
                  : getRenewalStatus(detailProvider.renewal_date) === 'close' ? 'bg-amber-50 dark:bg-amber-950/30'
                  : 'bg-ink-50 dark:bg-ink-850/50'
                }`}>
                  <p className="text-xs text-ink-400 mb-0.5">Renewal / expiry</p>
                  <p className={`text-sm font-semibold ${
                    getRenewalStatus(detailProvider.renewal_date) === 'overdue' ? 'text-red-500'
                    : getRenewalStatus(detailProvider.renewal_date) === 'close' ? 'text-amber-600 dark:text-amber-400'
                    : 'text-ink-900 dark:text-ink-50'
                  }`}>
                    {formatDate(detailProvider.renewal_date)}
                  </p>
                </div>
              )}
            </div>
            {detailProvider.notes && (
              <div className="rounded-xl bg-ink-50 dark:bg-ink-850/50 p-3">
                <p className="text-xs text-ink-400 mb-1">Notes</p>
                <p className="text-sm text-ink-700 dark:text-ink-200 whitespace-pre-wrap">{detailProvider.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Delete confirmation */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete provider?"
        size="sm"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" fullWidth onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="danger" fullWidth onClick={doDelete} disabled={busy}>{busy ? 'Deleting…' : 'Delete'}</Button>
          </div>
        }
      >
        <p className="text-sm text-ink-600 dark:text-ink-300">Delete <strong>{confirmDelete?.name}</strong>?</p>
      </Modal>
    </div>
  );
}
