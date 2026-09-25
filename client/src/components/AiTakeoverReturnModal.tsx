import { useState } from 'react';

interface AiTakeoverReturnModalProps {
  playerName?: string;
  onResume: () => void;
  onStaySpectating?: () => void;
}

export function AiTakeoverReturnModal({
  playerName,
  onResume,
  onStaySpectating,
}: AiTakeoverReturnModalProps): React.JSX.Element {
  const [minimized, setMinimized] = useState(false);

  if (minimized) {
    return (
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 animate-pop-in">
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className="flex items-center gap-2 rounded-2xl border-2 border-ocean-deep bg-ocean-deep px-4 py-2 text-sm font-bold text-white shadow-xl hover:bg-ocean-deep/90 active:translate-y-px"
          data-testid="ai-takeover-minimized-pill"
        >
          <span className="text-lg animate-pulse">🤖</span>
          <span>AI is playing for you • Tap to resume</span>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-sm rounded-3xl border-2 border-line bg-parchment p-6 shadow-2xl animate-pop-in text-ink">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ocean-deep/15 text-2xl text-ocean-deep">
            🤖
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-ink">Welcome Back!</h2>
            <p className="text-xs font-semibold text-ocean-deep">AI Autoplay Active</p>
          </div>
        </div>

        <p className="text-xs text-ink/80 mb-3 leading-relaxed">
          {playerName ? `${playerName}, your` : 'Your'} turn timer expired or you were away, so the AI stepped in to keep the game going smoothly.
        </p>
        <p className="text-xs text-ink/70 mb-5">
          Tap below whenever you are ready to take back your seat and continue playing.
        </p>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onResume}
            className="h-12 w-full rounded-2xl bg-go font-display text-base font-bold text-white shadow-[0_3px_0_#1d7a2c] hover:brightness-105 active:translate-y-px"
            data-testid="btn-resume-control"
          >
            🎮 I'm Back - Resume Control
          </button>
          <button
            type="button"
            onClick={() => {
              setMinimized(true);
              onStaySpectating?.();
            }}
            className="h-10 w-full rounded-xl border border-line bg-white/70 font-display text-xs font-bold text-ink-soft hover:bg-white active:translate-y-px"
            data-testid="btn-stay-spectating"
          >
            🍿 Keep AI Playing (Spectate)
          </button>
        </div>
      </div>
    </div>
  );
}
