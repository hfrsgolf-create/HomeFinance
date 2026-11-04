import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { Account, AccountTransfer, AccountUpdate, Transaction, Settings, BondWinning, BondYearlyWinning, InterestRecord, Outgoing, HistoricalData, EnergyReading, AdditionalIncomeSource, AdditionalIncomeEntry } from '../lib/types';

interface FinanceData {
  accounts: Account[];
  updates: AccountUpdate[];
  transactions: Transaction[];
  transfers: AccountTransfer[];
  winnings: BondWinning[];
  bondYearlyWinnings: BondYearlyWinning[];
  interestRecords: InterestRecord[];
  outgoings: Outgoing[];
  historicalData: HistoricalData[];
  energyReadings: EnergyReading[];
  additionalIncomeSources: AdditionalIncomeSource[];
  additionalIncomeEntries: AdditionalIncomeEntry[];
  settings: Settings | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const FinanceContext = createContext<FinanceData | undefined>(undefined);

export function FinanceProvider({ children }: { userId: string; children: ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [updates, setUpdates] = useState<AccountUpdate[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transfers, setTransfers] = useState<AccountTransfer[]>([]);
  const [winnings, setWinnings] = useState<BondWinning[]>([]);
  const [bondYearlyWinnings, setBondYearlyWinnings] = useState<BondYearlyWinning[]>([]);
  const [interestRecords, setInterestRecords] = useState<InterestRecord[]>([]);
  const [outgoings, setOutgoings] = useState<Outgoing[]>([]);
  const [historicalData, setHistoricalData] = useState<HistoricalData[]>([]);
  const [energyReadings, setEnergyReadings] = useState<EnergyReading[]>([]);
  const [additionalIncomeSources, setAdditionalIncomeSources] = useState<AdditionalIncomeSource[]>([]);
  const [additionalIncomeEntries, setAdditionalIncomeEntries] = useState<AdditionalIncomeEntry[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [accRes, upRes, txRes, trRes, winRes, yearlyRes, intRes, outRes, histRes, setRes, energyRes, aisRes, aieRes] = await Promise.all([
      supabase.from('accounts').select('*').order('sort_order', { ascending: true, nullsFirst: false }).order('created_at'),
      supabase.from('account_updates').select('*').order('recorded_date', { ascending: false }),
      supabase.from('transactions').select('*').order('date', { ascending: false }),
      supabase.from('account_transfers').select('*').order('transfer_date', { ascending: false }),
      supabase.from('bond_winnings').select('*').order('date', { ascending: false }),
      supabase.from('bond_yearly_winnings').select('*').order('year', { ascending: true }),
      supabase.from('interest_records').select('*').order('date', { ascending: false }),
      supabase.from('outgoings').select('*').order('sort_order', { ascending: true }),
      supabase.from('historical_data').select('*').order('year', { ascending: true }),
      supabase.from('settings').select('*').maybeSingle(),
      supabase.from('energy_readings').select('*').order('year', { ascending: true }).order('month', { ascending: true }),
      supabase.from('additional_income_sources').select('*').order('created_at', { ascending: true }),
      supabase.from('additional_income_entries').select('*').order('year', { ascending: true }),
    ]);

    setAccounts((accRes.data ?? []) as Account[]);
    setUpdates((upRes.data ?? []) as AccountUpdate[]);
    setTransactions((txRes.data ?? []) as Transaction[]);
    setTransfers((trRes.data ?? []) as AccountTransfer[]);
    setWinnings((winRes.data ?? []) as BondWinning[]);
    setBondYearlyWinnings((yearlyRes.data ?? []) as BondYearlyWinning[]);
    setInterestRecords((intRes.data ?? []) as InterestRecord[]);
    setOutgoings((outRes.data ?? []) as Outgoing[]);
    setHistoricalData((histRes.data ?? []) as HistoricalData[]);
    setSettings((setRes.data as Settings | null) ?? null);
    setEnergyReadings((energyRes.data ?? []) as EnergyReading[]);
    setAdditionalIncomeSources((aisRes.data ?? []) as AdditionalIncomeSource[]);
    setAdditionalIncomeEntries((aieRes.data ?? []) as AdditionalIncomeEntry[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <FinanceContext.Provider value={{ accounts, updates, transactions, transfers, winnings, bondYearlyWinnings, interestRecords, outgoings, historicalData, energyReadings, additionalIncomeSources, additionalIncomeEntries, settings, loading, refresh }}>
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinance must be used within FinanceProvider');
  return ctx;
}
