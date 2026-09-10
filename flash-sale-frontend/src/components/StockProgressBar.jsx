export default function StockProgressBar({ remaining, total }) {
  const claimedPct = total > 0 ? Math.min(100, Math.round(((total - remaining) / total) * 100)) : 0;
  const isCritical = total > 0 && remaining / total <= 0.1;

  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded bg-base-line"
      role="progressbar"
      aria-label="Stock claimed"
      aria-valuenow={claimedPct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full transition-all duration-700 ease-out ${
          isCritical ? 'bg-alert' : 'bg-sour'
        }`}
        style={{ width: `${claimedPct}%` }}
      />
    </div>
  );
}
