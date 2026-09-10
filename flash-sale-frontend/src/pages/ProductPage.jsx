import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createReservation } from '../api/endpoints';
import { useProductsPolling } from '../hooks/useProductsPolling';
import { useReservation } from '../context/ReservationContext';
import StockBanner from '../components/StockBanner';
import StockProgressBar from '../components/StockProgressBar';
import { ProductCardSkeleton } from '../components/Skeleton';
import AlertBanner from '../components/AlertBanner';
import Button from '../components/Button';
import bredImage from '../assets/air_jordan_bred.png';
import stealthImage from '../assets/air_jordan_stealth.png';
import royalImage from '../assets/air_jordan_royal.png';
import citronImage from '../assets/air_jordan_citron.png';

const PRODUCT_ASSETS = {
  'AJ1-BRED-10': {
    image: bredImage,
    gradient: 'from-accent/20 via-transparent to-sour/15',
    glowColor: 'rgba(255,122,158,0.35)',
    shadowColor: 'rgba(255,122,158,0.4)',
  },
  'AJ1-STEALTH-11': {
    image: stealthImage,
    gradient: 'from-[#A78BFA]/20 via-transparent to-[#C4B5FD]/15',
    glowColor: 'rgba(167,139,250,0.35)',
    shadowColor: 'rgba(167,139,250,0.4)',
  },
  'AJ1-ROYAL-12': {
    image: royalImage,
    gradient: 'from-[#8BE7FF]/20 via-transparent to-[#66E3B4]/15',
    glowColor: 'rgba(139,231,255,0.35)',
    shadowColor: 'rgba(139,231,255,0.4)',
  },
  'AJ1-CITRON-13': {
    image: citronImage,
    gradient: 'from-[#66E3B4]/20 via-transparent to-[#FF7A9E]/15',
    glowColor: 'rgba(102,227,180,0.35)',
    shadowColor: 'rgba(102,227,180,0.4)',
  },
};

const assetsList = [
  PRODUCT_ASSETS['AJ1-BRED-10'],
  PRODUCT_ASSETS['AJ1-STEALTH-11'],
  PRODUCT_ASSETS['AJ1-ROYAL-12'],
  PRODUCT_ASSETS['AJ1-CITRON-13'],
];

function getAssetsForSku(sku, index = 0) {
  if (PRODUCT_ASSETS[sku]) {
    return PRODUCT_ASSETS[sku];
  }
  return assetsList[index % assetsList.length];
}

