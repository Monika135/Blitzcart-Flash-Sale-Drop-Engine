import { useEffect, useState, useCallback } from 'react';
import { getAdminSummary, getReconciliationQueue, retryReconciliation } from '../api/endpoints';
import StatCard from '../components/StatCard';
import AlertBanner from '../components/AlertBanner';
import Skeleton from '../components/Skeleton';

const ACTION_LABELS = {
  mark_failed_release_stock: 'Release stock',
  confirm_order: 'Confirm order',
};

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [resolvingId, setResolvingId] = useState(null);

  const load = useCallback(async () => {
    try {
      const [statsData, queueData] = await Promise.all([
        getAdminSummary(),
        getReconciliationQueue(),
      ]);
      setStats(statsData);
      setQueue(queueData);
      setLoadError(null);
    } catch (err) {
      setLoadError('Could not load ops data. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, [load]);

  async function handleResolve(paymentId) {
    setResolvingId(paymentId);
    try {
      await retryReconciliation(paymentId);
      await load();
    } finally {
      setResolvingId(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen px-4 pb-10 pt-28 sm:px-6 md:px-8 max-w-6xl mx-auto">
        <Skeleton className="h-6 w-64 mb-6" />
        <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <AlertBanner tone="alert">{loadError}</AlertBanner>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 pb-10 pt-28 sm:px-6 md:px-8 max-w-6xl mx-auto page-in">
      <div className="mb-8"><p className="mb-2 text-xs font-semibold uppercase tracking-[.2em] text-sour">Operations centre</p><h1 className="font-display text-3xl font-bold tracking-tight">Blitzcart live drop engine</h1><p className="mt-2 text-sm text-ink-muted">Real-time inventory, reservations and payment reconciliation.</p></div>

      <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Stock remaining" value={`${stats.stockRemaining} / ${stats.stockTotal}`} />
        <StatCard label="Orders confirmed" value={stats.ordersConfirmed} />
        <StatCard label="Reservations active" value={stats.reservationsActive} />
        <StatCard
          label="Needs reconciliation"
          value={stats.needsReconciliation}
          tone={stats.needsReconciliation > 0 ? 'warning' : 'default'}
        />
      </div>

      <div className="mb-4 flex items-end justify-between"><div><h2 className="font-display text-lg font-bold">Reconciliation queue</h2><p className="mt-1 text-xs text-ink-muted">Payments that need a manual retry or inventory correction.</p></div><span className="rounded-full border border-success/20 bg-success-bg px-3 py-1 text-[11px] text-success">Auto-refresh · 8s</span></div>
      <div className="glass-panel overflow-hidden rounded-2xl">
        <div className="grid grid-cols-4 border-b border-white/10 bg-white/[0.025] px-5 py-3 text-xs font-semibold text-ink-muted">
          <span>Reservation</span>
          <span>Payment</span>
          <span>Inventory</span>
          <span>Action</span>
        </div>
        {queue.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-ink-faint">
            Nothing pending — all payments reconciled.
          </div>
        )}
        {queue.map((item) => (
          <div
            key={item.paymentId}
            className="grid grid-cols-4 items-center border-t border-white/10 px-5 py-4 text-sm animate-fade-in"
          >
            <span className="font-mono text-xs truncate" title={item.reservationId}>
              {item.sku}
            </span>
            <span
              className={
                item.paymentStatus === 'charged' ? 'text-sour text-xs' : 'text-alert text-xs'
              }
            >
              {item.paymentStatus.replace('_', ' ')}
            </span>
            <span
              className={
                item.inventoryStatus === 'held' ? 'text-alert text-xs' : 'text-alert text-xs'
              }
            >
              {item.inventoryStatus.replace('_', ' ')}
            </span>
            <button
              onClick={() => handleResolve(item.paymentId)}
              disabled={resolvingId === item.paymentId}
              className="justify-self-start rounded bg-alert-bg text-alert text-xs px-2.5 py-1 hover:brightness-110 disabled:opacity-50 transition"
            >
              {resolvingId === item.paymentId
                ? 'Resolving…'
                : ACTION_LABELS[item.suggestedAction] || 'Resolve'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
