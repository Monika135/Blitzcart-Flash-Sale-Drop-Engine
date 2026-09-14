export default function AlertBanner({ tone = 'alert', children }) {
  const tones = {
    alert: 'border-alert/20 bg-alert-bg text-alert',
    sour: 'border-sour/20 bg-sour/10 text-sour',
    neutral: 'border-white/10 bg-white/[0.04] text-ink-muted',
  };
  return <div role={tone === 'alert' ? 'alert' : 'status'} className={`rounded-xl border px-3.5 py-3 text-xs leading-relaxed animate-fade-in ${tones[tone]}`}>{children}</div>;
}
