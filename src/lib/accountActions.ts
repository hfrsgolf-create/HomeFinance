import { supabase } from './supabase';
import { Account, AccountTransfer, AccountUpdate } from './types';

export async function recomputeBalanceFromUpdates(accountId: string) {
  const { data: rows } = await supabase
    .from('account_updates')
    .select('*')
    .eq('account_id', accountId)
    .order('recorded_date', { ascending: true })
    .order('created_at', { ascending: true });
  if (!rows || rows.length === 0) return;
  const latest = rows[rows.length - 1] as AccountUpdate;
  await supabase
    .from('accounts')
    .update({ current_value: Number(latest.balance), updated_at: new Date().toISOString() })
    .eq('id', accountId);
}

export async function applyTransactionToAccount(
  accountId: string,
  amount: number,
  date: string,
  note: string,
) {
  const { data: acc } = await supabase.from('accounts').select('*').eq('id', accountId).single();
  if (!acc) return;
  const newBalance = Number((acc as Account).current_value) + amount;
  await supabase
    .from('accounts')
    .update({ current_value: newBalance, updated_at: new Date().toISOString() })
    .eq('id', accountId);
  await supabase.from('account_updates').insert({
    account_id: accountId,
    recorded_date: date,
    balance: newBalance,
    adjustment: amount,
    note,
  });
}

export async function reverseTransactionFromAccount(
  accountId: string,
  amount: number,
  date: string,
  note: string,
) {
  await applyTransactionToAccount(accountId, -amount, date, note);
}

export async function saveTransaction(args: {
  editingId?: string;
  oldAccountId?: string | null;
  oldAmount?: number;
  date: string;
  description: string;
  amount: number;
  accountId: string | null;
  category: string;
  note: string;
}) {
  const { editingId, oldAccountId, oldAmount, date, description, amount, accountId, category, note } = args;

  if (editingId) {
    if (oldAccountId) {
      await reverseTransactionFromAccount(
        oldAccountId,
        Number(oldAmount),
        date,
        `Reversed edit: ${description}`,
      );
    }
    await supabase
      .from('transactions')
      .update({
        date,
        description: description.trim(),
        amount,
        account_id: accountId || null,
        category,
        note: note.trim(),
      })
      .eq('id', editingId);
    if (accountId) {
      await applyTransactionToAccount(accountId, amount, date, description.trim());
    }
  } else {
    await supabase.from('transactions').insert({
      date,
      description: description.trim(),
      amount,
      account_id: accountId || null,
      category,
      note: note.trim(),
    });
    if (accountId) {
      await applyTransactionToAccount(accountId, amount, date, description.trim());
    }
  }
}

export async function deleteTransaction(args: {
  id: string;
  accountId: string | null;
  amount: number;
  description: string;
  date: string;
}) {
  const { id, accountId, amount, description, date } = args;
  if (accountId) {
    await reverseTransactionFromAccount(accountId, amount, date, `Reversed deleted: ${description}`);
  }
  await supabase.from('transactions').delete().eq('id', id);
}

export async function deleteAccountUpdate(update: AccountUpdate) {
  await supabase.from('account_updates').delete().eq('id', update.id);
  await recomputeBalanceFromUpdates(update.account_id);
}

export async function editAccountUpdate(
  update: AccountUpdate,
  newDate: string,
  newBalance: number,
  newNote: string,
) {
  await supabase
    .from('account_updates')
    .update({ recorded_date: newDate, balance: newBalance, note: newNote.trim() })
    .eq('id', update.id);
  await recomputeBalanceFromUpdates(update.account_id);
}

export interface TransferInput {
  fromAccount: Account;
  toAccount: Account;
  amount: number;
  date: string;
  note: string;
}

async function shiftAccountBalance(accountId: string, delta: number): Promise<number> {
  const { data: acc, error } = await supabase.from('accounts').select('current_value').eq('id', accountId).maybeSingle();
  if (error || !acc) throw new Error('Account not found');
  const newBalance = Number((acc as { current_value: number }).current_value) + delta;
  const { error: updateError } = await supabase
    .from('accounts')
    .update({ current_value: newBalance, updated_at: new Date().toISOString() })
    .eq('id', accountId);
  if (updateError) throw updateError;
  return newBalance;
}

async function postTransferSides(transferId: string, input: TransferInput) {
  const { fromAccount, toAccount, amount, date } = input;

  const fromBalance = await shiftAccountBalance(fromAccount.id, -amount);
  await supabase.from('account_updates').insert({
    account_id: fromAccount.id, recorded_date: date, balance: fromBalance, adjustment: -amount,
    note: `Transfer to ${toAccount.name}`, transfer_id: transferId,
  });

  const toBalance = await shiftAccountBalance(toAccount.id, amount);
  await supabase.from('account_updates').insert({
    account_id: toAccount.id, recorded_date: date, balance: toBalance, adjustment: amount,
    note: `Transfer from ${fromAccount.name}`, transfer_id: transferId,
  });
}

export async function createTransfer(input: TransferInput) {
  const { data, error } = await supabase
    .from('account_transfers')
    .insert({
      from_account_id: input.fromAccount.id,
      to_account_id: input.toAccount.id,
      amount: input.amount,
      transfer_date: input.date,
      note: input.note.trim(),
    })
    .select()
    .single();
  if (error || !data) throw new Error('Could not save transfer');
  await postTransferSides((data as AccountTransfer).id, input);
}

export async function updateTransfer(existing: AccountTransfer, input: TransferInput) {
  const { error } = await supabase
    .from('account_transfers')
    .update({
      from_account_id: input.fromAccount.id,
      to_account_id: input.toAccount.id,
      amount: input.amount,
      transfer_date: input.date,
      note: input.note.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', existing.id);
  if (error) throw new Error('Could not update transfer');
  await shiftAccountBalance(existing.from_account_id, Number(existing.amount));
  await shiftAccountBalance(existing.to_account_id, -Number(existing.amount));
  await supabase.from('account_updates').delete().eq('transfer_id', existing.id);
  await postTransferSides(existing.id, input);
}

export async function deleteTransfer(transfer: AccountTransfer) {
  const { error } = await supabase.from('account_transfers').delete().eq('id', transfer.id);
  if (error) throw new Error('Could not delete transfer');
  await shiftAccountBalance(transfer.from_account_id, Number(transfer.amount));
  await shiftAccountBalance(transfer.to_account_id, -Number(transfer.amount));
}
