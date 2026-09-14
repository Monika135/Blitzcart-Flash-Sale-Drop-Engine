import { useEffect, useState } from 'react';
import { getProducts } from '../api/endpoints';

/**
 * Polls GET /inventory/products/ every `intervalMs`.
 * Replaces individual stock polling for each SKU with a single
 * batch request to fetch all product stock counts from Redis at once.
 */
export function useProductsPolling(intervalMs = 4000) {
  const [products, setProducts] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchOnce() {
      if (document.hidden) return;
      try {
        const data = await getProducts();
        if (!cancelled) {
          setProducts(data);
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
  }, [intervalMs]);

  return { products, error };
}
