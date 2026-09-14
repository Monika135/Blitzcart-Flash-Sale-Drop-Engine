import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReservation } from '../context/ReservationContext';
import Button from '../components/Button';

export default function ConfirmationPage() {
  const navigate = useNavigate();
  const { order, clear } = useReservation();

  useEffect(() => {
    if (!order) navigate('/');
  }, [order, navigate]);

  if (!order) return null;

  const amountCents = (order.priceCents || 0) * (order.quantity || 1);

  function backToStore() {
    clear();
    navigate('/');
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 pb-10 pt-28">
      <div className="glass-panel w-full max-w-md rounded-3xl p-8 text-center page-in">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-success/25 bg-success-bg shadow-glow">
          <span className="text-success text-2xl">✓</span>
        </div>
        <h1 className="font-display text-2xl font-bold mb-2">Order confirmed</h1>
        <p className="text-xs text-ink-muted mb-5">
          Order #{order.orderId}
          {order.name ? ` · ${order.name}` : ''}
        </p>

        <div className="mb-6 space-y-3 rounded-2xl border border-white/10 bg-black/15 p-4 text-left">
          <Row label="Payment" value={`Charged Rs. ${((amountCents / 100) * 83).toLocaleString('en-IN')}`} tone="ok" />
          <Row label="Inventory" value="Confirmed, no oversell" tone="ok" />
          <Row label="Quantity" value={order.quantity ?? 1} />
        </div>

        <Button variant="ghost" onClick={backToStore}>
          Back to store
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value, tone }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-ink-muted">{label}</span>
      <span className={tone === 'ok' ? 'text-success' : 'text-ink'}>{value}</span>
    </div>
  );
}
