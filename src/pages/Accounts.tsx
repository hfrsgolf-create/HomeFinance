import { useState, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, Wallet, Landmark, PiggyBank, Award, Home, Trash2, Pencil, ChevronRight, Gift, Percent, ArrowUp, ArrowDown, Minus, Filter, CreditCard, CalendarClock, Info, TrendingUp, GripVertical, ArrowLeftRight } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Select, Textarea } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/Feedback';
import { formatGBP, formatGBPFull, formatDate, todayISO, parseAmount } from '../lib/format';
import { AreaChart } from '../components/charts/AreaChart';
import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_COLORS, Account, AccountTransfer, AccountType, AccountUpdate, BondWinning, BondYearlyWinning, InterestRecord, Transaction } from '../lib/types';
import { deleteAccountUpdate, editAccountUpdate, deleteTransfer } from '../lib/accountActions';
import { buildBondYearTotals } from '../lib/bondWinnings';
import { TransactionModal, DeleteTransactionModal } from '../components/shared/TransactionModal';
import { TransferModal, DeleteTransferModal } from '../components/shared/TransferModal';

const typeIcons: Record<AccountType, typeof Wallet> = {
  bank: Landmark,
  savings: PiggyBank,
  premium_bonds: Award,
  pension: Wallet,
  credit: CreditCard,
  property: Home,
  isa: PiggyBank,
};

const ALL_ACCOUNT_TYPES: AccountType[] = ['bank', 'savings', 'isa', 'premium_bonds', 'pension', 'credit', 'property'];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 30 }, (_, i) => CURRENT_YEAR - i);

function ordinal(n: number) {
  return n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
}

interface AccountsPageProps {
  onOpenAccount: (id: string) => void;
  initialTypeFilter?: AccountType | null;
  onTypeFilterChange?: (t: AccountType) => void;
}