export default function ProductPage() {
  const navigate = useNavigate();
  const { startReservation } = useReservation();
  const [activeSku, setActiveSku] = useState(null);
  const { products, error } = useProductsPolling();
  const [reserving, setReserving] = useState(false);
  const [reserveError, setReserveError] = useState(null);
  const [selectedSize, setSelectedSize] = useState('UK 9');

  // Select first SKU or environment variable SKU on mount / products load
  useEffect(() => {
    if (products && products.length > 0 && !activeSku) {
      const envSku = import.meta.env.VITE_PRODUCT_SKU;
      const hasEnvSku = products.some(p => p.id === envSku);
      setActiveSku(hasEnvSku ? envSku : products[0].id);
    }
  }, [products, activeSku]);

  // Generated once per Buy Now attempt and reused across retries of
  // that same attempt, so a flaky network never double-reserves stock.
  // Cleared after a definitive outcome so the *next* click gets a fresh key.
  const idempotencyKeyRef = useRef(null);

  async function handleBuyNow() {
    if (!activeSku || !product) return;
    setReserving(true);
    setReserveError(null);
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = crypto.randomUUID();
    }

    try {
      const reservation = await createReservation(activeSku, 1, idempotencyKeyRef.current);
      startReservation(
        {
          id: reservation.id,
          sku: activeSku,
          quantity: reservation.quantity ?? 1,
          status: reservation.status,
          expires_at: reservation.expires_at,
        },
        product
      );
      idempotencyKeyRef.current = null;
      navigate('/checkout');
    } catch (err) {
      if (err.status === 409) {
        setReserveError('Just sold out — better luck next drop.');
        idempotencyKeyRef.current = null; // definitive outcome, next click is a new attempt
      } else if (err.status === 404) {
        setReserveError('This drop is no longer available.');
        idempotencyKeyRef.current = null;
      } else {
        // Network hiccup or 5xx — keep the same idempotency key so a
        // retry can't create a second reservation if the first request
        // actually landed.
        setReserveError('Something went wrong. Try again.');
      }
    } finally {
      setReserving(false);
    }
  }

  if (error) {
    return (
      <Centered>
        <div className="w-full max-w-sm">
          <AlertBanner tone="alert">
            Could not load the products. Is the backend running at{' '}
            <span className="font-mono">{import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}</span>?
          </AlertBanner>
        </div>
      </Centered>
    );
  }

  if (!products || !activeSku) {
    return (
      <Centered>
        <ProductCardSkeleton />
      </Centered>
    );
  }

  const product = products.find(p => p.id === activeSku);

  if (!product) {
    return (
      <Centered>
        <ProductCardSkeleton />
      </Centered>
    );
  }

  const soldOut = product.remainingStock <= 0;
  const activeIndex = products.findIndex(p => p.id === activeSku);
  const assets = getAssetsForSku(activeSku, activeIndex >= 0 ? activeIndex : 0);

  return (
    <Centered>
      <div className="flex flex-col gap-8 w-full max-w-5xl page-in">
        {/* Main Product Showcase Panel */}
        <div className="grid w-full overflow-hidden rounded-3xl glass-panel md:grid-cols-[1.08fr_.92fr]">
          <div className="relative overflow-hidden border-b border-white/10 p-8 md:border-b-0 md:border-r flex flex-col justify-between">
            <div className="absolute inset-0 bg-gradient-to-br from-accent/25 via-transparent to-sour/10" />
            <div className="absolute -left-20 top-16 h-56 w-56 rounded-full bg-accent/20 blur-3xl" />
            <div className="absolute -right-16 bottom-10 h-52 w-52 rounded-full bg-sour/15 blur-3xl" />
            <div className="relative flex h-full flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[.22em] text-ink-muted">Limited drop</span>
                <span className="font-mono text-[11px] text-ink-faint">SKU · {activeSku}</span>
              </div>
              
              <div className="relative mx-auto flex h-52 w-52 md:h-72 md:w-72 items-center justify-center py-4">
                {/* Pulsing glow background behind the product */}
                <div className={`absolute inset-0 rounded-full bg-gradient-to-tr ${assets.gradient} blur-3xl opacity-75 animate-pulse`} />
                
                {/* Shadow underneath */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-48 h-5 bg-black/40 rounded-full blur-xl animate-pulse" />

                {/* Floating product image */}
                <img
                  src={assets.image}
                  alt={product.name}
                  className="product-float relative z-10 w-full h-auto object-contain transition-transform duration-500 hover:scale-105"
                  style={{
                    filter: `drop-shadow(0 20px 45px ${assets.glowColor})`
                  }}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Feature label="Verified" value="Authentic" />
                <Feature label="Delivery" value="48 hours" />
                <Feature label="Returns" value="14 days" />
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-center p-6 sm:p-8 md:p-10">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[.2em] text-sour">VibeEnergy exclusive</p>
            <div className="mb-6 flex items-start justify-between gap-6">
              <div>
                <h1 className="font-display text-3xl font-bold leading-tight tracking-tight">{product.name}</h1>
                <p className="mt-2 text-sm leading-6 text-ink-muted">{product.subtitle}</p>
              </div>
              <span className="font-mono text-2xl font-semibold tabular-nums text-white shrink-0 whitespace-nowrap">Rs. {((product.priceCents / 100) * 83).toLocaleString('en-IN')}</span>
            </div>
            <div className="mb-3"><StockBanner remaining={product.remainingStock} viewersLive={product.viewersLive} /></div>
            <div className="mb-7"><StockProgressBar remaining={product.remainingStock} total={product.totalStock} /></div>
            <div className="mb-4 rounded-2xl border border-white/10 bg-black/15 p-4">
              <div className="mb-2 flex justify-between text-xs">
                <span className="text-ink-muted">Selected size</span>
                <span className="font-semibold">{selectedSize}</span>
              </div>
              <div className="flex gap-2">
                {['UK 8', 'UK 9', 'UK 10'].map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setSelectedSize(size)}
                    className={`rounded-lg border px-3 py-2 text-xs transition-colors cursor-pointer ${
                      size === selectedSize
                        ? 'border-sour/40 bg-sour/10 text-sour font-semibold'
                        : 'border-white/10 text-ink-faint hover:bg-white/5 hover:text-ink-muted'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={handleBuyNow} disabled={soldOut} loading={reserving}>{soldOut ? 'Sold out' : reserving ? 'Reserving…' : 'Reserve & buy now'}</Button>
            {reserveError && <div className="mt-3 animate-shake"><p className="text-center text-xs text-alert">{reserveError}</p></div>}
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-ink-faint"><span>🔒</span><span>Secure checkout · Reserved for 2 minutes</span></div>
          </div>
        </div>

        {/* Explore Drops Grid Section */}
        <div className="mt-4">
          <div className="mb-5 flex items-center justify-between border-b border-white/5 pb-3">
            <div>
              <h2 className="font-display text-xl font-bold tracking-tight text-white">Exclusive Drops Collection</h2>
              <p className="text-xs text-ink-muted mt-1">Select a sneaker below to update details and purchase</p>
            </div>
            <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-mono text-ink-faint animate-pulse">
              ● Live Status
            </span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {products.map((p, index) => (
              <ProductCard
                key={p.id}
                product={p}
                index={index}
                active={p.id === activeSku}
                onClick={() => setActiveSku(p.id)}
              />
            ))}
          </div>
        </div>
      </div>
    </Centered>
  );
}

function ProductCard({ product, index, active, onClick }) {
  const isSoldOut = product.remainingStock <= 0;
  const assets = getAssetsForSku(product.id, index);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex flex-col justify-between items-center text-left w-full rounded-2xl border p-4 bg-black/15 transition-all duration-300 hover:-translate-y-1 hover:bg-black/30 hover:border-white/20 text-ink cursor-pointer outline-none ${
        active
          ? 'border-sour bg-sour/5 shadow-glow'
          : 'border-white/10'
      }`}
    >
      {isSoldOut && (
        <span className="absolute top-2.5 right-2.5 rounded-full bg-alert-bg border border-alert/25 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-alert">
          Sold Out
        </span>
      )}
      
      {/* Sneaker Image */}
      <div className="h-24 w-24 flex items-center justify-center mb-3">
        <img
          src={assets.image}
          alt={product.name}
          className="w-full h-full object-contain drop-shadow-[0_8px_15px_rgba(0,0,0,0.5)] transition-transform duration-300 group-hover:scale-105"
        />
      </div>

      {/* Product Details */}
      <div className="w-full text-center">
        <h3 className="text-xs font-semibold font-display tracking-tight truncate w-full text-white">{product.name}</h3>
        <div className="flex justify-between items-center mt-2.5 text-[11px]">
          <span className="font-mono text-ink-muted">
            Rs. {((product.priceCents / 100) * 83).toLocaleString('en-IN')}
          </span>
          <span className={`font-mono font-medium ${isSoldOut ? 'text-ink-faint' : product.remainingStock < 10 ? 'text-alert' : 'text-success'}`}>
            {isSoldOut ? '0 left' : `${product.remainingStock} left`}
          </span>
        </div>
      </div>
    </button>
  );
}

function Feature({ label, value }) {
  return <div className="rounded-xl border border-white/10 bg-black/10 p-3"><p className="text-[10px] uppercase tracking-wider text-ink-faint">{label}</p><p className="mt-1 text-xs font-semibold text-ink-muted">{value}</p></div>;
}

function Centered({ children }) {
  return <main className="min-h-screen px-4 pb-16 pt-24 sm:px-6 w-full flex flex-col items-center justify-start">{children}</main>;
}
