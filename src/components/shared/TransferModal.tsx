import { useState, useEffect, useMemo } from 'react';
import { Info } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { Button } from '../ui/Button';
import { Input, Select, Textarea } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { todayISO, parseAmount, formatGBPFull } from '../../lib/format';
import { AccountTransfer, TRANSFERABLE_ACCOUNT_TYPES } from '../../lib/types';
import { createTransfer, updateTransfer, deleteTransfer } from '../../lib/accountActions';

interface TransferModalProps {
  open: boolean;
  onClose: () => void;
  editing: AccountTransfer | null;
}

export function TransferModal({ open, onClose, editing }: TransferModalProps) {
  const { accounts, refresh } = useFinance();
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const eligible = useMemo(
    () => accounts.filter((a) => TRANSFERABLE_ACCOUNT_TYPES.includes(a.type)),
    [accounts]
  );
  const fromOptions = eligible.filter((a) => a.id !== toId);
  const toOptions = eligible.filter((a) => a.id !== fromId);

  useEffect(() => {
    if (!open) return;
    setError('');
    if (editing) {
      setFromId(editing.from_account_id);
      setToId(editing.to_account_id);
      setAmount(String(editing.amount));
      setDate(editing.transfer_date.slice(0, 10));
      setNote(editing.note || '');
    } else {
      setFromId('');
      setToId('');
      setAmount('');
      setDate(todayISO());
      setNote('');
    }
  }, [open, editing]);

  const fromAccount = eligible.find((a) => a.id === fromId);
  const toAccount = eligible.find((a) => a.id === toId);
  const amountValue = Math.abs(parseAmount(amount));
  const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date));
  const canSave = !busy && !!fromAccount && !!toAccount && fromId !== toId && amountValue > 0 && dateValid;

  const save = async () => {
    if (!fromAccount || !toAccount || !canSave) return;
    setBusy(true);
    setError('');
    const input = { fromAccount, toAccount, amount: amountValue, date, note };
    let failed = false;
    try {
      if (editing) await updateTransfer(editing, input);
      else await createTransfer(input);
    } catch (err) {
      failed = true;
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
    await refresh();
    setBusy(false);
    if (!failed) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit Transfer' : 'Transfer Money'}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" fullWidth onClick={onClose}>Cancel</Button>
          <Button fullWidth onClick={save} disabled={!canSave}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Transfer'}</Button>
        </div>
      }
    >
      <div className="space-y-4">
        {eligible.length < 2 ? (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-xs text-ink-600 dark:text-ink-300">
            <Info size={14} className="text-amber-500 shrink-0 mt-0.5" />
            <p>You need at least two Bank, Savings or ISA accounts to move money between them.</p>
          </div>
        ) : (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-brand-50 dark:bg-brand-950/20 text-xs text-ink-600 dark:text-ink-300">
            <Info size={14} className="text-brand-500 shrink-0 mt-0.5" />
            <p>Moves your own money between accounts. It is <strong>not</strong> counted as income or spending.</p>
          </div>
        )}
        <Select label="From account" value={fromId} onChange={(e) => setFromId(e.target.value)}>
          <option value="">Select account…</option>
          {fromOptions.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
        <Select label="To account" value={toId} onChange={(e) => setToId(e.target.value)}>
          <option value="">Select account…</option>
          {toOptions.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
        <Input label="Amount" type="number" inputMode="decimal" prefix="£" placeholder="0" value={amount}
          onChange={(e) => setAmount(e.target.value)}
          hint={fromAccount && toAccount && amountValue > 0
            ? `${fromAccount.name} −${formatGBPFull(amountValue)} · ${toAccount.name} +${formatGBPFull(amountValue)}`
            : 'Enter a positive amount'} />
        <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)}
          hint="Defaults to today — change to backdate this transfer" />
        <Textarea label="Note (optional)" rows={2} placeholder="e.g. Monthly savings top-up"
          value={note} onChange={(e) => setNote(e.target.value)} />
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    </Modal>
  );
}

interface DeleteTransferModalProps {
  transfer: AccountTransfer | null;
  onClose: () => void;
}

export function DeleteTransferModal({ transfer, onClose }: DeleteTransferModalProps) {
  const { accounts, refresh } = useFinance();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const fromName = accounts.find((a) => a.id === transfer?.from_account_id)?.name ?? 'Unknown account';
  const toName = accounts.find((a) => a.id === transfer?.to_account_id)?.name ?? 'Unknown account';

  const doDelete = async () => {
    if (!transfer) return;
    setBusy(true);
    setError('');
    let failed = false;
    try {
      await deleteTransfer(transfer);
    } catch (err) {
      failed = true;
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
    await refresh();
    setBusy(false);
    if (!failed) onClose();
  };

  return (
    <Modal
      open={!!transfer}
      onClose={onClose}
      title="Delete transfer?"
      size="sm"
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" fullWidth onClick={onClose}>Cancel</Button>
          <Button variant="danger" fullWidth onClick={doDelete} disabled={busy}>{busy ? 'Deleting…' : 'Delete'}</Button>
        </div>
      }
    >
      <p className="text-sm text-ink-600 dark:text-ink-300">
        Delete the transfer of <strong>{formatGBPFull(Number(transfer?.amount ?? 0))}</strong> from <strong>{fromName}</strong> to <strong>{toName}</strong>? Both balances will be restored.
      </p>
      {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
    </Modal>
  );
}