export function AccountsPage({ onOpenAccount, initialTypeFilter, onTypeFilterChange }: AccountsPageProps) {
  const { accounts, updates, transfers, winnings: allWinnings, bondYearlyWinnings, loading, refresh } = useFinance();
  const { session } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('bank');
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');
  const [taxLiability, setTaxLiability] = useState('');
  const [paymentDueDate, setPaymentDueDate] = useState('');
  const [initialDate, setInitialDate] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Account | null>(null);
  const [typeFilter, setTypeFilter] = useState<AccountType>(initialTypeFilter ?? 'bank');
  const [transferOpen, setTransferOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  const openAdd = () => {
    setEditing(null); setName(''); setType('bank'); setValue(''); setNotes(''); setTaxLiability(''); setPaymentDueDate(''); setInitialDate(todayISO());
    setModalOpen(true);
  };

  const openEdit = (acc: Account) => {
    setEditing(acc); setName(acc.name); setType(acc.type); setValue(String(acc.current_value));
    setNotes(acc.notes || ''); setTaxLiability(acc.estimated_tax_liability ? String(acc.estimated_tax_liability) : ''); setPaymentDueDate(acc.payment_due_date != null ? String(acc.payment_due_date) : '');
    setModalOpen(true);
  };

  const save = async () => {
    setBusy(true);
    const isCredit = type === 'credit';
    const sameTypeAccounts = accounts.filter((a) => a.type === type);
    const maxOrder = sameTypeAccounts.length > 0 ? Math.max(...sameTypeAccounts.map((a) => a.sort_order ?? 0)) : -1;
    const isPension = type === 'pension';
    const payload: Record<string, unknown> = {
      name: name.trim(), type, current_value: parseAmount(value), notes: notes.trim(),
      payment_due_date: isCredit && paymentDueDate ? parseInt(paymentDueDate) : null,
      estimated_tax_liability: isPension ? parseAmount(taxLiability || '0') : 0,
    };
    if (editing) {
      await supabase.from('accounts').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editing.id);
    } else {
      payload.sort_order = maxOrder + 1;
      const { data } = await supabase.from('accounts').insert(payload).select().single();
      if (data) {
        await supabase.from('account_updates').insert({
          account_id: data.id, user_id: session?.user.id,
          recorded_date: initialDate, balance: payload.current_value, adjustment: null, note: 'Initial balance',
        });
      }
    }
    await refresh();
    setBusy(false); setModalOpen(false); setTypeFilter(type);
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    const linkedTransfers = transfers.filter((tr) => tr.from_account_id === confirmDelete.id || tr.to_account_id === confirmDelete.id);
    for (const tr of linkedTransfers) await deleteTransfer(tr);
    await supabase.from('accounts').delete().eq('id', confirmDelete.id);
    await refresh(); setBusy(false); setConfirmDelete(null);
  };

  const handleTypeFilter = (t: AccountType) => {
    setTypeFilter(t);
    onTypeFilterChange?.(t);
  };

  const filteredAccounts = useMemo(
    () => [...accounts]
      .filter((a) => a.type === typeFilter)
      .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999)),
    [accounts, typeFilter]
  );

  const sortableIds = useMemo(() => filteredAccounts.map((a) => a.id), [filteredAccounts]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = filteredAccounts.findIndex((a) => a.id === active.id);
    const newIndex = filteredAccounts.findIndex((a) => a.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(filteredAccounts, oldIndex, newIndex);
    // Persist new sort_order values
    const updates = reordered.map((acc, i) =>
      supabase.from('accounts').update({ sort_order: i, updated_at: new Date().toISOString() }).eq('id', acc.id)
    );
    await Promise.all(updates);
    await refresh();
  };

  const getTrend = (accountId: string) => {
    const accUpdates = updates
      .filter((u) => u.account_id === accountId)
      .sort((a, b) => b.recorded_date.localeCompare(a.recorded_date));
    if (accUpdates.length === 0) return null;
    const prev = accUpdates.length >= 2 ? Number(accUpdates[1].balance) : 0;
    const change = Number(accUpdates[0].balance) - prev;
    return { change, direction: change > 0.005 ? 'up' : change < -0.005 ? 'down' : 'flat' } as const;
  };

  const getAccountTotalWinnings = (accountId: string) =>
    buildBondYearTotals(
      allWinnings.filter((w) => w.account_id === accountId),
      bondYearlyWinnings.filter((y) => y.account_id === accountId)
    ).reduce((s, y) => s + y.total, 0);

  if (loading) return null;
  const isCredit = type === 'credit';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink-900 dark:text-ink-50">Accounts</h1>
          <p className="text-sm text-ink-400">{accounts.length} account{accounts.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setTransferOpen(true)} size="sm"><ArrowLeftRight size={16} /> Transfer Money</Button>
          <Button onClick={openAdd} size="sm"><Plus size={16} /> Add</Button>
        </div>
      </div>

      {accounts.length === 0 ? (
        <Card>
          <EmptyState icon={<Wallet size={40} />} title="No accounts yet"
            message="Add your bank accounts, savings, ISAs, pensions, premium bonds, credit accounts, and property to track your net worth."
            action={<Button onClick={openAdd} size="sm"><Plus size={16} /> Add your first account</Button>} />
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            <Filter size={14} className="text-ink-400 shrink-0" />
            {ALL_ACCOUNT_TYPES.map((t) => (
              <button key={t} onClick={() => handleTypeFilter(t)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors shrink-0 ${
                  typeFilter === t ? 'bg-brand-600 text-white' : 'bg-ink-100 dark:bg-ink-800 text-ink-500 dark:text-ink-400 hover:bg-ink-200 dark:hover:bg-ink-700'
                }`}>{ACCOUNT_TYPE_LABELS[t]}</button>
            ))}
          </div>

          {typeFilter === 'credit' && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/20 text-xs text-ink-600 dark:text-ink-300">
              <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
              <p>Credit account balances show <strong>0 when nothing is owed</strong> and a <strong>negative value when you owe money</strong>. Spending is entered as a negative amount; repayments bring the balance back toward zero.</p>
            </div>
          )}

          <div className="space-y-3">
            {filteredAccounts.length === 0 ? (
              <Card>
                <EmptyState icon={<Wallet size={40} />} title={`No ${ACCOUNT_TYPE_LABELS[typeFilter].toLowerCase()} accounts`}
                  message={`You don't have any ${ACCOUNT_TYPE_LABELS[typeFilter].toLowerCase()} accounts yet.`}
                  action={<Button onClick={openAdd} size="sm"><Plus size={16} /> Add account</Button>} />
              </Card>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                  {filteredAccounts.map((acc) => (
                    <SortableAccountCard
                      key={acc.id}
                      acc={acc}
                      onOpen={() => onOpenAccount(acc.id)}
                      onEdit={() => openEdit(acc)}
                      onDelete={() => setConfirmDelete(acc)}
                      trend={getTrend(acc.id)}
                      totalWon={acc.type === 'premium_bonds' ? getAccountTotalWinnings(acc.id) : 0}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>
        </>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Account' : 'Add Account'}
        footer={<div className="flex gap-2">
          <Button variant="secondary" fullWidth onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button fullWidth onClick={save} disabled={busy || !name.trim()}>{busy ? 'Saving…' : 'Save'}</Button>
        </div>}>
        <div className="space-y-4">
          <Input label="Account name" placeholder="e.g. Carl's Chase, Joint Savings" value={name} onChange={(e) => setName(e.target.value)} />
          <Select label="Type" value={type} onChange={(e) => setType(e.target.value as AccountType)}>
            {ALL_ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{ACCOUNT_TYPE_LABELS[t]}</option>)}
          </Select>
          <Input label={isCredit ? 'Current balance (0 or negative if owed)' : 'Current value'} type="number" inputMode="decimal" prefix="£" placeholder="0" value={value} onChange={(e) => setValue(e.target.value)} />
          {!editing && Number(value) !== 0 && (
            <Input label="Initial balance date" type="date" value={initialDate} onChange={(e) => setInitialDate(e.target.value)}
              hint="When was this balance current? Defaults to today." />
          )}
          {isCredit && (
            <>
              <Input label="Payment due date (day of month)" type="number" inputMode="numeric" placeholder="e.g. 15"
                value={paymentDueDate} onChange={(e) => setPaymentDueDate(e.target.value)} hint="Day of month your payment is due (1–31)" />
              <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/20 text-xs text-ink-600 dark:text-ink-300">
                <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
                <p>Enter <strong>0</strong> when nothing is owed, or a <strong>negative value</strong> for the amount owed. Spending is entered as negative transactions; repayments bring the balance toward zero.</p>
              </div>
            </>
          )}
          {type === 'pension' && (
            <Input label="Estimated Tax Liability" type="number" inputMode="decimal" prefix="£" placeholder="0"
              value={taxLiability} onChange={(e) => setTaxLiability(e.target.value)}
              hint="Display only — does not affect balance or transactions" />
          )}
          <Textarea label="Notes (optional)" rows={2} placeholder="Any notes about this account" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete account?" size="sm"
        footer={<div className="flex gap-2">
          <Button variant="secondary" fullWidth onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button variant="danger" fullWidth onClick={doDelete} disabled={busy}>{busy ? 'Deleting…' : 'Delete'}</Button>
        </div>}>
        <p className="text-sm text-ink-600 dark:text-ink-300">
          Permanently delete <strong>{confirmDelete?.name}</strong>? All balance history will be lost.
        </p>
      </Modal>
      <TransferModal open={transferOpen} onClose={() => setTransferOpen(false)} editing={null} />
    </div>
  );
}

interface SortableAccountCardProps {
  acc: Account;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  trend: { change: number; direction: 'up' | 'down' | 'flat' } | null;
  totalWon: number;
}

function SortableAccountCard({ acc, onOpen, onEdit, onDelete, trend, totalWon }: SortableAccountCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: acc.id });
  const Icon = typeIcons[acc.type];

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.8 : 1,
  };

  const cardBg = ACCOUNT_TYPE_COLORS[acc.type] + '15';
  const cardBorder = ACCOUNT_TYPE_COLORS[acc.type] + '30';

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, backgroundColor: cardBg, borderColor: cardBorder }}
      className={`rounded-2xl shadow-card border ${
        isDragging ? 'shadow-card-hover ring-2 ring-brand-400' : ''
      }`}
    >
      <div className="flex items-center gap-2 p-4">
        <button
          {...attributes}
          {...listeners}
          className="p-1.5 -ml-1 rounded-lg text-ink-300 hover:text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800 cursor-grab active:cursor-grabbing touch-none shrink-0"
          aria-label="Drag to reorder"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={18} />
        </button>

        <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={onOpen}>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: ACCOUNT_TYPE_COLORS[acc.type] + '25' }}>
            <Icon size={20} style={{ color: ACCOUNT_TYPE_COLORS[acc.type] }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-ink-900 dark:text-ink-50 truncate">{acc.name}</p>
            <p className="text-xs text-ink-400">{ACCOUNT_TYPE_LABELS[acc.type]}</p>
            {acc.type === 'credit' && acc.payment_due_date && (
              <div className="flex items-center gap-1 mt-0.5">
                <CalendarClock size={11} className="text-amber-500" />
                <span className="text-xs text-ink-400">Due {acc.payment_due_date}{ordinal(acc.payment_due_date)}</span>
              </div>
            )}
            {trend && (() => {
              const TrendIcon = trend.direction === 'up' ? ArrowUp : trend.direction === 'down' ? ArrowDown : Minus;
              const cls = trend.direction === 'up' ? 'text-green-600 dark:text-green-400' : trend.direction === 'down' ? 'text-red-500' : 'text-ink-400';
              return (
                <div className={`flex items-center gap-0.5 mt-0.5 ${cls}`}>
                  <TrendIcon size={12} />
                  <span className="text-xs font-medium">{formatGBP(Math.abs(trend.change), { compact: true })}</span>
                </div>
              );
            })()}
            {acc.type === 'premium_bonds' && totalWon > 0 && (
              <div className="flex items-center gap-0.5 mt-0.5 text-amber-600 dark:text-amber-400">
                <Gift size={11} />
                <span className="text-xs font-medium">{formatGBP(totalWon, { compact: true })} total won</span>
              </div>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className={`font-bold ${acc.type === 'credit' && Number(acc.current_value) < 0 ? 'text-red-500' : 'text-ink-900 dark:text-ink-50'}`}>
              {formatGBP(acc.current_value)}
            </p>
            {acc.type === 'pension' && Number(acc.estimated_tax_liability) > 0 && (
              <p className="text-xs font-medium text-red-500 mt-0.5">
                Tax: {formatGBPFull(Number(acc.estimated_tax_liability))}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button onClick={onEdit} className="p-2 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-400 transition-colors"><Pencil size={15} /></button>
          <button onClick={onDelete} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-ink-400 hover:text-red-500 transition-colors"><Trash2 size={15} /></button>
          <ChevronRight size={18} className="text-ink-300 dark:text-ink-600" />
        </div>
      </div>
      {acc.notes && <p className="text-xs text-ink-400 mt-2 pl-14 pb-4 truncate">{acc.notes}</p>}
    </div>
  );
}

// ─── Account Detail ──────────────────────────────────────────────────────────

interface AccountDetailProps {
  accountId: string;
  onBack: () => void;
}

export function AccountDetail({ accountId, onBack }: AccountDetailProps) {
  const { accounts, updates, transactions, transfers, winnings, bondYearlyWinnings, interestRecords, refresh, loading } = useFinance();
  const account = accounts.find((a) => a.id === accountId);

  const [updateModal, setUpdateModal] = useState(false);
  const [updateMode, setUpdateMode] = useState<'balance' | 'adjustment' | 'interest'>('balance');
  const [updateValue, setUpdateValue] = useState('');
  const [updateDate, setUpdateDate] = useState(todayISO());
  const [updateNote, setUpdateNote] = useState('');
  const [editingInterest, setEditingInterest] = useState<InterestRecord | null>(null);
  const [busy, setBusy] = useState(false);

  const [winningModal, setWinningModal] = useState(false);
  const [winDate, setWinDate] = useState(todayISO());
  const [winAmount, setWinAmount] = useState('');
  const [winNote, setWinNote] = useState('');
  const [editingWin, setEditingWin] = useState<BondWinning | null>(null);
  const [confirmDeleteWin, setConfirmDeleteWin] = useState<BondWinning | null>(null);

  const [yearlyModal, setYearlyModal] = useState(false);
  const [editingYearly, setEditingYearly] = useState<BondYearlyWinning | null>(null);
  const [yearlyYear, setYearlyYear] = useState(String(CURRENT_YEAR - 1));
  const [yearlyAmount, setYearlyAmount] = useState('');
  const [confirmDeleteYearly, setConfirmDeleteYearly] = useState<BondYearlyWinning | null>(null);

  const [confirmDeleteInt, setConfirmDeleteInt] = useState<InterestRecord | null>(null);

  const [editingUpdate, setEditingUpdate] = useState<AccountUpdate | null>(null);
  const [updateEditModal, setUpdateEditModal] = useState(false);
  const [editBalValue, setEditBalValue] = useState('');
  const [editBalDate, setEditBalDate] = useState(todayISO());
  const [editBalNote, setEditBalNote] = useState('');
  const [confirmDeleteUpdate, setConfirmDeleteUpdate] = useState<AccountUpdate | null>(null);

  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [confirmDeleteTx, setConfirmDeleteTx] = useState<Transaction | null>(null);

  const [editingTransfer, setEditingTransfer] = useState<AccountTransfer | null>(null);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [confirmDeleteTransfer, setConfirmDeleteTransfer] = useState<AccountTransfer | null>(null);

  const [paymentModal, setPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentSourceId, setPaymentSourceId] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayISO());
  const [paymentNote, setPaymentNote] = useState('');

  const isPremiumBonds = account?.type === 'premium_bonds';
  const isBankOrISA = account?.type === 'bank' || account?.type === 'isa' || account?.type === 'savings';
  const isCredit = account?.type === 'credit';
  const isPension = account?.type === 'pension';

  type DetailTab = 'balance' | 'interest' | 'events';
  const [selectedTab, setDetailTab] = useState<DetailTab | null>(null);
  const defaultTab: DetailTab = isPremiumBonds ? 'interest' : 'balance';
  const detailTab: DetailTab = selectedTab && !(isPremiumBonds && selectedTab === 'events') ? selectedTab : defaultTab;
  const detailTabs: { id: DetailTab; label: string }[] = isPremiumBonds
    ? [{ id: 'interest', label: 'Winnings History' }, { id: 'balance', label: 'Balance Update' }]
    : [{ id: 'balance', label: 'Balance Update' }, { id: 'interest', label: 'Interest History' }, { id: 'events', label: 'Related Events' }];

  const accUpdates = updates
    .filter((u) => u.account_id === accountId)
    .sort((a, b) => b.recorded_date.localeCompare(a.recorded_date));

  const accTransactions = transactions
    .filter((t) => t.account_id === accountId)
    .sort((a, b) => b.date.localeCompare(a.date));

  const accWinnings = winnings
    .filter((w) => w.account_id === accountId)
    .sort((a, b) => b.date.localeCompare(a.date));

  const accYearlyWinnings = useMemo(
    () => bondYearlyWinnings.filter((y) => y.account_id === accountId).sort((a, b) => b.year - a.year),
    [bondYearlyWinnings, accountId]
  );

  const accInterest = interestRecords
    .filter((r) => r.account_id === accountId)
    .sort((a, b) => b.date.localeCompare(a.date));

  const yearStart = `${CURRENT_YEAR}-01-01`;
  const ytdWinnings = useMemo(
    () => accWinnings.filter((w) => w.date >= yearStart).reduce((s, w) => s + Number(w.amount), 0),
    [accWinnings, yearStart]
  );

  const yearTotals = useMemo(
    () => buildBondYearTotals(accWinnings, accYearlyWinnings),
    [accWinnings, accYearlyWinnings]
  );

  const totalWinnings = useMemo(() => yearTotals.reduce((s, y) => s + y.total, 0), [yearTotals]);

  const ytdInterest = accInterest
    .filter((r) => r.date >= yearStart)
    .reduce((s, r) => s + Number(r.amount), 0);

  const chartData = [...accUpdates]
    .sort((a, b) => a.recorded_date.localeCompare(b.recorded_date))
    .map((u) => ({ label: formatDate(u.recorded_date), value: Number(u.balance) }));

  const openUpdate = () => {
    setEditingInterest(null);
    setUpdateMode('balance'); setUpdateValue(''); setUpdateDate(todayISO()); setUpdateNote('');
    setUpdateModal(true);
  };

  const openAddInterest = () => {
    setEditingInterest(null);
    setUpdateMode('interest'); setUpdateValue(''); setUpdateDate(todayISO()); setUpdateNote('');
    setUpdateModal(true);
  };

  const openEditInterest = (r: InterestRecord) => {
    setEditingInterest(r);
    setUpdateMode('interest'); setUpdateValue(String(r.amount));
    setUpdateDate(r.date.slice(0, 10)); setUpdateNote(r.note || '');
    setUpdateModal(true);
  };

  const saveUpdate = async () => {
    if (!account) return;
    setBusy(true);

    if (updateMode === 'interest') {
      const amt = parseAmount(updateValue);
      if (amt <= 0) { setBusy(false); return; }
      const payload = { account_id: accountId, date: updateDate, amount: amt, note: updateNote.trim() || 'Interest earned' };
      if (editingInterest) await supabase.from('interest_records').update(payload).eq('id', editingInterest.id);
      else await supabase.from('interest_records').insert(payload);
      await refresh(); setBusy(false); setUpdateModal(false);
      return;
    }

    const entered = parseAmount(updateValue);
    const newBalance = updateMode === 'balance' ? entered : Number(account.current_value) + entered;
    const adjustment = updateMode === 'adjustment' ? entered : null;

    await supabase.from('account_updates').insert({
      account_id: accountId, recorded_date: updateDate, balance: newBalance, adjustment, note: updateNote.trim(),
    });
    await supabase.from('accounts').update({ current_value: newBalance, updated_at: new Date().toISOString() }).eq('id', accountId);
    await refresh(); setBusy(false); setUpdateModal(false);
  };

  const openAddWinning = () => {
    setEditingWin(null); setWinDate(todayISO()); setWinAmount(''); setWinNote('');
    setWinningModal(true);
  };

  const openEditWinning = (w: BondWinning) => {
    setEditingWin(w); setWinDate(w.date.slice(0, 10)); setWinAmount(String(w.amount)); setWinNote(w.note || '');
    setWinningModal(true);
  };

  const saveWinning = async () => {
    setBusy(true);
    const payload = { account_id: accountId, date: winDate, amount: parseAmount(winAmount), note: winNote.trim() };
    if (editingWin) await supabase.from('bond_winnings').update(payload).eq('id', editingWin.id);
    else await supabase.from('bond_winnings').insert(payload);
    await refresh(); setBusy(false); setWinningModal(false);
  };

  const doDeleteWinning = async () => {
    if (!confirmDeleteWin) return;
    setBusy(true);
    await supabase.from('bond_winnings').delete().eq('id', confirmDeleteWin.id);
    await refresh(); setBusy(false); setConfirmDeleteWin(null);
  };

  const openAddYearly = () => {
    setEditingYearly(null);
    const taken = new Set(yearTotals.map((y) => y.year));
    let yr = CURRENT_YEAR - 1;
    while (taken.has(yr) && yr > 1990) yr--;
    setYearlyYear(String(yr));
    setYearlyAmount('');
    setYearlyModal(true);
  };

  const openEditYearly = (y: BondYearlyWinning) => {
    setEditingYearly(y); setYearlyYear(String(y.year)); setYearlyAmount(String(y.amount));
    setYearlyModal(true);
  };

  const yearlyUsesMonthly = accWinnings.some((w) => w.date.slice(0, 4) === yearlyYear);

  const saveYearly = async () => {
    setBusy(true);
    const yr = parseInt(yearlyYear);
    const amt = parseAmount(yearlyAmount);

    if (editingYearly) {
      await supabase.from('bond_yearly_winnings').update({
        year: yr, amount: amt, updated_at: new Date().toISOString(),
      }).eq('id', editingYearly.id);
    } else {
      await supabase.from('bond_yearly_winnings').upsert({
        account_id: accountId, year: yr, amount: amt, updated_at: new Date().toISOString(),
      }, { onConflict: 'account_id,year' });
    }
    await refresh(); setBusy(false); setYearlyModal(false);
  };

  const doDeleteYearly = async () => {
    if (!confirmDeleteYearly) return;
    setBusy(true);
    await supabase.from('bond_yearly_winnings').delete().eq('id', confirmDeleteYearly.id);
    await refresh(); setBusy(false); setConfirmDeleteYearly(null);
  };

  const openPayment = () => {
    setPaymentAmount(''); setPaymentSourceId(''); setPaymentDate(todayISO()); setPaymentNote('');
    setPaymentModal(true);
  };

  const makePayment = async () => {
    if (!account) return;
    const amt = parseAmount(paymentAmount);
    if (amt <= 0 || !paymentSourceId) return;
    setBusy(true);
    const sourceAccount = accounts.find((a) => a.id === paymentSourceId);
    if (!sourceAccount) { setBusy(false); return; }

    const newCreditBalance = Number(account.current_value) + amt;
    await supabase.from('accounts').update({ current_value: newCreditBalance, updated_at: new Date().toISOString() }).eq('id', accountId);
    await supabase.from('account_updates').insert({
      account_id: accountId, recorded_date: paymentDate, balance: newCreditBalance, adjustment: amt, note: `Payment from ${sourceAccount.name}`,
    });

    const newSourceBalance = Number(sourceAccount.current_value) - amt;
    await supabase.from('accounts').update({ current_value: newSourceBalance, updated_at: new Date().toISOString() }).eq('id', paymentSourceId);
    await supabase.from('account_updates').insert({
      account_id: paymentSourceId, recorded_date: paymentDate, balance: newSourceBalance, adjustment: -amt, note: `Payment to ${account.name}`,
    });

    if (amt > 100) {
      await supabase.from('transactions').insert({
        date: paymentDate,
        description: `Credit card payment: ${account.name}`,
        amount: -amt,
        account_id: paymentSourceId,
        category: 'Other',
        note: paymentNote.trim() || `Payment to ${account.name}`,
      });
    }

    await refresh(); setBusy(false); setPaymentModal(false);
  };

  const doDeleteInterest = async () => {
    if (!confirmDeleteInt) return;
    setBusy(true);
    await supabase.from('interest_records').delete().eq('id', confirmDeleteInt.id);
    await refresh(); setBusy(false); setConfirmDeleteInt(null);
  };

  const openEditUpdate = (u: AccountUpdate) => {
    setEditingUpdate(u);
    setEditBalValue(String(u.balance));
    setEditBalDate(u.recorded_date.slice(0, 10));
    setEditBalNote(u.note || '');
    setUpdateEditModal(true);
  };

  const saveEditUpdate = async () => {
    if (!editingUpdate) return;
    setBusy(true);
    await editAccountUpdate(editingUpdate, editBalDate, parseAmount(editBalValue), editBalNote);
    await refresh(); setBusy(false); setUpdateEditModal(false); setEditingUpdate(null);
  };

  const doDeleteUpdate = async () => {
    if (!confirmDeleteUpdate) return;
    setBusy(true);
    await deleteAccountUpdate(confirmDeleteUpdate);
    await refresh(); setBusy(false); setConfirmDeleteUpdate(null);
  };

  const openEditTx = (tx: Transaction) => { setEditingTx(tx); setTxModalOpen(true); };
  const openDeleteTx = (tx: Transaction) => setConfirmDeleteTx(tx);
  const findTransfer = (id: string | null) => transfers.find((t) => t.id === id) ?? null;
  const openEditTransfer = (t: AccountTransfer) => { setEditingTransfer(t); setTransferModalOpen(true); };

  if (loading || !account) return null;
  const Icon = typeIcons[account.type];

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="text-sm text-ink-500 hover:text-ink-800 dark:hover:text-ink-200 flex items-center gap-1">
        ← Back to accounts
      </button>

      <Card className="p-5" style={{ backgroundColor: ACCOUNT_TYPE_COLORS[account.type] + '12', borderColor: ACCOUNT_TYPE_COLORS[account.type] + '30' }}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: ACCOUNT_TYPE_COLORS[account.type] + '25' }}>
              <Icon size={24} style={{ color: ACCOUNT_TYPE_COLORS[account.type] }} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-ink-900 dark:text-ink-50">{account.name}</h1>
              <p className="text-sm text-ink-400">{ACCOUNT_TYPE_LABELS[account.type]}</p>
              {isCredit && account.payment_due_date && (
                <div className="flex items-center gap-1 mt-1">
                  <CalendarClock size={12} className="text-amber-500" />
                  <span className="text-xs text-ink-400">Payment due {account.payment_due_date}{ordinal(account.payment_due_date)} of each month</span>
                </div>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className={`text-2xl font-bold ${isCredit && Number(account.current_value) < 0 ? 'text-red-500' : 'text-ink-900 dark:text-ink-50'}`}>
              {formatGBPFull(account.current_value)}
            </p>
            {isPension && Number(account.estimated_tax_liability) > 0 && (
              <p className="text-sm font-medium text-red-500 mt-1">
                Tax Liability: {formatGBPFull(Number(account.estimated_tax_liability))}
              </p>
            )}
          </div>
        </div>
        {isCredit && (
          <div className="flex items-start gap-2 p-3 mt-3 rounded-xl bg-blue-50 dark:bg-blue-950/20 text-xs text-ink-600 dark:text-ink-300">
            <Info size={13} className="text-blue-500 shrink-0 mt-0.5" />
            <p>Balance shows <strong>0 when nothing is owed</strong> and a <strong>negative value when money is owed</strong>. This account is excluded from net worth calculations.</p>
          </div>
        )}
        {account.notes && (
          <p className="text-sm text-ink-500 dark:text-ink-400 mt-3 pt-3 border-t border-ink-100 dark:border-ink-800">
            {account.notes}
          </p>
        )}
        <div className="flex flex-wrap gap-2 mt-4">
          <Button onClick={openUpdate} size="sm"><Plus size={16} /> Update balance</Button>
          {isBankOrISA && (
            <Button onClick={openAddInterest} variant="secondary" size="sm"><Percent size={16} /> Add interest</Button>
          )}
          {isCredit && (
            <Button onClick={openPayment} variant="secondary" size="sm"><CreditCard size={16} /> Make Payment</Button>
          )}
          {isPremiumBonds && (
            <>
              <Button onClick={openAddWinning} variant="secondary" size="sm"><Gift size={16} /> Log monthly win</Button>
              <Button onClick={openAddYearly} variant="secondary" size="sm"><TrendingUp size={16} /> Add yearly total</Button>
            </>
          )}
        </div>
      </Card>

      {isPremiumBonds && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-4 bg-amber-50/50 dark:bg-amber-950/20">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                <Award size={14} className="text-amber-600 dark:text-amber-400" />
              </div>
              <p className="text-xs font-medium text-ink-500 dark:text-ink-400">Balance</p>
            </div>
            <p className="text-lg font-bold text-ink-900 dark:text-ink-50">{formatGBPFull(account.current_value)}</p>
          </Card>
          <Card className="p-4 bg-amber-50/50 dark:bg-amber-950/20">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                <Gift size={14} className="text-amber-600 dark:text-amber-400" />
              </div>
              <p className="text-xs font-medium text-ink-500 dark:text-ink-400">This Year</p>
            </div>
            <p className="text-lg font-bold text-ink-900 dark:text-ink-50">{formatGBPFull(ytdWinnings)}</p>
            <p className="text-[10px] text-ink-400 mt-0.5">{CURRENT_YEAR} monthly entries</p>
          </Card>
          <Card className="p-4 bg-amber-50/50 dark:bg-amber-950/20">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                <TrendingUp size={14} className="text-amber-600 dark:text-amber-400" />
              </div>
              <p className="text-xs font-medium text-ink-500 dark:text-ink-400">All-Time Won</p>
            </div>
            <p className="text-lg font-bold text-ink-900 dark:text-ink-50">{formatGBPFull(totalWinnings)}</p>
            <p className="text-[10px] text-ink-400 mt-0.5">this account only</p>
          </Card>
        </div>
      )}

      {isBankOrISA && (
        <Card className="p-4 bg-brand-50/50 dark:bg-brand-900/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center">
                <Percent size={18} className="text-brand-600 dark:text-brand-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-ink-500 dark:text-ink-400">Interest earned (year-to-date)</p>
                <p className="text-xl font-bold text-ink-900 dark:text-ink-50">{formatGBPFull(ytdInterest)}</p>
              </div>
            </div>
            <p className="text-xs text-ink-400 max-w-[140px] text-right">Tracked as income — separate from balance</p>
          </div>
        </Card>
      )}

      {/* Detail tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {detailTabs.map((tab) => (
          <button key={tab.id} onClick={() => setDetailTab(tab.id)} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors shrink-0 ${detailTab === tab.id ? 'bg-brand-600 text-white' : 'bg-ink-100 dark:bg-ink-800 text-ink-500 dark:text-ink-400 hover:bg-ink-200 dark:hover:bg-ink-700'}`}>{tab.label}</button>
        ))}
      </div>

      {detailTab === 'balance' && !isPremiumBonds && (
        <Card>
          <div className="p-5 pb-3">
            <h3 className="font-semibold text-ink-900 dark:text-ink-50 text-sm">Value History</h3>
          </div>
          <div className="px-3 pb-4">
            {chartData.length > 0 ? (
              <AreaChart data={chartData} color={ACCOUNT_TYPE_COLORS[account.type]}
                formatValue={(v: number) => formatGBP(v, { compact: true })} />
            ) : (
              <div className="h-[200px] flex items-center justify-center text-sm text-ink-400">
                No history yet — update the balance to start tracking
              </div>
            )}
          </div>
        </Card>
      )}

      {detailTab === 'interest' && isPremiumBonds && (
        <Card>
          <CardHeader
            title={`Monthly Winnings (${accWinnings.length})`}
            icon={<Gift size={16} className="text-amber-500" />}
            action={
              <button onClick={openAddWinning}
                className="text-xs font-medium text-brand-600 dark:text-brand-400 flex items-center gap-1">
                <Plus size={14} /> Add
              </button>
            }
          />
          {accWinnings.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-ink-400">
              No monthly winnings logged. Premium Bond prizes are paid into your bank — they do not change your bond balance.
            </p>
          ) : (
            <div className="max-h-[280px] overflow-y-auto overscroll-contain divide-y divide-ink-100 dark:divide-ink-800">
              {accWinnings.map((w, i) => (
                <div key={w.id} className={`flex items-center justify-between px-5 py-3 ${i % 2 === 1 ? 'bg-ink-50/50 dark:bg-ink-850/30' : ''}`}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-800 dark:text-ink-100">{formatDate(w.date)}</p>
                    {w.note && <p className="text-xs text-ink-400 mt-0.5 truncate">{w.note}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                      {formatGBPFull(Number(w.amount))}
                    </span>
                    <button onClick={() => openEditWinning(w)}
                      className="p-1.5 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-400 transition-colors">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => setConfirmDeleteWin(w)}
                      className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-ink-400 hover:text-red-500 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {detailTab === 'interest' && isPremiumBonds && (
        <Card>
          <CardHeader
            title="Winnings by Year"
            icon={<TrendingUp size={16} className="text-amber-500" />}
            action={
              <button onClick={openAddYearly}
                className="text-xs font-medium text-brand-600 dark:text-brand-400 flex items-center gap-1">
                <Plus size={14} /> Add year
              </button>
            }
          />
          {yearTotals.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-ink-400">
              No winnings recorded yet. Log monthly winnings, or use "Add yearly total" for earlier years without monthly entries.
            </p>
          ) : (
            <div className="max-h-[280px] overflow-y-auto overscroll-contain overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white dark:bg-ink-900 z-10">
                  <tr className="border-b border-ink-100 dark:border-ink-800 text-xs text-ink-400">
                    <th className="text-left font-medium px-5 py-2">Year</th>
                    <th className="text-right font-medium px-3 py-2">Total Winnings</th>
                    <th className="px-3 py-2 w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {yearTotals.map((y, i) => {
                    const manual = accYearlyWinnings.find((m) => m.year === y.year);
                    return (
                      <tr key={y.year}
                        className={`border-b border-ink-50 dark:border-ink-850 hover:bg-ink-50 dark:hover:bg-ink-850/50 transition-colors ${i % 2 === 1 ? 'bg-ink-50/50 dark:bg-ink-850/30' : ''}`}>
                        <td className="px-5 py-3 font-semibold text-ink-900 dark:text-ink-50">
                          {y.year}
                        </td>
                        <td className="text-right px-3 py-3 font-semibold text-amber-600 dark:text-amber-400">
                          {formatGBPFull(y.total)}
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          {manual && (
                            <>
                              <button onClick={() => openEditYearly(manual)}
                                className="p-1.5 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 transition-colors">
                                <Pencil size={13} />
                              </button>
                              <button onClick={() => setConfirmDeleteYearly(manual)}
                                className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-ink-400 hover:text-red-500 transition-colors ml-1">
                                <Trash2 size={13} />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {detailTab === 'interest' && isBankOrISA && (
        <Card>
          <div className="p-5 pb-3">
            <h3 className="font-semibold text-ink-900 dark:text-ink-50 text-sm">Interest History ({accInterest.length})</h3>
          </div>
          {accInterest.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-ink-400">No interest recorded yet.</p>
          ) : (
            <div className="max-h-[280px] overflow-y-auto overscroll-contain divide-y divide-ink-100 dark:divide-ink-800">
              {accInterest.map((r, i) => (
                <div key={r.id} className={`flex items-center justify-between px-5 py-3 ${i % 2 === 1 ? 'bg-ink-50/50 dark:bg-ink-850/30' : ''}`}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-800 dark:text-ink-100">{formatDate(r.date)}</p>
                    {r.note && <p className="text-xs text-ink-400 mt-0.5 truncate">{r.note}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-semibold text-brand-600 dark:text-brand-400">
                      {formatGBPFull(Number(r.amount))}
                    </span>
                    <button onClick={() => openEditInterest(r)}
                      className="p-1.5 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-400 transition-colors">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => setConfirmDeleteInt(r)}
                      className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-ink-400 hover:text-red-500 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {detailTab === 'interest' && !isBankOrISA && !isPremiumBonds && (
        <Card>
          <p className="px-5 pb-5 text-sm text-ink-400 pt-3">No interest history for this account type.</p>
        </Card>
      )}

      {detailTab === 'balance' && (
      <Card>
        <div className="p-5 pb-3">
          <h3 className="font-semibold text-ink-900 dark:text-ink-50 text-sm">Balance Updates ({accUpdates.length})</h3>
        </div>
        {accUpdates.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-ink-400">No updates recorded.</p>
        ) : (
          <div className="max-h-[280px] overflow-y-auto overscroll-contain divide-y divide-ink-100 dark:divide-ink-800">
            {accUpdates.map((u, i) => (
              <div key={u.id} className={`flex items-center justify-between px-5 py-3 ${i % 2 === 1 ? 'bg-ink-50/50 dark:bg-ink-850/30' : ''}`}>
                <div>
                  <p className="text-sm font-medium text-ink-800 dark:text-ink-100">{formatDate(u.recorded_date)}</p>
                  {u.note && <p className="text-xs text-ink-400 mt-0.5">{u.note}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-ink-900 dark:text-ink-50">{formatGBPFull(Number(u.balance))}</p>
                    {u.adjustment !== null && (
                      <p className={`text-xs ${Number(u.adjustment) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                        {formatGBP(Number(u.adjustment), { sign: true })}
                      </p>
                    )}
                  </div>
                  {u.transfer_id ? (
                    <>
                      <button onClick={() => { const t = findTransfer(u.transfer_id); if (t) openEditTransfer(t); }}
                        className="p-1.5 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-400 transition-colors">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => setConfirmDeleteTransfer(findTransfer(u.transfer_id))}
                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-ink-400 hover:text-red-500 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => openEditUpdate(u)}
                        className="p-1.5 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-400 transition-colors">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => setConfirmDeleteUpdate(u)}
                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-ink-400 hover:text-red-500 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      )}

      {detailTab === 'events' && (
      <Card>
        <div className="p-5 pb-3">
          <h3 className="font-semibold text-ink-900 dark:text-ink-50 text-sm">Related Events ({accTransactions.length})</h3>
        </div>
        {accTransactions.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-ink-400">No events linked to this account.</p>
        ) : (
          <div className="max-h-[280px] overflow-y-auto overscroll-contain divide-y divide-ink-100 dark:divide-ink-800">
            {accTransactions.map((tx, i) => (
              <div key={tx.id} className={`flex items-center justify-between px-5 py-3 ${i % 2 === 1 ? 'bg-ink-50/50 dark:bg-ink-850/30' : ''}`}>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink-800 dark:text-ink-100">{tx.description}</p>
                  <p className="text-xs text-ink-400">{formatDate(tx.date)}</p>
                  {tx.note && <p className="text-xs text-ink-400 mt-0.5 italic truncate">{tx.note}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className={`text-sm font-semibold ${tx.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                    {formatGBP(tx.amount, { sign: true })}
                  </span>
                  <button onClick={() => openEditTx(tx)}
                    className="p-1.5 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-400 transition-colors">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => openDeleteTx(tx)}
                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-ink-400 hover:text-red-500 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      )}

      <Modal open={updateModal} onClose={() => setUpdateModal(false)}
        title={updateMode === 'interest' ? (editingInterest ? 'Edit Interest' : 'Add Interest') : 'Update Balance'}
        footer={<div className="flex gap-2">
          <Button variant="secondary" fullWidth onClick={() => setUpdateModal(false)}>Cancel</Button>
          <Button fullWidth onClick={saveUpdate} disabled={busy || !updateValue || (updateMode === 'interest' && parseAmount(updateValue) <= 0)}>{busy ? 'Saving…' : (updateMode === 'interest' ? (editingInterest ? 'Save changes' : 'Add interest') : 'Save update')}</Button>
        </div>}>
        <div className="space-y-4">
          <div className="flex bg-ink-100 dark:bg-ink-800 rounded-xl p-1">
            <button onClick={() => { setUpdateMode('balance'); setUpdateValue(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${updateMode === 'balance' ? 'bg-white dark:bg-ink-700 text-ink-900 dark:text-ink-50 shadow-sm' : 'text-ink-500'}`}>
              New balance
            </button>
            <button onClick={() => { setUpdateMode('adjustment'); setUpdateValue(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${updateMode === 'adjustment' ? 'bg-white dark:bg-ink-700 text-ink-900 dark:text-ink-50 shadow-sm' : 'text-ink-500'}`}>
              + / − Adjustment
            </button>
            {isBankOrISA && (
              <button onClick={() => { setUpdateMode('interest'); setUpdateValue(''); }}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${updateMode === 'interest' ? 'bg-white dark:bg-ink-700 text-ink-900 dark:text-ink-50 shadow-sm' : 'text-ink-500'}`}>
                Interest
              </button>
            )}
          </div>

          {updateMode === 'interest' ? (
            <>
              <div className="flex items-start gap-2 p-3 rounded-xl bg-brand-50 dark:bg-brand-950/20 text-xs text-ink-600 dark:text-ink-300">
                <Percent size={16} className="text-brand-500 shrink-0 mt-0.5" />
                <p>Interest is tracked separately as income. It does <strong>not</strong> change your account balance.</p>
              </div>
              <Input label="Interest amount" type="number" inputMode="decimal" prefix="£" placeholder="0"
                value={updateValue} onChange={(e) => setUpdateValue(e.target.value)} />
              <Input label="Date" type="date" value={updateDate} onChange={(e) => setUpdateDate(e.target.value)}
                hint="Defaults to today — change to backdate this entry" />
              <Textarea label="Note (optional)" rows={2} placeholder="e.g. Monthly interest"
                value={updateNote} onChange={(e) => setUpdateNote(e.target.value)} />
            </>
          ) : (
            <>
              <Input label={updateMode === 'balance' ? 'New balance' : 'Adjustment amount (+ or −)'}
                type="number" inputMode="decimal" prefix="£" placeholder="0" value={updateValue}
                onChange={(e) => setUpdateValue(e.target.value)}
                hint={updateMode === 'adjustment' ? 'Use negative for a decrease, e.g. -500' : undefined} />
              <Input label="Date" type="date" value={updateDate} onChange={(e) => setUpdateDate(e.target.value)}
                hint="Defaults to today — change to backdate this entry" />
              <Textarea label="Note (optional)" rows={2} placeholder="e.g. Monthly update"
                value={updateNote} onChange={(e) => setUpdateNote(e.target.value)} />
            </>
          )}
        </div>
      </Modal>

      <Modal open={winningModal} onClose={() => setWinningModal(false)}
        title={editingWin ? 'Edit Monthly Winning' : 'Log Monthly Winning'}
        footer={<div className="flex gap-2">
          <Button variant="secondary" fullWidth onClick={() => setWinningModal(false)}>Cancel</Button>
          <Button fullWidth onClick={saveWinning} disabled={busy || !winAmount}>{busy ? 'Saving…' : 'Save'}</Button>
        </div>}>
        <div className="space-y-4">
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-xs text-ink-600 dark:text-ink-300">
            <Gift size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <p>Winnings are paid into your bank account — they do <strong>not</strong> change your Premium Bond balance and are tracked as additional income only.</p>
          </div>
          <Input label="Date" type="date" value={winDate} onChange={(e) => setWinDate(e.target.value)} />
          <Input label="Amount won" type="number" inputMode="decimal" prefix="£" placeholder="0"
            value={winAmount} onChange={(e) => setWinAmount(e.target.value)} />
          <Textarea label="Note (optional)" rows={2} placeholder="e.g. March prize draw"
            value={winNote} onChange={(e) => setWinNote(e.target.value)} />
        </div>
      </Modal>

      <Modal open={yearlyModal} onClose={() => setYearlyModal(false)}
        title={editingYearly ? 'Edit Yearly Total' : 'Add Historical Yearly Winnings'}
        footer={<div className="flex gap-2">
          <Button variant="secondary" fullWidth onClick={() => setYearlyModal(false)}>Cancel</Button>
          <Button fullWidth onClick={saveYearly} disabled={busy || !yearlyAmount || yearlyUsesMonthly}>{busy ? 'Saving…' : 'Save'}</Button>
        </div>}>
        <div className="space-y-4">
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-xs text-ink-600 dark:text-ink-300">
            <TrendingUp size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <p>Enter the <strong>total winnings for this account</strong> across the entire year. One entry per year. Does not affect the bond balance.</p>
          </div>
          <Select label="Year" value={yearlyYear} onChange={(e) => setYearlyYear(e.target.value)}>
            {YEAR_OPTIONS.map((y) => <option key={y} value={String(y)}>{y}</option>)}
          </Select>
          {yearlyUsesMonthly && (
            <p className="text-xs text-amber-600 dark:text-amber-400">This year is calculated from its monthly winnings, so it can't be entered here.</p>
          )}
          <Input label="Total winnings for this year" type="number" inputMode="decimal" prefix="£" placeholder="0"
            value={yearlyAmount} onChange={(e) => setYearlyAmount(e.target.value)} />
        </div>
      </Modal>

      <Modal open={!!confirmDeleteWin} onClose={() => setConfirmDeleteWin(null)} title="Delete winning?" size="sm"
        footer={<div className="flex gap-2">
          <Button variant="secondary" fullWidth onClick={() => setConfirmDeleteWin(null)}>Cancel</Button>
          <Button variant="danger" fullWidth onClick={doDeleteWinning} disabled={busy}>{busy ? 'Deleting…' : 'Delete'}</Button>
        </div>}>
        <p className="text-sm text-ink-600 dark:text-ink-300">Delete this monthly winning record?</p>
      </Modal>

      <Modal open={!!confirmDeleteYearly} onClose={() => setConfirmDeleteYearly(null)} title="Delete yearly record?" size="sm"
        footer={<div className="flex gap-2">
          <Button variant="secondary" fullWidth onClick={() => setConfirmDeleteYearly(null)}>Cancel</Button>
          <Button variant="danger" fullWidth onClick={doDeleteYearly} disabled={busy}>{busy ? 'Deleting…' : 'Delete'}</Button>
        </div>}>
        <p className="text-sm text-ink-600 dark:text-ink-300">
          Delete the {confirmDeleteYearly?.year} yearly winnings record ({formatGBPFull(Number(confirmDeleteYearly?.amount ?? 0))})?
        </p>
      </Modal>

      <Modal open={paymentModal} onClose={() => setPaymentModal(false)} title="Make Payment"
        footer={<div className="flex gap-2">
          <Button variant="secondary" fullWidth onClick={() => setPaymentModal(false)}>Cancel</Button>
          <Button fullWidth onClick={makePayment} disabled={busy || !paymentAmount || !paymentSourceId}>{busy ? 'Saving…' : 'Make payment'}</Button>
        </div>}>
        <div className="space-y-4">
          <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/20 text-xs text-ink-600 dark:text-ink-300">
            <CreditCard size={14} className="text-blue-500 shrink-0 mt-0.5" />
            <p>Pay down the balance on <strong>{account?.name}</strong>. The amount will be deducted from the source account and added to this credit account. Payments over £100 are automatically logged in Big Spend.</p>
          </div>
          <Input label="Payment amount" type="number" inputMode="decimal" prefix="£" placeholder="0"
            value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
          <Input label="Date" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)}
            hint="Defaults to today — change to backdate this payment" />
          <Select label="Pay from" value={paymentSourceId} onChange={(e) => setPaymentSourceId(e.target.value)}>
            <option value="">Select account…</option>
            {accounts.filter((a) => a.id !== accountId && a.type !== 'credit').map((a) => (
              <option key={a.id} value={a.id}>{a.name} ({formatGBPFull(Number(a.current_value))})</option>
            ))}
          </Select>
          <Textarea label="Note (optional)" rows={2} placeholder="e.g. Monthly repayment"
            value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} />
        </div>
      </Modal>

      <Modal open={!!confirmDeleteInt} onClose={() => setConfirmDeleteInt(null)} title="Delete interest record?" size="sm"
        footer={<div className="flex gap-2">
          <Button variant="secondary" fullWidth onClick={() => setConfirmDeleteInt(null)}>Cancel</Button>
          <Button variant="danger" fullWidth onClick={doDeleteInterest} disabled={busy}>{busy ? 'Deleting…' : 'Delete'}</Button>
        </div>}>
        <p className="text-sm text-ink-600 dark:text-ink-300">Delete this interest record?</p>
      </Modal>

      <Modal open={updateEditModal} onClose={() => setUpdateEditModal(false)} title="Edit Balance Update"
        footer={<div className="flex gap-2">
          <Button variant="secondary" fullWidth onClick={() => setUpdateEditModal(false)}>Cancel</Button>
          <Button fullWidth onClick={saveEditUpdate} disabled={busy || !editBalValue}>{busy ? 'Saving…' : 'Save'}</Button>
        </div>}>
        <div className="space-y-4">
          <div className="flex items-start gap-2 p-3 rounded-xl bg-brand-50 dark:bg-brand-950/20 text-xs text-ink-600 dark:text-ink-300">
            <Info size={14} className="text-brand-500 shrink-0 mt-0.5" />
            <p>Changing the balance here recalculates the account's current balance from its full update history.</p>
          </div>
          <Input label="Balance" type="number" inputMode="decimal" prefix="£" placeholder="0"
            value={editBalValue} onChange={(e) => setEditBalValue(e.target.value)} />
          <Input label="Date" type="date" value={editBalDate} onChange={(e) => setEditBalDate(e.target.value)} />
          <Textarea label="Note (optional)" rows={2} placeholder="e.g. Monthly update"
            value={editBalNote} onChange={(e) => setEditBalNote(e.target.value)} />
        </div>
      </Modal>

      <Modal open={!!confirmDeleteUpdate} onClose={() => setConfirmDeleteUpdate(null)} title="Delete balance update?" size="sm"
        footer={<div className="flex gap-2">
          <Button variant="secondary" fullWidth onClick={() => setConfirmDeleteUpdate(null)}>Cancel</Button>
          <Button variant="danger" fullWidth onClick={doDeleteUpdate} disabled={busy}>{busy ? 'Deleting…' : 'Delete'}</Button>
        </div>}>
        <p className="text-sm text-ink-600 dark:text-ink-300">
          Delete this balance update? The account balance will be recalculated from the remaining history.
        </p>
      </Modal>

      <TransferModal open={transferModalOpen} onClose={() => setTransferModalOpen(false)} editing={editingTransfer} />
      <DeleteTransferModal transfer={confirmDeleteTransfer} onClose={() => setConfirmDeleteTransfer(null)} />
      <TransactionModal open={txModalOpen} onClose={() => setTxModalOpen(false)} editing={editingTx} defaultAccountId={accountId} />
      <DeleteTransactionModal transaction={confirmDeleteTx} onClose={() => setConfirmDeleteTx(null)} />
    </div>
  );
}
