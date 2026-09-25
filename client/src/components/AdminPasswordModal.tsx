import { useState } from 'react';
import { useStore } from '../store';

interface AdminPasswordModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export function AdminPasswordModal({ onClose, onSuccess }: AdminPasswordModalProps): React.JSX.Element {
  const unlockAdmin = useStore((s) => s.unlockAdmin);
  const pushToast = useStore((s) => s.pushToast);
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e?: React.FormEvent): void => {
    e?.preventDefault();
    if (!password.trim()) {
      setError(true);
      return;
    }
    const ok = unlockAdmin(password);
    if (ok) {
      pushToast('Simulation mode unlocked!', 'info');
      onSuccess?.();
      onClose();
    } else {
      setError(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-sm rounded-3xl border-2 border-line bg-parchment p-6 shadow-2xl animate-pop-in">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ocean-deep/15 text-2xl text-ocean-deep">
            🔒
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-ink">Admin Access</h2>
            <p className="text-xs font-semibold text-ink-soft">Simulation & Bot Controls</p>
          </div>
        </div>

        <p className="text-xs text-ink/80 mb-4 leading-relaxed">
          Enter the admin password to unlock all-bot simulations, match spectating, and turbo simulation speeds.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <input
              type="password"
              autoFocus
              placeholder="Admin password…"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(false);
              }}
              className={`h-12 w-full rounded-xl border-2 px-3 text-base font-bold text-ink bg-white outline-none transition-all ${
                error ? 'border-red-500 bg-red-50' : 'border-line focus:border-cta'
              }`}
              data-testid="admin-password-input"
            />
            {error ? (
              <span className="text-[11px] font-bold text-red-600 pl-1">
                Incorrect password. Please try again.
              </span>
            ) : null}
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-12 flex-1 rounded-xl border-2 border-line bg-white font-display text-sm font-bold text-ink-soft hover:bg-black/5 active:translate-y-px"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-12 flex-1 rounded-xl bg-cta font-display text-sm font-bold text-ink shadow-[0_3px_0_#a86d08] active:translate-y-px"
              data-testid="btn-unlock-admin"
            >
              🔓 Unlock
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
