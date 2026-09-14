import { useEffect, useState } from 'react';
import { getProduct } from '../api/endpoints';

/**
 * Polls GET /inventory/products/:sku/ every `intervalMs`. Replace the
 * setInterval below with a websocket subscription once the backend
 * pushes stock updates live — the return shape stays the same, so no
 * page needs to change.
 *
 * Pauses while the tab is hidden so a phone in someone's pocket isn't
 * quietly burning through the flash sale's request budget.
 */
export function useStockPolling(sku, intervalMs = 4000) {
  const [product, setProduct] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchOnce() {
      if (document.hidden) return;
      try {
        const data = await getProduct(sku);
        if (!cancelled) {
          setProduct(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err);
      }
    }

    fetchOnce();
    const interval = setInterval(fetchOnce, intervalMs);
    document.addEventListener('visibilitychange', fetchOnce);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', fetchOnce);
    };
  }, [sku, intervalMs]);

  return { product, error };
}
