import { useState } from 'react';
import { Plus, Receipt, Pencil, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { supabase } from '../lib/supabase';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Select, Textarea } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/Feedback';
import { formatGBPFull, parseAmount } from '../lib/format';
import { OUTGOING_TYPE_LABELS, Outgoing, OutgoingType } from '../lib/types';

export function OutgoingsPage() {
  const { outgoings, refresh, loading } = useFinance();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Outgoing | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<OutgoingType>('direct_debit');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Outgoing | null>(null);

  const totalMonthly = outgoings.reduce((s, o) => s + Number(o.amount), 0);
  const totalAnnual = totalMonthly * 12;

  const openAdd = () => {
    setEditing(null);
    setName('');
    setAmount('');
    setType('direct_debit');
    setNotes('');
    setModalOpen(true);
  };

  const openEdit = (o: Outgoing) => {
    setEditing(o);
    setName(o.name);
    setAmount(String(o.amount));
    setType(o.type);
    setNotes(o.notes || '');
    setModalOpen(true);
  };

  const save = async () => {
    setBusy(true);
    const payload = {
      name: name.trim(),
      amount: parseAmount(amount),
      type,
      notes: notes.trim(),
      sort_order: editing ? editing.sort_order : outgoings.length,
    };
    if (editing) {
      await supabase.from('outgoings').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('outgoings').insert(payload);
    }
    await refresh();
    setBusy(false);
    setModalOpen(false);
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    await supabase.from('outgoings').delete().eq('id', confirmDelete.id);
    await refresh();
    setBusy(false);
    setConfirmDelete(null);
  };

  const moveItem = async (index: number, dir: -1 | 1) => {
    const sorted = [...outgoings].sort((a, b) => a.sort_order - b.sort_order);
    const target = index + dir;
    if (target < 0 || target >= sorted.length) return;
    const a = sorted[index];
    const b = sorted[target];
    await Promise.all([
      supabase.from('outgoings').update({ sort_order: b.sort_order }).eq('id', a.id),
      supabase.from('outgoings').update({ sort_order: a.sort_order }).eq('id', b.id),
    ]);
    await refresh();
  };

  const sortedOutgoings = [...outgoings].sort((a, b) => a.sort_order - b.sort_order);

  if (loading) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink-900 dark:text-ink-50">Outgoings</h1>
          <p className="text-sm text-ink-400">Recurring monthly expenses</p>
        </div>
        <Button onClick={openAdd} size="sm"><Plus size={16} /> Add</Button>
      </div>

      {/* Summary cards */}
      {outgoings.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <Receipt size={16} className="text-brand-500" />
              <span className="text-xs font-medium text-ink-500 dark:text-ink-400">Monthly Total</span>
            </div>
            <p className="text-2xl font-bold text-ink-900 dark:text-ink-50">{formatGBPFull(totalMonthly)}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <Receipt size={16} className="text-amber-500" />
              <span className="text-xs font-medium text-ink-500 dark:text-ink-400">Annual Total</span>
            </div>
            <p className="text-2xl font-bold text-ink-900 dark:text-ink-50">{formatGBPFull(totalAnnual)}</p>
          </Card>
        </div>
      )}

      {outgoings.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Receipt size={40} />}
            title="No outgoings yet"
            message="Add recurring monthly expenses like mortgage, utilities, council tax, and insurance."
            action={<Button onClick={openAdd} size="sm"><Plus size={16} /> Add outgoing</Button>}
          />
        </Card>
      ) : (
        <div className="space-y-2">
          {sortedOutgoings.map((o, i) => (
            <Card key={o.id} className={`p-4 ${i % 2 === 1 ? 'bg-ink-50/50 dark:bg-ink-850/30' : ''}`}>
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => moveItem(i, -1)}
                    disabled={i === 0}
                    className="p-0.5 rounded hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-400 disabled:opacity-30 transition-colors"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    onClick={() => moveItem(i, 1)}
                    disabled={i === sortedOutgoings.length - 1}
                    className="p-0.5 rounded hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-400 disabled:opacity-30 transition-colors"
                  >
                    <ArrowDown size={14} />
                  </button>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-ink-900 dark:text-ink-50 truncate">{o.name}</p>
                  <div className="flex items-center gap-2 text-xs text-ink-400">
                    <span>{OUTGOING_TYPE_LABELS[o.type]}</span>
                    <span>·</span>
                    <span>{formatGBPFull(Number(o.amount))}/mo</span>
                  </div>
                  {o.notes && <p className="text-xs text-ink-400 mt-1 truncate">{o.notes}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(o)} className="p-2 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-400 transition-colors">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => setConfirmDelete(o)} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-ink-400 hover:text-red-500 transition-colors">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Outgoing' : 'Add Outgoing'}
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" fullWidth onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button fullWidth onClick={save} disabled={busy || !name.trim()}>{busy ? 'Saving…' : 'Save'}</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input label="Name" placeholder="e.g. Mortgage, Utilities, Council Tax" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Amount per month" type="number" inputMode="decimal" prefix="£" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Select label="Type" value={type} onChange={(e) => setType(e.target.value as OutgoingType)}>
            {(Object.keys(OUTGOING_TYPE_LABELS) as OutgoingType[]).map((t) => (
              <option key={t} value={t}>{OUTGOING_TYPE_LABELS[t]}</option>
            ))}
          </Select>
          <Textarea label="Notes (optional)" rows={2} placeholder="Any notes about this outgoing" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </Modal>

      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete outgoing?"
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
