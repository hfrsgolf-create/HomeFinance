import { useState, useCallback, useRef, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { FinanceProvider } from './context/FinanceContext';
import { Layout, Page } from './components/Layout';
import { FullPageSpinner } from './components/ui/Feedback';
import { LoginPage } from './pages/LoginPage';
import { Dashboard } from './pages/Dashboard';
import { AccountsPage, AccountDetail } from './pages/Accounts';
import { AdditionalIncomePage } from './pages/AdditionalIncome';
import { AccountType } from './lib/types';
import { TransactionsPage } from './pages/Transactions';
import { RetirementPage } from './pages/Retirement';
import { ProvidersPage } from './pages/Providers';
import { OutgoingsPage } from './pages/Outgoings';
import { HistoricalPage } from './pages/Historical';
import { BreakdownsPage } from './pages/Breakdowns';
import { EnergyPage } from './pages/Energy';
import { SettingsPage } from './pages/Settings';
import { skipNextPopstate, consumeSkipPopstate } from './lib/popstateSkip';

function AppContent() {
  const { session, loading } = useAuth();
  const [page, setPage] = useState<Page>('dashboard');
  const [openAccountId, setOpenAccountId] = useState<string | null>(null);
  const [accountTypeFilter, setAccountTypeFilter] = useState<AccountType | null>(null);

  // History stack for Android back gesture support.
  // Each entry is a function that reverses a navigation action.
  const backStackRef = useRef<Array<() => void>>([]);
  const isPopstateRef = useRef(false);

  useEffect(() => {
    const onPopState = () => {
      if (consumeSkipPopstate()) return;
      const action = backStackRef.current.pop();
      if (action) {
        isPopstateRef.current = true;
        action();
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((p: Page) => {
    const from = page;
    backStackRef.current.push(() => {
      setOpenAccountId(null);
      setPage(from);
    });
    window.history.pushState(null, '');
    setOpenAccountId(null);
    setPage(p);
  }, [page]);

  const openAccount = useCallback((id: string) => {
    backStackRef.current.push(() => setOpenAccountId(null));
    window.history.pushState(null, '');
    setOpenAccountId(id);
  }, []);

  const closeAccount = useCallback(() => {
    skipNextPopstate();
    setOpenAccountId(null);
    window.history.back();
  }, []);

  if (loading) return <FullPageSpinner label="Loading…" />;

  if (!session) return <LoginPage />;

  return (
    <FinanceProvider userId={session.user.id}>
      <Layout current={page} onNavigate={navigate}>
        {page === 'dashboard' && <Dashboard onNavigate={navigate} />}
        {page === 'accounts' && (openAccountId ? (
          <AccountDetail accountId={openAccountId} onBack={closeAccount} />
        ) : (
          <AccountsPage onOpenAccount={openAccount} initialTypeFilter={accountTypeFilter} onTypeFilterChange={setAccountTypeFilter} />
        ))}
        {page === 'additional-income' && <AdditionalIncomePage />}
        {page === 'transactions' && <TransactionsPage />}
        {page === 'outgoings' && <OutgoingsPage />}
        {page === 'retirement' && <RetirementPage />}
        {page === 'providers' && <ProvidersPage />}
        {page === 'historical' && <HistoricalPage />}
        {page === 'breakdowns' && <BreakdownsPage />}
        {page === 'energy' && <EnergyPage />}
        {page === 'settings' && <SettingsPage />}
      </Layout>
    </FinanceProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
