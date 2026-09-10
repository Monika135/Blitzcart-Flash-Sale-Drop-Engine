import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3">
      <p className="font-mono text-ink-muted text-sm">404 — nothing dropped here</p>
      <Link to="/" className="text-sour text-sm underline">
        Back to store
      </Link>
    </div>
  );
}
