import { useEffect, useRef, useState } from 'react';
import { getReservationStatus } from '../api/endpoints';

/**
 * Polls reservation status while `active` is true. Payment confirmation
 * is asynchronous (a gateway webhook resolves it on the backend), so
 * there is no single "await the payment" call — this is that wait,
 * done as polling instead of a blocking request.
 *
 * Returns:
 *   status        - 'pending' | 'confirmed' | 'expired' | 'cancelled' | null
 *   orderId       - present once status is 'confirmed'
 *   elapsedMs     - time spent waiting, for a "still working on it" message
 *   error         - set if the status check itself failed (network, 404)
 */
export function useReservationStatus(reservationId, active, intervalMs = 1500) {
  const [status, setStatus] = useState(null);
  const [orderId, setOrderId] = useState(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState(null);
  const startedAt = useRef(null);

  useEffect(() => {
    if (!active || !reservationId) return undefined;

    let cancelled = false;
    startedAt.current = Date.now();

    async function poll() {
      try {
        const data = await getReservationStatus(reservationId);
        if (cancelled) return;
        setStatus(data.status);
        setOrderId(data.order_id || null);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err);
      }
    }

    poll();
    const statusInterval = setInterval(poll, intervalMs);
    const clock = setInterval(() => {
      if (!cancelled) setElapsedMs(Date.now() - startedAt.current);
    }, 1000);

    return () => {
      cancelled = true;
      clearInterval(statusInterval);
      clearInterval(clock);
    };
  }, [reservationId, active, intervalMs]);

  return { status, orderId, elapsedMs, error };
}
