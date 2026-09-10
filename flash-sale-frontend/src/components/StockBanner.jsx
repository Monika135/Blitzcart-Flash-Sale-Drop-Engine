export default function StockBanner({ remaining, viewersLive }) {
  const isLow = remaining <= 10 && remaining > 0;
  const isSoldOut = remaining <= 0;
  return (
    <div className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 transition-colors duration-300 ${isSoldOut ? 'border-white/5 bg-white/[0.03]' : 'border-alert/20 bg-alert-bg'}`}>
      <span className={`font-mono text-xs font-semibold ${isSoldOut ? 'text-ink-faint' : 'text-alert'} ${isLow ? 'animate-pulse' : ''}`}>
        {isSoldOut ? 'SOLD OUT' : `Only ${remaining} left`}
      </span>
      {!isSoldOut && <span className="flex items-center gap-2 font-mono text-[11px] text-alert"><span className="live-dot" />{viewersLive} viewing now</span>}
    </div>
  );
}
