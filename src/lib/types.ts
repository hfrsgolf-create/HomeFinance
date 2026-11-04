export type AccountType = 'bank' | 'savings' | 'premium_bonds' | 'pension' | 'credit' | 'property' | 'isa';

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  current_value: number;
  estimated_tax_liability: number;
  notes: string;
  sort_order: number;
  payment_due_date: number | null;
  created_at: string;
  updated_at: string;
}

export interface AccountUpdate {
  id: string;
  user_id: string;
  account_id: string;
  recorded_date: string;
  balance: number;
  adjustment: number | null;
  note: string;
  transfer_id: string | null;
  created_at: string;
}

export interface AccountTransfer {
  id: string;
  user_id: string;
  from_account_id: string;
  to_account_id: string;
  amount: number;
  transfer_date: string;
  note: string;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string | null;
  date: string;
  description: string;
  amount: number;
  category: string | null;
  note: string | null;
  created_at: string;
}

export interface BondWinning {
  id: string;
  user_id: string;
  account_id: string;
  date: string;
  amount: number;
  note: string;
  created_at: string;
}

export interface InterestRecord {
  id: string;
  user_id: string;
  account_id: string;
  date: string;
  amount: number;
  note: string;
  created_at: string;
}

export type OutgoingType = 'direct_debit' | 'standing_order' | 'other';

export interface Outgoing {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  type: OutgoingType;
  notes: string;
  sort_order: number;
  created_at: string;
}

export interface HistoricalData {
  id: string;
  user_id: string;
  year: number;
  fire_pension: number;
  bond_winnings: number;
  year_start_balance: number;
  created_at: string;
  updated_at: string;
}

export interface Settings {
  id: string;
  user_id: string;
  annual_spending: number;
  fire_pension_income: number;
  private_pension_drawdown: number;
  theme: 'light' | 'dark';
  updated_at: string;
}

// Labels in the order they appear in dropdowns
export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  bank: 'Bank',
  savings: 'Savings',
  premium_bonds: 'Premium Bonds',
  pension: 'Pension',
  credit: 'Credit Owed',
  property: 'Property',
  isa: 'ISA',
};

export const ACCOUNT_TYPE_COLORS: Record<AccountType, string> = {
  bank: '#338cff',
  savings: '#22c55e',
  premium_bonds: '#f59e0b',
  pension: '#a855f7',
  credit: '#ef4444',
  property: '#64748b',
  isa: '#14b8a6',
};

export const TRANSFERABLE_ACCOUNT_TYPES: AccountType[] = ['bank', 'savings', 'isa'];

// Types that should be excluded from net worth / cash assets calculations
export const EXCLUDED_FROM_NET_WORTH: AccountType[] = ['credit'];

export interface BondYearlyWinning {
  id: string;
  user_id: string;
  account_id: string;
  year: number;
  amount: number;
  created_at: string;
  updated_at: string;
}

export interface EnergyReading {
  id: string;
  user_id: string;
  month: number;
  year: number;
  gas_cost: number | null;
  electricity_cost: number | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const OUTGOING_TYPE_LABELS: Record<OutgoingType, string> = {
  direct_debit: 'Direct Debit',
  standing_order: 'Standing Order',
  other: 'Other',
};

export const INCOME_SOURCE_COLORS = {
  interest: '#338cff',
  winnings: '#f59e0b',
  combined: '#22c55e',
};

export type ProviderCategory = 'tv_streaming' | 'utilities' | 'insurance' | 'home' | 'vehicle' | 'broadband_phone' | 'subscriptions' | 'other';
export type ProviderFrequency = 'monthly' | 'annually';

export interface Provider {
  id: string;
  user_id: string;
  name: string;
  category: ProviderCategory;
  amount: number;
  frequency: ProviderFrequency;
  contract_start_date: string | null;
  renewal_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const PROVIDER_CATEGORY_LABELS: Record<ProviderCategory, string> = {
  tv_streaming: 'TV / Streaming',
  utilities: 'Utilities',
  insurance: 'Insurance',
  home: 'Home',
  vehicle: 'Vehicle',
  broadband_phone: 'Broadband / Phone',
  subscriptions: 'Subscriptions',
  other: 'Other',
};

export const PROVIDER_CATEGORY_ORDER: ProviderCategory[] = [
  'tv_streaming', 'utilities', 'insurance', 'home', 'vehicle', 'broadband_phone', 'subscriptions', 'other',
];

export type IncomeType = 'state_pension' | 'pension' | 'investment_income' | 'other';

export interface AdditionalIncomeSource {
  id: string;
  user_id: string;
  name: string;
  income_type: IncomeType;
  created_at: string;
  updated_at: string;
}

export interface AdditionalIncomeEntry {
  id: string;
  user_id: string;
  source_id: string;
  year: number;
  amount: number;
  created_at: string;
  updated_at: string;
}

export const INCOME_TYPE_LABELS: Record<IncomeType, string> = {
  state_pension: 'State Pension',
  pension: 'Pension',
  investment_income: 'Investment Income',
  other: 'Other',
};

export const INCOME_TYPE_ORDER: IncomeType[] = ['state_pension', 'pension', 'investment_income', 'other'];
