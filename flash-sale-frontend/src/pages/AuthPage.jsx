import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Button';

export default function AuthPage() {
  const { login, signup, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get('mode') === 'signup';

  const [isSignUp, setIsSignUp] = useState(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // If already authenticated, redirect to store
  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  useEffect(() => {
    setIsSignUp(searchParams.get('mode') === 'signup');
  }, [searchParams]);

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
      navigate('/');
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

        {/* Back Link */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            to="/welcome"
            className="text-xs font-semibold text-ink-muted hover:text-white flex items-center gap-1.5 transition-colors"
          >
            <span>←</span>
            <span>Back to Engine Overview</span>
          </Link>
          <span className="font-mono text-[10px] text-sour bg-sour/10 px-2 py-0.5 rounded border border-sour/20">
            Blitzcart
          </span>
        </div>

        <div className="relative text-center mb-6">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sour via-accent to-sour text-xl font-black text-base shadow-glow">
            ⚡
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-white">
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="text-xs text-ink-muted mt-1.5">
            {isSignUp
              ? 'Join Blitzcart for live flash drops and instant checkout'
              : 'Sign in to access live sneaker drops and active reservations'}
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
                placeholder="Alex Mercer"
                autoFocus
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
              placeholder="alex@example.com"
              autoComplete="email"
              autoFocus={!isSignUp}
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
          <span>Secured with 256-bit SSL encryption & idempotency lock</span>
        </div>
      </div>
    </main>
  );
}
