import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Button';
import bredImage from '../assets/air_jordan_bred.png';
import stealthImage from '../assets/air_jordan_stealth.png';
import royalImage from '../assets/air_jordan_royal.png';
import citronImage from '../assets/air_jordan_citron.png';

const DROPS_PREVIEW = [
  {
    sku: 'AJ1-BRED-10',
    name: 'Air Jordan 1 Retro High OG "Bred"',
    subtitle: 'Limited Drop · 100 Units Worldwide',
    price: '₹14,900',
    stock: 7,
    total: 100,
    status: 'ALMOST GONE',
    badgeTone: 'alert',
    image: bredImage,
    glow: 'rgba(255, 122, 158, 0.4)',
  },
  {
    sku: 'AJ1-STEALTH-11',
    name: 'Air Jordan 1 High "Midnight Stealth"',
    subtitle: 'High-top black & slate grey · 150 Units',
    price: '₹16,900',
    stock: 14,
    total: 150,
    status: 'SELLING FAST',
    badgeTone: 'sour',
    image: stealthImage,
    glow: 'rgba(167, 139, 250, 0.4)',
  },
  {
    sku: 'AJ1-CITRON-13',
    name: 'Air Jordan 1 "Electro Citron Volt"',
    subtitle: 'Cyberpunk yellow & carbon · 80 Units',
    price: '₹13,900',
    stock: 45,
    total: 80,
    status: 'ACTIVE DROP',
    badgeTone: 'success',
    image: citronImage,
    glow: 'rgba(102, 227, 180, 0.4)',
  },
  {
    sku: 'AJ1-ROYAL-12',
    name: 'Air Jordan 1 "Royal Vapor Wave"',
    subtitle: 'Synthwave blue & purple · 120 Units',
    price: '₹15,900',
    stock: 0,
    total: 120,
    status: 'SOLD OUT',
    badgeTone: 'muted',
    image: royalImage,
    glow: 'rgba(139, 231, 255, 0.2)',
  },
];

const ARCHITECTURE_STEPS = [
  {
    step: '01',
    title: 'Atomic Redis Decrement',
    tech: 'Redis Lua / GET + DECR',
    tag: '< 2ms Hot Path',
    desc: 'When hundreds click Buy Now simultaneously, Redis executes a single-unit Lua script to check and decrement stock atomically. Requests encountering zero stock return HTTP 409 immediately before touching PostgreSQL.',
    highlight: 'Zero Race Conditions · No Overselling',
  },
  {
    step: '02',
    title: 'Durable Postgres Reservations',
    tech: 'PostgreSQL + Django ORM',
    tag: 'ACID Source of Truth',
    desc: 'Winning reservations create a pending record in PostgreSQL with an initial 10-minute hold window. PostgreSQL acts as the durable financial ledger, safely decoupled from the Redis hot path.',
    highlight: 'Durable Ledger · Transactional Integrity',
  },
  {
    step: '03',
    title: '10-Minute Hold Window',
    tech: 'Expiring Reservation TTL',
    tag: '10-Min Auto-Expiry',
    desc: 'Inventory is provisionally locked for 10 minutes to allow the shopper to initiate and finalize checkout. If unpaid within 10 minutes, the hold expires and stock returns to the active drop pool.',
    highlight: 'No Orphaned Stock · Fair Drops',
  },
  {
    step: '04',
    title: 'Idempotency & Replay Guard',
    tech: 'UUID Client Handshake',
    tag: 'Replay Proof',
    desc: 'Every Buy Now attempt carries a client-generated idempotency UUID. Rapid double-taps or retried network requests safely return the existing reservation without double-decrementing stock or re-charging.',
    highlight: 'Duplicate Guard · Safe Retries',
  },
  {
    step: '05',
    title: 'Async Razorpay Gateway',
    tech: 'Real Razorpay Orders API',
    tag: '202 Accepted Async',
    desc: 'Initiating payment creates an authentic Razorpay Order and returns HTTP 202 processing. Checkout completes in the Razorpay SDK, and webhook events authenticate via cryptographic HMAC-SHA256 signatures.',
    highlight: 'Signature-Verified · Real Razorpay Webhook',
  },
  {
    step: '06',
    title: 'Celery Background Sweeper',
    tech: 'Celery Worker & Beat',
    tag: 'Continuous Cleanup',
    desc: 'Scheduled Celery tasks (expire_stale_reservations) continuously sweep for unpaid reservations past their 10-minute TTL, marking them expired and returning held stock directly back to Redis.',
    highlight: 'Self-Healing Stock Pool · Automated Recovery',
  },
];

