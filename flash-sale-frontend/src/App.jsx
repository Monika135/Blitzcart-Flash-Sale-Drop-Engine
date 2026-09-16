import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import ProductPage from './pages/ProductPage';
import CheckoutPage from './pages/CheckoutPage';
import ConfirmationPage from './pages/ConfirmationPage';
import AdminDashboard from './pages/AdminDashboard';
import NotFound from './pages/NotFound';
import WelcomePage from './pages/WelcomePage';
import AuthPage from './pages/AuthPage';
import { useAuth } from './context/AuthContext';

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const linkClass = (path) => `rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 ${
    location.pathname === path
      ? 'bg-white/10 text-white shadow-inner'
      : 'text-ink-muted hover:bg-white/5 hover:text-white'
  }`;

  const handleLogout = () => {
    logout();
    navigate('/welcome');
  };

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 px-4 pt-4">
        <nav className="mx-auto flex max-w-6xl items-center justify-between rounded-2xl border border-white/10 bg-base/80 px-4 py-2.5 shadow-soft backdrop-blur-xl">
          <Link to={user ? "/" : "/welcome"} className="flex items-center gap-2.5 group">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-sour via-accent to-sour text-sm font-black text-base shadow-glow transition-transform group-hover:scale-105">
              ⚡
            </span>
            <div className="flex items-center gap-2">
              <span className="font-display text-sm font-bold tracking-tight text-white">
                Blitzcart
              </span>
              <span className="hidden sm:inline-block rounded-md border border-sour/30 bg-sour/10 px-2 py-0.5 text-[10px] font-mono font-medium text-sour">
                Flash Sale Engine
              </span>
            </div>
          </Link>
          
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center rounded-full border border-white/5 bg-black/25 p-1">
              <Link to="/welcome" className={linkClass('/welcome')}>Engine</Link>
              <Link to="/" className={linkClass('/')}>Drop Arena</Link>
              {user && <Link to="/admin" className={linkClass('/admin')}>Live Ops</Link>}
            </div>
            
            <div className="h-5 w-[1px] bg-white/10 hidden sm:block" />
            
            {user ? (
              <div className="flex items-center gap-2">
                <div 
                  className="hidden sm:flex h-7 w-7 items-center justify-center rounded-full bg-white/5 border border-white/10 text-[10px] font-bold text-sour uppercase animate-fade-in"
                  title={user.email}
                >
                  {(user.name || 'User').slice(0, 2)}
                </div>
                <button 
                  onClick={handleLogout} 
                  className="text-[11px] font-semibold text-alert hover:text-opacity-80 transition-colors cursor-pointer border border-alert/20 bg-alert/5 hover:bg-alert/10 px-2.5 py-1.5 rounded-lg outline-none"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <Link
                  to="/auth"
                  className="rounded-lg px-2.5 py-1 text-xs font-semibold text-ink-muted hover:text-white transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/auth?mode=signup"
                  className="rounded-xl bg-sour px-3 py-1 text-xs font-bold text-base hover:bg-sour-dim transition-all shadow-glow"
                >
                  Join
                </Link>
              </div>
            )}
          </div>
        </nav>
      </header>

      <Routes location={location} key={location.pathname}>
        {/* Unauthenticated landing loads the rich WelcomePage; authenticated users load ProductPage */}
        <Route path="/" element={user ? <ProductPage /> : <WelcomePage />} />
        <Route path="/welcome" element={<WelcomePage />} />
        <Route path="/store" element={user ? <ProductPage /> : <WelcomePage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/checkout" element={user ? <CheckoutPage /> : <AuthPage />} />
        <Route path="/confirmation" element={user ? <ConfirmationPage /> : <AuthPage />} />
        <Route path="/admin" element={user ? <AdminDashboard /> : <AuthPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
