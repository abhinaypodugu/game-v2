// Home: create or join a room. Dark sea theme, minimal form.

import { useState } from 'react';
import { useStore } from '../store';

export function HomePage(): React.JSX.Element {
  const createRoom = useStore((s) => s.createRoom);
  const joinRoom = useStore((s) => s.joinRoom);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 bg-[#04182a] text-[#f6f8fa]">
      <div className="text-center">
        <h1 className="font-[Bricolage_Grotesque,system-ui] text-6xl font-bold tracking-tight">
          Catan
        </h1>
        <p className="mt-2 text-lg text-[#9fb8cc]">
          Play Settlers of Catan with friends — right in your browser.
        </p>
      </div>

      <div className="flex w-full max-w-md flex-col gap-4 rounded-xl bg-[#0a4986] p-6 shadow-[0_2px_4px_rgba(0,0,0,0.2)]">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-[#cfe0ee]">Your name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={24}
            placeholder="e.g. Alice"
            className="rounded-lg bg-[#04182a] px-4 py-3 text-lg outline-none ring-1 ring-black/30 focus:ring-[#f06800]"
            data-testid="name-input"
          />
        </label>

        <button
          type="button"
          disabled={name.trim().length === 0}
          onClick={() => createRoom(name.trim())}
          className="rounded-lg bg-[#f06800] px-4 py-3 text-lg font-semibold text-white transition hover:bg-[#d05800] disabled:opacity-50"
          data-testid="create-room"
        >
          Create Room
        </button>

        <div className="flex items-center gap-3 text-sm text-[#9fb8cc]">
          <span className="h-px flex-1 bg-white/20" />
          or
          <span className="h-px flex-1 bg-white/20" />
        </div>

        <div className="flex gap-3">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={4}
            placeholder="CODE"
            className="w-28 rounded-lg bg-[#04182a] px-4 py-3 text-center text-lg font-bold tracking-widest outline-none ring-1 ring-black/30 focus:ring-[#1e90ff]"
            data-testid="join-code-input"
          />
          <button
            type="button"
            disabled={code.length !== 4 || name.trim().length === 0 || joining}
            onClick={() => {
              setJoining(true);
              joinRoom(code, name.trim());
            }}
            className="flex-1 rounded-lg bg-[#1fab1c] px-4 py-3 text-lg font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
            data-testid="join-room"
          >
            {joining ? 'Joining…' : 'Join Room'}
          </button>
        </div>
      </div>
    </div>
  );
}