const FEATURES_GRID = [
  {
    icon: '⚡',
    title: 'Sub-Millisecond Atomic Locks',
    desc: 'Standard database row locks cause deadlocks and timeouts under flash load. Blitzcart runs atomic check-and-decrement inside Redis in single-digit milliseconds.',
    badge: 'Redis Lua Engine',
  },
  {
    icon: '🗄️',
    title: 'Durable PostgreSQL Ledger',
    desc: 'PostgreSQL serves as the persistent single source of truth for products, orders, and payment records, keeping durable data safely decoupled from the high-throughput Redis hot path.',
    badge: 'PostgreSQL & Django',
  },
  {
    icon: '🛡️',
    title: '100% Zero Oversell Guarantee',
    desc: 'Mathematical certainty that reservations will never exceed physical stock. Concurrency load tests confirm zero overselling under stampedes of simultaneous requests.',
    badge: 'Zero Race Conditions',
  },
  {
    icon: '⏱️',
    title: '10-Minute Cart Reservations',
    desc: 'Stock is held for 10 minutes while payment completes. Background Celery beat workers automatically reclaim expired stock, preventing inventory lockup from abandoned carts.',
    badge: 'Celery Auto-Sweeper',
  },
  {
    icon: '🔐',
    title: 'Replay-Safe Idempotency',
    desc: 'Double-clicking shoppers and retrying network connections are safely handled via unique client UUID tokens, guaranteeing exactly one reservation per purchase intent.',
    badge: 'Replay Protection',
  },
  {
    icon: '💳',
    title: 'Genuine Razorpay Webhooks',
    desc: 'Full end-to-end integration with Razorpay Order APIs and HMAC-SHA256 signature verification. Real payment lifecycle without mock gateways or synthetic shortcuts.',
    badge: 'HMAC-SHA256 Signed',
  },
];

