export default function Button({ children, onClick, disabled, loading = false, variant = 'primary', type = 'button' }) {
  const base = 'w-full h-12 rounded-xl font-body font-semibold text-sm transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2.5 disabled:active:scale-100 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-gradient-to-r from-sour to-accent-soft text-base shadow-glow hover:-translate-y-0.5 hover:brightness-105 disabled:from-base-line disabled:to-base-line disabled:text-ink-faint disabled:shadow-none',
    ghost: 'bg-white/[0.035] border border-white/10 text-ink hover:bg-white/[0.07] hover:border-white/20',
    danger: 'bg-alert-bg border border-alert/25 text-alert hover:bg-alert/20',
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled || loading} aria-busy={loading} className={`${base} ${variants[variant]}`}>
      {loading && <svg className="spinner h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25"/><path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>}
      <span>{children}</span>
    </button>
  );
}
