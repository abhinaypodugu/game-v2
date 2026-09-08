// Game page: board + all turn-loop UI. Interactive placement, build bar,
// trade modal, robber flow, discard, SBP banner, event log, victory.

import { useEffect, useMemo, useState } from 'react';
import type { GameAction } from '@catan/shared';
import { legalRobberHexes } from '@catan/shared';
import { ReconnectBanner, ToastStack, TurnTimer } from '../components/Overlays';
import { BoardSvg } from '../board/BoardSvg';
import { BuildBar } from '../components/BuildBar';
import { DiceDisplay } from '../components/DiceDisplay';
import { DiscardModal, VictimPicker } from '../components/RobberFlow';
import { EventLog } from '../components/EventLog';
import { TradeModal } from '../components/TradeModal';
import { VictoryOverlay } from '../components/VictoryOverlay';
import { useLegalMoves } from '../hooks/useLegalMoves';
import { useStore } from '../store';
import { PIECE_COLORS } from '../theme';
import type { GameEvent } from '../types';

const RESOURCE_EMOJI = {
  wood: '🪵',
  brick: '🧱',
  sheep: '🐑',
  wheat: '🌾',
  ore: '⛰',
} as const;

const RESOURCE_KEYS = ['wood', 'brick', 'sheep', 'wheat', 'ore'] as const;