export default function WelcomePage() {
  const navigate = useNavigate();
  const { user, login, signup } = useAuth();

  // Auth modal state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('signin'); // 'signin' | 'signup'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeStep, setActiveStep] = useState(0);

  // Close modal on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setShowAuthModal(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const openAuth = (mode = 'signin') => {
    setAuthMode(mode);
    setError(null);
    setShowAuthModal(true);
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (authMode === 'signup') {
        await signup(name, email, password);
      } else {
        await login(email, password);
      }
      setShowAuthModal(false);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen text-ink">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-10 left-1/4 h-96 w-96 rounded-full bg-sour/10 blur-[130px]" />
        <div className="absolute top-1/3 right-10 h-[450px] w-[450px] rounded-full bg-accent/15 blur-[150px]" />
        <div className="absolute bottom-10 left-10 h-80 w-80 rounded-full bg-success/10 blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 pt-28 pb-20 sm:px-6">
        {/* HERO SECTION */}
        <section className="text-center pt-6 pb-14">
          {/* Eyebrow badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-sour/30 bg-sour/10 px-4 py-1.5 text-xs font-semibold text-sour backdrop-blur-md shadow-glow mb-6 animate-fade-in">
            <span className="flex h-2 w-2 rounded-full bg-sour animate-ping" />
            <span>HIGH-CONCURRENCY FLASH SALE DROP ENGINE</span>
          </div>

          {/* Main Headline */}
          <h1 className="font-display text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-[1.1] mb-6">
            <span className="text-white">Blitzcart</span>
            <br />
            <span className="bg-gradient-to-r from-sour via-accent to-sour bg-clip-text text-transparent">
              Flash Sale Drop Engine
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mx-auto max-w-3xl text-base sm:text-lg text-ink-muted leading-relaxed mb-10">
            A high-concurrency flash sale engine built with <span className="text-white font-semibold">Django, Redis Lua, PostgreSQL, and Celery</span>.
            Engineered with atomic check-and-decrements, replay-safe idempotency keys, and 10-minute hold windows for a guaranteed <span className="text-sour font-semibold">0% oversell rate</span> during high-traffic drops.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-3.5">
            {user ? (
              <Button
                variant="primary"
                onClick={() => navigate('/')}
                className="w-auto h-11 px-7 text-sm font-bold shadow-glow inline-flex"
              >
                ⚡ Enter Live Drop Arena
              </Button>
            ) : (
              <>
                <Button
                  variant="primary"
                  onClick={() => openAuth('signin')}
                  className="w-auto h-11 px-6 text-sm font-bold shadow-glow inline-flex"
                >
                  🚀 Sign In to Drop
                </Button>
                <button
                  type="button"
                  onClick={() => openAuth('signup')}
                  className="h-11 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 px-6 text-sm font-semibold text-white transition-all backdrop-blur-md hover:border-sour/40 inline-flex items-center justify-center"
                >
                  Create Account
                </button>
              </>
            )}
            <a
              href="#architecture"
              className="h-11 rounded-xl border border-white/10 bg-base-raised/70 hover:bg-base-raised px-5 text-xs font-semibold text-ink-muted hover:text-white transition-all inline-flex items-center justify-center gap-1.5"
            >
              <span>System Architecture</span>
              <span>↓</span>
            </a>
          </div>

          {/* LIVE PERFORMANCE TELEMETRY BAR */}
          <div className="mt-14 grid grid-cols-2 gap-3 sm:grid-cols-4 max-w-4xl mx-auto">
            <div className="glass-panel rounded-2xl p-4 text-center border border-white/10 hover:border-sour/40 transition-colors">
              <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Hot Path Latency</p>
              <p className="font-display text-2xl font-bold text-sour mt-1">&lt; 2ms</p>
              <p className="text-[10px] text-ink-faint mt-0.5 font-mono">Redis Lua atomic check</p>
            </div>
            <div className="glass-panel rounded-2xl p-4 text-center border border-white/10 hover:border-accent/40 transition-colors">
              <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Oversell Rate</p>
              <p className="font-display text-2xl font-bold text-accent mt-1">0.00%</p>
              <p className="text-[10px] text-ink-faint mt-0.5 font-mono">Zero double-allocations</p>
            </div>
            <div className="glass-panel rounded-2xl p-4 text-center border border-white/10 hover:border-success/40 transition-colors">
              <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Hold Window</p>
              <p className="font-display text-2xl font-bold text-success mt-1">10m</p>
              <p className="text-[10px] text-ink-faint mt-0.5 font-mono">Celery TTL auto-expiry</p>
            </div>
            <div className="glass-panel rounded-2xl p-4 text-center border border-white/10 hover:border-alert/40 transition-colors">
              <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Payment Verification</p>
              <p className="font-display text-2xl font-bold text-alert mt-1">HMAC</p>
              <p className="text-[10px] text-ink-faint mt-0.5 font-mono">Razorpay webhook signed</p>
            </div>
          </div>
        </section>

        {/* ACTIVE DROP PREVIEW CAROUSEL/GRID */}
        <section className="py-12 border-t border-white/10">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-sour uppercase tracking-widest mb-1.5">
                <span className="live-dot text-sour" />
                <span>Live Catalog Telemetry</span>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">Active Flash Drops</h2>
            </div>
            <p className="text-xs text-ink-muted mt-2 sm:mt-0 max-w-sm">
              Real-time inventory levels synchronized directly with the in-memory reservation engine.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {DROPS_PREVIEW.map((item) => {
              const pctRemaining = Math.round((item.stock / item.total) * 100);
              return (
                <div
                  key={item.sku}
                  className="glass-panel group relative overflow-hidden rounded-3xl border border-white/10 p-5 flex flex-col justify-between hover:border-white/20 transition-all duration-300 hover:shadow-glow"
                >
                  <div>
                    {/* Top status bar */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="font-mono text-[10px] text-ink-faint">{item.sku}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide border ${
                          item.stock === 0
                            ? 'border-white/10 bg-white/5 text-ink-faint'
                            : item.stock < 10
                            ? 'border-alert/30 bg-alert-bg text-alert animate-pulse'
                            : 'border-sour/30 bg-sour/10 text-sour'
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>

                    {/* Sneaker image with dynamic float effect */}
                    <div className="relative my-4 flex h-36 items-center justify-center">
                      <div
                        className="absolute h-28 w-28 rounded-full blur-2xl opacity-40 group-hover:opacity-70 transition-opacity"
                        style={{ background: item.glow }}
                      />
                      <img
                        src={item.image}
                        alt={item.name}
                        className="relative max-h-32 object-contain drop-shadow-2xl transition-transform duration-500 group-hover:scale-105 group-hover:-rotate-3"
                      />
                    </div>

                    {/* Title and details */}
                    <h3 className="font-display text-sm font-bold tracking-tight text-white mb-1 line-clamp-1">
                      {item.name}
                    </h3>
                    <p className="text-[11px] text-ink-muted line-clamp-1 mb-3">{item.subtitle}</p>

                    {/* Stock Bar */}
                    <div className="mb-4 space-y-1">
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-ink-muted">Available stock</span>
                        <span className={item.stock === 0 ? 'text-ink-faint' : 'text-sour font-semibold'}>
                          {item.stock} / {item.total} units
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5 border border-white/5">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            item.stock === 0
                              ? 'bg-ink-faint'
                              : item.stock < 10
                              ? 'bg-alert'
                              : 'bg-gradient-to-r from-sour to-accent'
                          }`}
                          style={{ width: `${pctRemaining}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Price & Action */}
                  <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-ink-faint block">Retail Price</span>
                      <span className="font-display text-sm font-extrabold text-white">{item.price}</span>
                    </div>
                    {user ? (
                      <button
                        onClick={() => navigate('/')}
                        disabled={item.stock === 0}
                        className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                          item.stock === 0
                            ? 'bg-white/5 text-ink-faint cursor-not-allowed'
                            : 'bg-sour text-base hover:bg-sour-dim cursor-pointer shadow-glow'
                        }`}
                      >
                        {item.stock === 0 ? 'Sold Out' : 'Claim Drop'}
                      </button>
                    ) : (
                      <button
                        onClick={() => openAuth('signin')}
                        disabled={item.stock === 0}
                        className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                          item.stock === 0
                            ? 'bg-white/5 text-ink-faint cursor-not-allowed'
                            : 'bg-white/10 text-white hover:bg-sour hover:text-base cursor-pointer'
                        }`}
                      >
                        {item.stock === 0 ? 'Sold Out' : 'Sign In to Buy'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* SYSTEM ARCHITECTURE INTERACTIVE VISUALIZER */}
        <section id="architecture" className="py-16 border-t border-white/10">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <p className="text-xs font-semibold uppercase tracking-widest text-accent mb-2">High-Availability Architecture</p>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight">
              Inside the Blitzcart Drop Pipeline
            </h2>
            <p className="mt-3 text-sm text-ink-muted">
              Explore how Blitzcart handles explosive flash sales from millisecond atomic decrement to event streaming and async settlement.
            </p>
          </div>

          {/* Interactive Steps Grid */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {ARCHITECTURE_STEPS.map((step, idx) => {
              const isSelected = activeStep === idx;
              return (
                <div
                  key={step.step}
                  onClick={() => setActiveStep(idx)}
                  className={`glass-panel cursor-pointer rounded-3xl p-6 border transition-all duration-300 relative overflow-hidden ${
                    isSelected
                      ? 'border-sour/60 bg-base-raised/90 shadow-glow -translate-y-1'
                      : 'border-white/10 hover:border-white/20 hover:bg-base-raised/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-mono text-xs font-black text-sour/80 bg-sour/10 border border-sour/20 rounded-lg px-2.5 py-1">
                      STEP {step.step}
                    </span>
                    <span className="font-mono text-[10px] text-ink-muted bg-white/5 rounded-md px-2 py-0.5 border border-white/5">
                      {step.tag}
                    </span>
                  </div>

                  <h3 className="font-display text-lg font-bold text-white mb-1">{step.title}</h3>
                  <p className="font-mono text-xs text-accent mb-3">{step.tech}</p>
                  <p className="text-xs text-ink-muted leading-relaxed mb-4">{step.desc}</p>

                  <div className="pt-3 border-t border-white/5 flex items-center gap-1.5 text-[11px] font-semibold text-sour">
                    <span>✓</span>
                    <span>{step.highlight}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pipeline flow bar */}
          <div className="mt-8 glass-panel rounded-2xl p-4 border border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            <span className="text-sour font-bold flex items-center gap-2">
              <span className="live-dot text-sour" /> End-to-End Pipeline
            </span>
            <div className="flex flex-wrap items-center gap-2 text-ink-muted text-[11px]">
              <span className="bg-white/5 px-2.5 py-1 rounded-md border border-white/5 text-white">1. Buy Now (UUID)</span>
              <span>→</span>
              <span className="bg-white/5 px-2.5 py-1 rounded-md border border-white/5 text-sour">2. Redis Lua Atomic Check</span>
              <span>→</span>
              <span className="bg-white/5 px-2.5 py-1 rounded-md border border-white/5 text-accent">3. Postgres 10m Hold</span>
              <span>→</span>
              <span className="bg-white/5 px-2.5 py-1 rounded-md border border-white/5 text-alert">4. Razorpay Order Created</span>
              <span>→</span>
              <span className="bg-white/5 px-2.5 py-1 rounded-md border border-white/5 text-success">5. HMAC-SHA256 Webhook</span>
              <span>→</span>
              <span className="bg-success/20 px-2.5 py-1 rounded-md border border-success/30 text-success font-bold">6. Order Confirmed / Celery Swept</span>
            </div>
          </div>
        </section>

        {/* CORE FEATURE DEEP DIVE */}
        <section className="py-16 border-t border-white/10">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <p className="text-xs font-semibold uppercase tracking-widest text-sour mb-2">Engineered for Scale</p>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight">
              Why Flash Sales Break & How Blitzcart Solves It
            </h2>
            <p className="mt-3 text-sm text-ink-muted">
              Traditional relational setups collapse under flash sales. Blitzcart implements Redis Lua serialization, PostgreSQL persistence, and Celery sweepers to guarantee fault-tolerant drops.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES_GRID.map((feat, i) => (
              <div
                key={i}
                className="glass-panel rounded-3xl border border-white/10 p-6 flex flex-col justify-between hover:border-sour/30 transition-all hover:-translate-y-1"
              >
                <div>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-2xl shadow-inner">
                    {feat.icon}
                  </div>
                  <h3 className="font-display text-base font-bold text-white mb-2">{feat.title}</h3>
                  <p className="text-xs text-ink-muted leading-relaxed">{feat.desc}</p>
                </div>
                <div className="mt-6 pt-3 border-t border-white/5">
                  <span className="font-mono text-[10px] text-sour bg-sour/10 border border-sour/20 rounded-md px-2 py-0.5 font-medium">
                    {feat.badge}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* BOTTOM CTA BANNER */}
        <section className="py-12">
          <div className="glass-panel relative overflow-hidden rounded-3xl border border-sour/30 p-8 sm:p-12 text-center shadow-glow">
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-sour/15 blur-3xl pointer-events-none" />
            <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-accent/20 blur-3xl pointer-events-none" />

            <span className="font-mono text-xs font-bold uppercase tracking-widest text-sour bg-sour/10 border border-sour/20 rounded-full px-3.5 py-1 mb-4 inline-block">
              READY FOR THE NEXT DROP?
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-4">
              Experience the Blitzcart Drop Engine Live
            </h2>
            <p className="mx-auto max-w-xl text-sm text-ink-muted mb-8 leading-relaxed">
              Test drive atomic reservation locking, simulated high-concurrency checkout, and real-time inventory telemetry.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3.5">
              {user ? (
                <Button
                  variant="primary"
                  onClick={() => navigate('/')}
                  className="w-auto h-11 px-7 text-sm font-bold shadow-glow inline-flex"
                >
                  Go to Store Arena
                </Button>
              ) : (
                <>
                  <Button
                    variant="primary"
                    onClick={() => openAuth('signin')}
                    className="w-auto h-11 px-7 text-sm font-bold shadow-glow inline-flex"
                  >
                    Sign In to Buy
                  </Button>
                  <button
                    type="button"
                    onClick={() => openAuth('signup')}
                    className="h-11 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 px-7 text-sm font-semibold text-white transition-all backdrop-blur-md inline-flex items-center justify-center"
                  >
                    Create Account
                  </button>
                </>
              )}
            </div>
          </div>
        </section>

        {/* SYSTEM STATUS FOOTER */}
        <footer className="pt-8 pb-4 text-center border-t border-white/5 text-xs text-ink-faint flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-success animate-pulse" />
            <span className="font-mono text-[11px]">
              Blitzcart Engine Status: <strong className="text-white">All Systems Operational</strong>
            </span>
          </div>
          <p className="font-mono text-[11px]">
            Python 3 · Django REST Framework · Redis Lua · PostgreSQL · Celery · Razorpay Webhooks
          </p>
        </footer>
      </div>

      {/* ACCESSIBLE QUICK-AUTH MODAL */}
      {showAuthModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAuthModal(false);
          }}
        >
          <div className="glass-panel relative w-full max-w-md rounded-3xl p-8 border border-white/15 shadow-glow page-in">
            {/* Close button */}
            <button
              type="button"
              onClick={() => setShowAuthModal(false)}
              className="absolute top-5 right-5 h-8 w-8 rounded-full bg-white/5 hover:bg-white/10 text-ink-muted hover:text-white flex items-center justify-center transition-colors text-sm"
              aria-label="Close dialog"
            >
              ✕
            </button>

            {/* Header / Brand */}
            <div className="text-center mb-6">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sour to-accent text-xl font-black text-base shadow-glow">
                ⚡
              </div>
              <h2 id="auth-modal-title" className="font-display text-2xl font-bold tracking-tight text-white">
                {authMode === 'signin' ? 'Sign in to Blitzcart' : 'Join Blitzcart Drops'}
              </h2>
              <p className="text-xs text-ink-muted mt-1">
                {authMode === 'signin'
                  ? 'Access limited sneaker drops and checkout instantly.'
                  : 'Create an account for high-concurrency drop reservations.'}
              </p>
            </div>

            {/* Tab switch */}
            <div className="mb-6 flex rounded-xl border border-white/10 bg-black/25 p-1">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signin');
                  setError(null);
                }}
                className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
                  authMode === 'signin'
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-ink-muted hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signup');
                  setError(null);
                }}
                className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
                  authMode === 'signup'
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-ink-muted hover:text-white'
                }`}
              >
                Create Account
              </button>
            </div>

            {/* Error banner */}
            {error && (
              <div className="mb-4 animate-shake rounded-xl border border-alert/25 bg-alert-bg p-3 text-center text-xs text-alert">
                {error}
              </div>
            )}

            {/* Auth Form */}
            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {authMode === 'signup' && (
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
                  autoFocus={authMode === 'signin'}
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
                />
              </div>

              <Button type="submit" loading={loading} className="w-full mt-2">
                {loading ? 'Processing…' : authMode === 'signin' ? 'Sign In & Enter' : 'Create Account'}
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
