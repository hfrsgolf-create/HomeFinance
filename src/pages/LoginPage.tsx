import { useState } from 'react';
import { TrendingUp, Mail, Lock, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';

export function LoginPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const fn = mode === 'signin' ? signIn : signUp;
    const { error } = await fn(email.trim(), password);
    setBusy(false);
    if (error) setError(error);
  };

  return (
    <div className="min-h-screen bg-ink-50 dark:bg-ink-950 theme-transition flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-brand-600 flex items-center justify-center shadow-lg shadow-brand-600/20 mb-4">
            <TrendingUp size={28} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-ink-900 dark:text-ink-50">Retirement Finance</h1>
          <p className="text-sm text-ink-400 mt-1">Your private financial dashboard</p>
        </div>

        <div className="bg-white dark:bg-ink-900 rounded-2xl shadow-card border border-ink-100 dark:border-ink-800 p-6">
          {/* Tab toggle */}
          <div className="flex bg-ink-100 dark:bg-ink-800 rounded-xl p-1 mb-5">
            <button
              onClick={() => { setMode('signin'); setError(null); }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${mode === 'signin' ? 'bg-white dark:bg-ink-700 text-ink-900 dark:text-ink-50 shadow-sm' : 'text-ink-500'}`}
            >
              Sign in
            </button>
            <button
              onClick={() => { setMode('signup'); setError(null); }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${mode === 'signup' ? 'bg-white dark:bg-ink-700 text-ink-900 dark:text-ink-50 shadow-sm' : 'text-ink-500'}`}
            >
              First time setup
            </button>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none z-10" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="w-full rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-950 pl-10 pr-3.5 py-2.5 text-sm text-ink-900 dark:text-ink-100 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
              />
            </div>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none z-10" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-950 pl-10 pr-3.5 py-2.5 text-sm text-ink-900 dark:text-ink-100 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <Button type="submit" fullWidth size="lg" disabled={busy}>
              {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
              {!busy && <ArrowRight size={16} />}
            </Button>
          </form>

          {mode === 'signup' && (
            <p className="text-xs text-ink-400 mt-4 text-center">
              Create your private account. This is for single-user use — no one else can sign up or see your data.
            </p>
          )}
        </div>

        <p className="text-center text-xs text-ink-400 mt-6">
          No banking data is stored. All amounts are manually entered.
        </p>
      </div>
    </div>
  );
}
