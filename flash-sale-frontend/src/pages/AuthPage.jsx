import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Button';

export default function AuthPage() {
  const { login, signup } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isSignUp) {
        await signup(name, email, password);
      } else {
        await login(email, password);
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 pb-12 pt-28">
      <div className="glass-panel w-full max-w-md rounded-3xl p-8 page-in relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute -left-16 -top-16 h-40 w-40 rounded-full bg-accent/10 blur-3xl pointer-events-none" />
        <div className="absolute -right-16 -bottom-16 h-40 w-40 rounded-full bg-sour/10 blur-3xl pointer-events-none" />

        <div className="relative text-center mb-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sour to-accent text-xl font-black text-base shadow-glow">
            V
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-white">
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="text-xs text-ink-muted mt-1.5">
            {isSignUp ? 'Join VibeEnergy for exclusive limited drops' : 'Sign in to access your dashboard and active reservations'}
          </p>
        </div>

        {error && (
          <div className="mb-5 animate-shake rounded-xl border border-alert/20 bg-alert-bg p-3 text-center text-xs text-alert leading-relaxed">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <label className="text-xs text-ink-muted mb-1.5 block font-medium">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
              />
            </div>
          )}

          <div>
            <label className="text-xs text-ink-muted mb-1.5 block font-medium">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="text-xs text-ink-muted mb-1.5 block font-medium">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
            {!isSignUp && (
              <div className="mt-1.5 text-right">
                <span className="text-[10px] text-sour hover:underline cursor-pointer">
                  Forgot password?
                </span>
              </div>
            )}
          </div>

          <Button type="submit" loading={loading}>
            {loading ? 'Processing…' : isSignUp ? 'Create Account' : 'Sign In'}
          </Button>
        </form>

        <div className="mt-6 border-t border-white/5 pt-4 text-center">
          <p className="text-xs text-ink-muted">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
              }}
              className="text-sour font-semibold hover:underline cursor-pointer outline-none bg-transparent border-none ml-0.5"
            >
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </button>
          </p>
        </div>

        {/* Security badge footer */}
        <div className="mt-6 flex items-center justify-center gap-1.5 text-[10px] text-ink-faint">
          <span>🔒</span>
          <span>Secured with standard 256-bit SSL encryption</span>
        </div>
      </div>
    </main>
  );
}
