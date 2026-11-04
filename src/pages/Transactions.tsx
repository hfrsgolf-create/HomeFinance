import { useState, useMemo } from 'react';
import { Plus, ShoppingBag, Pencil, Trash2, Filter, Copy } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/Feedback';
import { formatGBP, formatDate } from '../lib/format';
import { Transaction } from '../lib/types';
import { TransactionModal, DeleteTransactionModal } from '../components/shared/TransactionModal';

export function TransactionsPage() {
  const { transactions, accounts, loading } = useFinance();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Transaction | null>(null);
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear());

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (tx: Transaction) => {
    setEditing(tx);
    setModalOpen(true);
  };

  const openDuplicate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const accountName = (id: string | null) => accounts.find((a) => a.id === id)?.name;

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(new Date().getFullYear());
    for (const tx of transactions) years.add(new Date(tx.date.slice(0, 10)).getFullYear());
    return [...years].sort((a, b) => b - a);
  }, [transactions]);

  const filteredTransactions = useMemo(
    () => transactions
      .filter((tx) => new Date(tx.date.slice(0, 10)).getFullYear() === yearFilter)
      .sort((a, b) => b.date.localeCompare(a.date)),
    [transactions, yearFilter]
  );

  if (loading) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink-900 dark:text-ink-50">Big Spend</h1>
          <p className="text-sm text-ink-400">Major purchases & income events</p>
        </div>
        <Button onClick={openAdd} size="sm"><Plus size={16} /> Add</Button>
      </div>

      {transactions.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ShoppingBag size={40} />}
            title="No big spend recorded"
            message="Log major purchases like holidays, home improvements, or car purchases — not everyday budgeting."
            action={<Button onClick={openAdd} size="sm"><Plus size={16} /> Add entry</Button>}
          />
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            <Filter size={14} className="text-ink-400 shrink-0" />
            {availableYears.map((y) => (
              <button key={y} onClick={() => setYearFilter(y)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors shrink-0 ${
                  yearFilter === y ? 'bg-brand-600 text-white' : 'bg-ink-100 dark:bg-ink-800 text-ink-500 dark:text-ink-400 hover:bg-ink-200 dark:hover:bg-ink-700'
                }`}>{y}</button>
            ))}
          </div>
          {filteredTransactions.length === 0 ? (
            <Card>
              <EmptyState icon={<ShoppingBag size={40} />} title={`No entries in ${yearFilter}`}
                message={`No big spend entries found for ${yearFilter}. Select a different year or add a new entry.`}
                action={<Button onClick={openAdd} size="sm"><Plus size={16} /> Add entry</Button>} />
            </Card>
          ) : (
            <div className="max-h-[480px] overflow-y-auto overs-y-contain space-y-2 pr-1">
              {filteredTransactions.map((tx, i) => (
            <Card key={tx.id} className={`p-4 ${i % 2 === 1 ? 'bg-ink-50/50 dark:bg-ink-850/30' : ''}`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tx.amount >= 0 ? 'bg-green-50 dark:bg-green-950/30' : 'bg-red-50 dark:bg-red-950/30'}`}>
                  <span className={`text-sm font-bold ${tx.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                    {tx.amount >= 0 ? '+' : '−'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-ink-900 dark:text-ink-50 truncate">{tx.description}</p>
                  <div className="flex items-center gap-2 text-xs text-ink-400">
                    <span>{formatDate(tx.date)}</span>
                    {tx.account_id && <><span>·</span><span>{accountName(tx.account_id)}</span></>}
                    {tx.category && (
                      <><span>·</span><span className="capitalize">{tx.category}</span></>
                    )}
                  </div>
                  {tx.note && (
                    <p className="text-xs text-ink-400 mt-1 italic truncate">{tx.note}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`font-bold ${tx.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                    {formatGBP(tx.amount, { sign: true })}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openDuplicate()} title="Duplicate" className="p-2 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-400 transition-colors">
                    <Copy size={15} />
                  </button>
                  <button onClick={() => openEdit(tx)} className="p-2 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-400 transition-colors">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => setConfirmDelete(tx)} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-ink-400 hover:text-red-500 transition-colors">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </Card>
              ))}
            </div>
          )}
        </>
      )}

      <TransactionModal open={modalOpen} onClose={() => setModalOpen(false)} editing={editing} />
      <DeleteTransactionModal transaction={confirmDelete} onClose={() => setConfirmDelete(null)} />
    </div>
  );
}
