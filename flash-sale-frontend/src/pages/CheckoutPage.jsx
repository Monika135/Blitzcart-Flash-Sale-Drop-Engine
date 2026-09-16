import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { initiatePayment, cancelReservation } from '../api/endpoints';
import { USE_MOCK } from '../api/client';
import { useReservation } from '../context/ReservationContext';
import { useAuth } from '../context/AuthContext';
import { useCountdown } from '../hooks/useCountdown';
import { useReservationStatus } from '../hooks/useReservationStatus';
import CountdownBadge from '../components/CountdownBadge';
import AlertBanner from '../components/AlertBanner';
import Button from '../components/Button';

function loadRazorpaySdk() {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && window.Razorpay) {
      resolve(true);
      return;
    }
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => resolve(false));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { reservation, productSnapshot, setOrder, clear } = useReservation();
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Pre-load Razorpay SDK on-demand only when entering checkout
  useEffect(() => {
    loadRazorpaySdk();
  }, []);

  const secondsLeft = useCountdown(reservation?.expires_at);
  const expired = reservation && secondsLeft <= 0;
  const quantity = reservation?.quantity ?? 1;
  const priceCents = productSnapshot?.priceCents ?? 0;
  const totalAmountCents = priceCents * quantity;
  const totalAmountInr = ((totalAmountCents / 100) * 83).toLocaleString('en-IN');

  const { status: liveStatus, orderId, elapsedMs } = useReservationStatus(
    reservation?.id,
    processing
  );

  useEffect(() => {
    if (!reservation) navigate('/');
  }, [reservation, navigate]);

  // React to the polled outcome once the gateway webhook resolves it.
  useEffect(() => {
    if (!processing || !liveStatus) return;

    if (liveStatus === 'confirmed') {
      setOrder({
        orderId,
        sku: productSnapshot?.id,
        name: productSnapshot?.name,
        priceCents: productSnapshot?.priceCents,
        quantity,
      });
      navigate('/confirmation');
    } else if (liveStatus === 'cancelled') {
      setProcessing(false);
      setPayError('Payment was declined. You can try again.');
    } else if (liveStatus === 'expired') {
      setProcessing(false);
      setPayError('Your reservation expired before payment could be confirmed.');
    }
    // "pending" just means keep waiting.
  }, [liveStatus, processing, orderId, navigate, setOrder, productSnapshot, quantity]);

  function getRazorpayOrderId(result) {
    const candidate = result?.razorpay_order_id || result?.payment_reference || result?.order_id;
    if (!candidate || typeof candidate !== 'string') return null;
    return candidate.startsWith('order_') ? candidate : null;
  }

  async function openRazorpayCheckout(orderIdToPayFor) {
    if (typeof window.Razorpay === 'undefined') {
      const loaded = await loadRazorpaySdk();
      if (!loaded || typeof window.Razorpay === 'undefined') {
        throw new Error('Razorpay SDK failed to load. Please disable any ad-blockers or refresh the page.');
      }
    }

    const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_TKcBJPfC55z66F';

    const options = {
      key: razorpayKey,
      amount: totalAmountCents,
      currency: 'INR',
      name: 'Blitzcart Drop Engine',
      description: `Payment for ${productSnapshot?.name || 'Order Checkout'} (10m Hold)`,
      order_id: orderIdToPayFor,
      prefill: {
        name: user?.name || '',
        email: user?.email || '',
      },
      theme: {
        color: '#6366f1',
      },
      modal: {
        ondismiss: function () {
          setPaying(false);
        },
      },
      handler: function (response) {
        console.log('Razorpay payment response:', response);
        setProcessing(true);
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  }

  async function handlePay() {
    setPaying(true);
    setPayError(null);

    try {
      const paymentToken = USE_MOCK ? '4000 0000 0000 0000' : 'razorpay_redirect';
      const result = await initiatePayment(reservation.id, paymentToken);

      if (result.order_id && result.replayed) {
        // Already-paid replay - go straight to confirmation.
        setOrder({
          orderId: result.order_id,
          sku: productSnapshot?.id,
          name: productSnapshot?.name,
          priceCents: productSnapshot?.priceCents,
          quantity,
        });
        navigate('/confirmation');
        return;
      }

      const razorpayOrderId = getRazorpayOrderId(result);
      if (razorpayOrderId) {
        await openRazorpayCheckout(razorpayOrderId);
        return;
      }

      if (result.payment_url || result.checkout_url || result.redirect_url) {
        window.location.assign(result.payment_url || result.checkout_url || result.redirect_url);
        return;
      }

      // 202 processing - webhook confirmation will arrive asynchronously.
      setProcessing(true);
    } catch (err) {
      if (err.status === 410) {
        setPayError('Your reservation expired. The item was released.');
      } else if (err.status === 409) {
        setPayError('This reservation can no longer be paid for.');
      } else {
        setPayError(err.message || 'Could not start payment. Please try again.');
      }
      setPaying(false);
    }
  }

  async function handleCancel() {
    setCancelling(true);
    try {
      await cancelReservation(reservation.id);
      clear();
      navigate('/');
    } catch (err) {
      setPayError(
        err.status === 409
          ? 'A payment is already in progress - it has to resolve first.'
          : 'Could not cancel. Please try again.'
      );
    } finally {
      setCancelling(false);
    }
  }

  if (!reservation) return null;

  if (processing) {
    return <ProcessingScreen elapsedMs={elapsedMs} secondsLeft={secondsLeft} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 pb-10 pt-28">
      <div className="w-full max-w-md page-in">
        <div className="glass-panel rounded-3xl p-6 sm:p-7">
          <div className="flex items-center justify-between mb-1">
            <h1 className="font-display text-xl font-bold tracking-tight">Complete your order</h1>
            <CountdownBadge expiresAt={reservation.expires_at} />
          </div>
          <p className="text-sm text-ink-muted mb-5 mt-1">
            Item reserved, complete payment before the timer runs out
          </p>

          <div className="mb-5 flex items-center gap-4 rounded-2xl border border-white/10 bg-black/15 p-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/30 to-sour/10 text-lg">
              🛒
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {productSnapshot?.name || 'Reserved item'}
              </p>
              <p className="text-xs text-ink-muted">Qty {quantity}</p>
            </div>
            <span className="font-mono text-sm tabular-nums text-white">
              Rs. {totalAmountInr}
            </span>
          </div>

          <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs font-semibold uppercase tracking-[.2em] text-sour mb-2">
              Razorpay checkout
            </p>
            <p className="text-xs leading-5 text-ink-muted">
              You will be taken into the Razorpay payment flow. Once the gateway returns,
              the backend webhook confirms the order and this page moves on automatically.
            </p>
            {USE_MOCK && (
              <p className="mt-2 text-[11px] leading-5 text-ink-faint">
                Mock mode is active, so this uses the local payment simulator and then waits
                for the simulated webhook result.
              </p>
            )}
          </div>

          <Button onClick={handlePay} disabled={expired} loading={paying}>
            {expired ? 'Reservation expired' : USE_MOCK ? `Pay Rs. ${totalAmountInr}` : 'Pay with Razorpay'}
          </Button>

          {payError && (
            <div className="mt-2 animate-shake">
              <p className="text-alert text-xs text-center">{payError}</p>
            </div>
          )}

          {!expired && (
            <button
              onClick={handleCancel}
              disabled={cancelling || paying}
              className="w-full text-center text-xs text-ink-faint hover:text-ink-muted mt-3 disabled:opacity-50 transition-colors"
            >
              {cancelling ? 'Releasing...' : 'Cancel and release item'}
            </button>
          )}
        </div>

        <div className="mt-4 rounded-2xl border border-alert/15 bg-alert-bg p-4">
          <p className="text-xs font-medium text-alert mb-1">If timer expires</p>
          <p className="text-xs text-ink-muted">
            Reservation releases automatically, item returns to available stock, and no charge is made.
          </p>
        </div>
      </div>
    </div>
  );
}

function ProcessingScreen({ elapsedMs, secondsLeft }) {
  const seconds = Math.round(elapsedMs / 1000);
  const showDevHint = !USE_MOCK && seconds >= 6;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 pb-10 pt-28">
      <div className="glass-panel w-full max-w-md rounded-3xl p-8 text-center page-in">
        <div className="w-12 h-12 rounded-full bg-sour/10 flex items-center justify-center mx-auto mb-4">
          <svg className="spinner h-6 w-6 text-sour" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
        <h1 className="font-display text-base mb-1">Confirming payment</h1>
        <p className="text-xs text-ink-muted mb-1">
          Your payment is being processed by the gateway. This usually takes a few seconds.
        </p>
        <p className="text-xs text-ink-faint font-mono mt-3">
          {secondsLeft > 0 ? `${secondsLeft}s left on your hold` : 'Hold window closing'}
        </p>

        {showDevHint && (
          <div className="mt-4 text-left">
            <AlertBanner tone="neutral">
              Still waiting? In local dev, nothing auto-confirms this - the gateway webhook has to
              be simulated manually:
              <br />
              <span className="font-mono block mt-1">
                python scripts/simulate_webhook.py --reference &lt;ref&gt; --outcome succeeded
              </span>
            </AlertBanner>
          </div>
        )}
      </div>
    </div>
  );
}