export function GamePage(): React.JSX.Element {
  const snap = useStore((s) => s.game);
  const session = useStore((s) => s.session);
  const sendAction = useStore((s) => s.sendAction);
  const setPlacement = useStore((s) => s.setPlacement);
  const placement = useStore((s) => s.ui.placement);
  const showTradeModal = useStore((s) => s.ui.showTradeModal);
  const setTradeModal = useStore((s) => s.setTradeModal);
  const log = useStore((s) => s.log);
  const [rolling, setRolling] = useState(false);
  const [setupVertex, setSetupVertex] = useState<number | null>(null);

  const mySeat = session?.seatIndex ?? -1;
  const legal = useLegalMoves(snap, mySeat);

  // Roll animation trigger: fires on each new rolled event (by version).
  const lastRollSeq = useMemo(() => {
    const rolledEvents = log.filter((e: GameEvent) => e.type === 'rolled');
    return rolledEvents.length;
  }, [log]);
  useEffect(() => {
    if (lastRollSeq === 0) return;
    const start = setTimeout(() => {
      setRolling(true);
    }, 0);
    const stop = setTimeout(() => setRolling(false), 800);
    return () => {
      clearTimeout(start);
      clearTimeout(stop);
    };
  }, [lastRollSeq]);

  // Production pulse: hexes whose token matches the last roll.
  const pulseHexes = useMemo(() => {
    const rolledIdx = log.map((e: GameEvent) => e.type === 'rolled').lastIndexOf(true);
    if (rolledIdx === -1 || snap === null) return new Set<string>();
    const roll = log[rolledIdx] as Extract<GameEvent, { type: 'rolled' }> | undefined;
    if (roll === undefined) return new Set<string>();
    const sum = roll.die1 + roll.die2;
    const hexes = new Set<string>();
    for (const [hex, data] of Object.entries(snap.board.hexes)) {
      if (data.token === sum && hex !== snap.robber) hexes.add(hex);
    }
    return hexes;
  }, [log, snap]);
  if (snap === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#04182a] text-[#f6f8fa]">
        Loading game…
      </div>
    );
  }

  const myTurn = snap.activeSeat === mySeat;
  const sbpWindow = snap.specialBuildSeat === mySeat;
  const canAct = (myTurn && (snap.phase === 'turnMain' || snap.phase === 'turnPreroll')) || sbpWindow;
  const isSetupActor = (snap.phase === 'setupForward' || snap.phase === 'setupReverse') && myTurn;
  const robberPlacing = snap.phase === 'robberMove' && myTurn;

  // Active placement sets for the board renderer.
  const legalVertices =
    placement?.kind === 'settlement'
      ? legal.settlementVertices
      : placement?.kind === 'city'
        ? legal.cityVertices
        : isSetupActor
          ? legal.setupVertices
          : undefined;
  const legalEdges =
    placement?.kind === 'road'
      ? legal.roadEdges
      : isSetupActor && setupVertex !== null
        ? new Set(legal.setupRoadsForVertex(setupVertex))
        : undefined;
  const legalHexes = robberPlacing ? new Set(legalRobberHexes(snap as never)) : undefined;

  const onVertexClick = (vertex: number): void => {
    if (isSetupActor) {
      if (setupVertex === null) {
        // First click: choose the settlement spot; then pick a road edge.
        setSetupVertex(vertex);
        return;
      }
      return;
    }
    if (placement?.kind === 'settlement' && legal.settlementVertices.has(vertex)) {
      const action: GameAction = { type: 'buildSettlement', vertex };
      sendAction(action);
      setPlacement(null);
    } else if (placement?.kind === 'city' && legal.cityVertices.has(vertex)) {
      const action: GameAction = { type: 'buildCity', vertex };
      sendAction(action);
      setPlacement(null);
    }
  };

  const onEdgeClick = (edge: string): void => {
    if (isSetupActor && setupVertex !== null) {
      const action: GameAction = {
        type: 'setupPlace',
        settlementVertex: setupVertex,
        roadEdge: edge,
      };
      sendAction(action);
      setSetupVertex(null);
      return;
    }
    if (placement?.kind === 'road' && legal.roadEdges.has(edge)) {
      const action: GameAction = { type: 'buildRoad', edge };
      sendAction(action);
      setPlacement(null);
    }
  };

  const onHexClick = (hex: string): void => {
    if (robberPlacing) {
      const action: GameAction = { type: 'moveRobber', hex };
      sendAction(action);
    }
  };

  const activePlayer = snap.players[snap.activeSeat]!;
  const me = snap.you;

  return (
    <div className="min-h-screen bg-[#04182a] text-[#f6f8fa]">
      <ReconnectBanner />
      <ToastStack />
      <div className="mx-auto max-w-[1500px] p-4">
        <div className="mb-3 flex items-center justify-between rounded-xl bg-[#0a4986] px-5 py-3" data-testid="turn-banner">
          <div className="flex items-center gap-3">
            <span
              className="inline-block h-4 w-4 rounded-full border border-black/50"
              style={{ background: PIECE_COLORS[activePlayer.color]?.main }}
            />
            <h1 className="font-[Bricolage_Grotesque,system-ui] text-xl font-bold">
              {myTurn ? 'Your turn' : `${activePlayer.name}'s turn`}
            </h1>
            <span className="text-sm text-[#cfe0ee]">
              {snap.phase === 'specialBuild'
                ? `Special build: ${snap.specialBuildSeat !== null ? snap.players[snap.specialBuildSeat]!.name : 'passing'}`
                : snap.phase.replace(/([A-Z])/g, ' $1')}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <DiceDisplay die1={snap.dice?.die1 ?? null} die2={snap.dice?.die2 ?? null} rolling={rolling} />
            <TurnTimer />
            {myTurn && snap.phase === 'turnPreroll' ? (
              <button
                type="button"
                onClick={() => {
                  const action: GameAction = { type: 'rollDice' };
                  sendAction(action);
                }}
                className="rounded-lg bg-[#f06800] px-5 py-2 font-bold hover:bg-[#d05800]"
                data-testid="roll-button"
              >
                🎲 Roll
              </button>
            ) : null}
            {myTurn && snap.phase === 'turnMain' ? (
              <button
                type="button"
                onClick={() => {
                  const action: GameAction = { type: 'endTurn' };
                  sendAction(action);
                }}
                className="rounded-lg bg-[#1fab1c] px-5 py-2 font-bold hover:brightness-110"
                data-testid="end-turn"
              >
                End turn
              </button>
            ) : null}
            {sbpWindow ? (
              <button
                type="button"
                onClick={() => {
                  const action: GameAction = { type: 'specialBuildDone' };
                  sendAction(action);
                }}
                className="rounded-lg bg-[#ef3f2a] px-4 py-2 font-bold hover:brightness-110"
                data-testid="sbp-done"
              >
                Pass build window
              </button>
            ) : null}
            {(myTurn && snap.phase === 'turnMain') || snap.trades.some((t) => t.status === 'open') ? (
              <button
                type="button"
                onClick={() => setTradeModal(true)}
                className="rounded-lg bg-[#1e90ff] px-4 py-2 font-bold hover:brightness-110"
                data-testid="open-trade"
              >
                🔁 Trade
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex gap-4">
          {/* Board */}
          <div className="relative flex-1 rounded-xl bg-[#0a2e52] p-2">
            <BoardSvg
              snap={snap}
              legalVertices={legalVertices}
              legalEdges={legalEdges}
              legalHexes={legalHexes}
              pulseHexes={pulseHexes}
              onVertexClick={onVertexClick}
              onEdgeClick={onEdgeClick}
              onHexClick={onHexClick}
            />
            {isSetupActor ? (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-lg bg-[#04182a]/90 px-4 py-2 text-sm">
                {setupVertex === null
                  ? 'Place your settlement — click a glowing spot.'
                  : 'Now click a glowing edge for your road.'}
              </div>
            ) : null}
            {robberPlacing ? (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-lg bg-[#04182a]/90 px-4 py-2 text-sm">
                Move the robber — click a glowing hex.
              </div>
            ) : null}
          </div>

          {/* Side: players + own hand + log */}
          <aside className="flex w-96 flex-col gap-3" data-testid="player-panel">
            <div className="rounded-xl bg-[#0a4986] p-3">
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-[#cfe0ee]">Players</h2>
              <ul className="flex flex-col gap-1.5">
                {snap.players.map((p) => (
                  <li
                    key={p.seat}
                    className={`flex items-center justify-between rounded-lg bg-black/20 px-3 py-2 text-sm ${
                      p.seat === snap.activeSeat ? 'ring-2 ring-[#f06800]' : ''
                    } ${p.connected ? '' : 'opacity-50'}`}
                    data-testid={`panel-player-${p.seat}`}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 rounded-full border border-black/50"
                        style={{ background: PIECE_COLORS[p.color]?.main }}
                      />
                      {p.name}
                      {snap.longestRoad.holder === p.seat ? ' 🛣' : null}
                      {snap.largestArmy.holder === p.seat ? ' ⚔' : null}
                    </span>
                    <span className="flex items-center gap-3">
                      <span title="resource cards">🃏{p.resourceCount}</span>
                      <span title="dev cards">🎴{p.devCardCount}</span>
                      <b>{p.publicVp} VP</b>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Own hand */}
            <div className="rounded-xl bg-[#0a4986] p-3" data-testid="own-hand">
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-[#cfe0ee]">
                Your hand — {me.totalVp} VP total
              </h2>
              <div className="flex gap-2">
                {RESOURCE_KEYS.map((r) => (
                  <span
                    key={r}
                    className="flex flex-col items-center rounded-lg bg-black/20 px-3 py-1.5 text-lg"
                    data-testid={`own-${r}`}
                  >
                    {RESOURCE_EMOJI[r]}
                    <b>{me.resources[r]}</b>
                  </span>
                ))}
              </div>
              {/* Dev hand */}
              <div className="mt-2 flex flex-wrap gap-2">
                {me.devHand.length === 0 ? (
                  <span className="text-xs text-[#9fb8cc]">No development cards.</span>
                ) : null}
                {me.devHand.map((card) => {
                  return (
                    <button
                      key={card.id}
                      type="button"
                      disabled={
                        !canAct ||
                        card.type === 'victoryPoint' ||
                        card.boughtOnTurn === snap.turn
                      }
                      onClick={() => {
                        const action: GameAction = { type: 'playDevCard', cardId: card.id };
                        sendAction(action);
                      }}
                      className="rounded-lg bg-black/30 px-2 py-1.5 text-xs font-semibold disabled:opacity-40"
                      data-testid={`dev-${card.id}`}
                      title={card.type}
                    >
                      {card.type === 'knight' ? '⚔' : card.type === 'victoryPoint' ? '🏆' : card.type === 'roadBuilding' ? '🛣' : card.type === 'monopoly' ? '👑' : '🎁'}{' '}
                      {card.type}
                    </button>
                  );
                })}
              </div>
            </div>

            <EventLog />
          </aside>
        </div>

        {/* Bottom: build bar */}
        <div className="mt-3 flex justify-center">
          <BuildBar
            mySeat={mySeat}
            canAct={canAct}
            legal={legal}
            onArm={(kind) => {
              setPlacement(placement?.kind === kind ? null : { kind });
            }}
          />
        </div>
      </div>

      {showTradeModal ? <TradeModal mySeat={mySeat} /> : null}
      <DiscardModal mySeat={mySeat} />
      <VictimPicker mySeat={mySeat} />
      <VictoryOverlay />
    </div>
  );
}
