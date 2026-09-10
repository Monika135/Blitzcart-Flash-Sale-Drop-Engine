import { useCountdown, formatMMSS } from '../hooks/useCountdown';
export default function CountdownBadge({ expiresAt }) {
  const secondsLeft = useCountdown(expiresAt);
  const isUrgent = secondsLeft <= 30;
  const isCritical = secondsLeft <= 10 && secondsLeft > 0;
  return <span role="timer" aria-live="polite" className={`rounded-full border px-3 py-1.5 font-mono text-xs font-semibold transition-colors ${isUrgent ? 'border-alert/25 bg-alert-bg text-alert' : 'border-sour/20 bg-sour/10 text-sour'} ${isCritical ? 'animate-pulse' : ''}`}>{formatMMSS(secondsLeft)}</span>;
}
