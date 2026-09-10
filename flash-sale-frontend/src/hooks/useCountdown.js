import { useEffect, useState } from 'react';

/** Returns remaining seconds until `expiresAt` (ISO string), ticking every second. */
export function useCountdown(expiresAt) {
  const [secondsLeft, setSecondsLeft] = useState(() => secondsUntil(expiresAt));

  useEffect(() => {
    if (!expiresAt) return;
    const interval = setInterval(() => {
      setSecondsLeft(secondsUntil(expiresAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return Math.max(0, secondsLeft);
}

function secondsUntil(isoString) {
  if (!isoString) return 0;
  return Math.round((new Date(isoString).getTime() - Date.now()) / 1000);
}

export function formatMMSS(totalSeconds) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}
