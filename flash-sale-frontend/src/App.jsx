import { Routes, Route, Link, useLocation } from 'react-router-dom';
import ProductPage from './pages/ProductPage';
import CheckoutPage from './pages/CheckoutPage';
import ConfirmationPage from './pages/ConfirmationPage';
import AdminDashboard from './pages/AdminDashboard';
import NotFound from './pages/NotFound';
import { useAuth } from './context/AuthContext';
import AuthPage from './pages/AuthPage';

export default function App() {
  const location = useLocation();
  const { user, logout } = useAuth();

  const linkClass = (path) => `rounded-full px-4 py-2 text-xs font-semibold transition-all duration-200 ${
    location.pathname === path
      ? 'bg-white/10 text-white shadow-inner'
      : 'text-ink-muted hover:bg-white/5 hover:text-white'
  }`;

  if (!user) {
    return <AuthPage />;
  }

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-20 px-4 pt-4">
        <nav className="mx-auto flex max-w-6xl items-center justify-between rounded-2xl border border-white/10 bg-base/70 px-4 py-3 shadow-soft backdrop-blur-xl">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-sour to-accent text-sm font-black text-base shadow-glow">V</span>
            <span className="font-display text-sm font-bold tracking-tight">VibeEnergy</span>
          </Link>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-full border border-white/5 bg-black/15 p-1">
              <Link to="/" className={linkClass('/')}>Store</Link>
              <Link to="/admin" className={linkClass('/admin')}>Live ops</Link>
            </div>
            
            <div className="h-5 w-[1px] bg-white/10 hidden sm:block" />
            
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex h-7 w-7 items-center justify-center rounded-full bg-white/5 border border-white/10 text-[10px] font-bold text-sour uppercase animate-fade-in">
                {user.name.slice(0, 2)}
              </div>
              <button 
                onClick={logout} 
                className="text-[11px] text-alert hover:text-opacity-80 transition-colors cursor-pointer border border-alert/20 bg-alert/5 hover:bg-alert/10 px-2.5 py-1.5 rounded-lg outline-none"
              >
                Sign Out
              </button>
            </div>
          </div>
        </nav>
      </header>
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<ProductPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/confirmation" element={<ConfirmationPage />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
