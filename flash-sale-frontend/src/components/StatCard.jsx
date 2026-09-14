export default function StatCard({ label, value, tone = 'default' }) {
  return (
    <div className={`glass-panel rounded-2xl p-4 transition-all duration-200 hover:-translate-y-1 ${tone === 'warning' ? 'border-alert/30' : ''}`}>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-ink-muted">{label}</p>
        <span className={`h-2 w-2 rounded-full ${tone === 'warning' ? 'bg-alert' : 'bg-success'}`} />
      </div>
      <p className={`font-mono text-2xl font-semibold tabular-nums ${tone === 'warning' ? 'text-alert' : 'text-ink'}`}>{value}</p>
    </div>
  );
}
