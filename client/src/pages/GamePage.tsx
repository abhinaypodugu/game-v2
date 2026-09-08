// Game page shell: board center, panels around. The interactive turn-loop
// overlays (build bar, trade modal, robber flow) attach in later phases.

import { useStore } from '../store';
import { BoardSvg } from '../board/BoardSvg';

export function GamePage(): React.JSX.Element {
  const game = useStore((s) => s.game);

  if (game === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#04182a] text-[#f6f8fa]">
        Loading game…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#04182a] text-[#f6f8fa]">
      <div className="mx-auto flex max-w-[1400px] gap-4 p-4">
        <div className="flex-1 rounded-xl bg-[#0a2e52] p-2">
          <BoardSvg snap={game} />
        </div>
        <aside className="w-80 rounded-xl bg-[#0a4986] p-4" data-testid="player-panel">
          <h2 className="mb-2 font-[Bricolage_Grotesque,system-ui] text-xl font-bold">Players</h2>
          <ul className="flex flex-col gap-2">
            {game.players.map((p) => (
              <li
                key={p.seat}
                className={`flex items-center justify-between rounded-lg bg-black/20 px-3 py-2 ${
                  p.seat === game.activeSeat ? 'ring-2 ring-[#f06800]' : ''
                }`}
              >
                <span className="font-medium">{p.name}</span>
                <span className="font-bold">{p.publicVp} VP</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
