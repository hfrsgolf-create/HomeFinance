import { useState, useEffect } from 'react';
import { Info } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { Button } from '../ui/Button';
import { Input, Select, Textarea } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { todayISO, parseAmount } from '../../lib/format';
import { Transaction } from '../../lib/types';
import { saveTransaction, deleteTransaction } from '../../lib/accountActions';

type TransactionCategory = 'Home' | 'Car' | 'Holiday' | 'Other';
const CATEGORIES: TransactionCategory[] = ['Home', 'Car', 'Holiday', 'Other'];

interface TransactionModalProps {
  open: boolean;
  onClose: () => void;
  editing: Transaction | null;
  defaultAccountId?: string;
}

export function TransactionModal({ open, onClose, editing, defaultAccountId }: TransactionModalProps) {
  const { accounts, refresh } = useFinance();
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [category, setCategory] = useState<TransactionCategory>('Other');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setDate(editing.date);
      setDescription(editing.description);
      setAmount(String(Math.abs(editing.amount)));
      setAccountId(editing.account_id || '');
      setCategory((editing.category as TransactionCategory) || 'Other');
      setNote(editing.note || '');
    } else {
      setDate(todayISO());
      setDescription('');
      setAmount('');
      setAccountId(defaultAccountId || '');
      setCategory('Other');
      setNote('');
    }
  }, [open, editing, defaultAccountId]);

  const save = async () => {
    setBusy(true);
    await saveTransaction({
      editingId: editing?.id,
      oldAccountId: editing?.account_id ?? null,
      oldAmount: editing?.amount,
      date,
      description,
      amount: -Math.abs(parseAmount(amount)),
      accountId: accountId || null,
      category,
      note,
    });
    await refresh();
    setBusy(false);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit Entry' : 'Add Big Spend'}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" fullWidth onClick={onClose}>Cancel</Button>
          <Button fullWidth onClick={save} disabled={busy || !description.trim() || !amount}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Input label="Description" placeholder="e.g. Holiday, Home Improvement, Car Purchase"
          value={description} onChange={(e) => setDescription(e.target.value)} />
        <Input label="Amount" type="number" inputMode="decimal" prefix="£" placeholder="0"
          value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value as TransactionCategory)}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Textarea label="Notes (optional)" rows={2} placeholder="e.g. Paid in installments, joint purchase"
          value={note} onChange={(e) => setNote(e.target.value)} />
        {accountId && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-brand-50 dark:bg-brand-900/20 text-xs text-ink-600 dark:text-ink-300">
            <Info size={14} className="text-brand-500 shrink-0 mt-0.5" />
            <p>This amount will be automatically deducted from the linked account balance.</p>
          </div>
        )}
        <Select label="Linked account (optional)" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">None</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </Select>
      </div>
    </Modal>
  );
}

interface DeleteTransactionModalProps {
  transaction: Transaction | null;
  onClose: () => void;
}

export function DeleteTransactionModal({ transaction, onClose }: DeleteTransactionModalProps) {
  const { refresh } = useFinance();
  const [busy, setBusy] = useState(false);

  const doDelete = async () => {
    if (!transaction) return;
    setBusy(true);
    await deleteTransaction({
      id: transaction.id,
      accountId: transaction.account_id,
      amount: Number(transaction.amount),
      description: transaction.description,
      date: transaction.date,
    });
    await refresh();
    setBusy(false);
    onClose();
  };

  return (
    <Modal
      open={!!transaction}
      onClose={onClose}
      title="Delete entry?"
      size="sm"
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" fullWidth onClick={onClose}>Cancel</Button>
          <Button variant="danger" fullWidth onClick={doDelete} disabled={busy}>
            {busy ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-ink-600 dark:text-ink-300">
        Delete <strong>{transaction?.description}</strong>?
      </p>
      {transaction?.account_id && (
        <p className="text-xs text-ink-400 mt-2">
          This will update your account balances.
        </p>
      )}
    </Modal>
  );
}
