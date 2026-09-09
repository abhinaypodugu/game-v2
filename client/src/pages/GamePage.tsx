// Game Page: 100% immersive full-screen Three.js 3D board with floating cockpit HUD.
// Layout:
// - Absolute inset-0: ThreeBoard (WebGL canvas with orbit/pan/zoom)
// - Top Center: Floating Turn & Dice Bar
// - Top Left: Floating Player Badges (avatars, VP, cards, longest road)
// - Bottom Center: Realistic Card Hand Tray & Attached Build Menu
// - Bottom Right: Collapsible Event Log Drawer

import { useEffect, useMemo, useState } from 'react';
import type { GameAction } from '@catan/shared';
import { legalRobberHexes } from '@catan/shared';
import { ThreeBoard } from '../board/ThreeBoard';
import { CardHandTray } from '../components/CardHandTray';
import { DiceDisplay } from '../components/DiceDisplay';
import { PlayerBadges } from '../components/PlayerBadges';
import { CollapsibleLog } from '../components/CollapsibleLog';
import { DiscardModal, VictimPicker } from '../components/RobberFlow';
import { ReconnectBanner, ToastStack, TurnTimer } from '../components/Overlays';
import { TradeModal } from '../components/TradeModal';
import { VictoryOverlay } from '../components/VictoryOverlay';
import { ProductionFloaters } from '../components/ProductionFloaters';
import { useLegalMoves } from '../hooks/useLegalMoves';
import { useStore } from '../store';
import { PIECE_COLORS } from '../theme';
import type { GameEvent } from '../types';

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

  // Dice roll animation: fires per new rolled event.
  const lastRollSeq = useMemo(
    () => log.filter((e: GameEvent) => e.type === 'rolled').length,
    [log],
  );
  useEffect(() => {
    if (lastRollSeq === 0) return;
    const start = setTimeout(() => setRolling(true), 0);
    const stop = setTimeout(() => setRolling(false), 800);
    return () => {
      clearTimeout(start);
      clearTimeout(stop);
    };
  }, [lastRollSeq]);

  // Production pulse: hexes whose token matches the last roll (excluding robber).
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
      <div className="flex h-screen items-center justify-center bg-[#071828] text-[#f6f8fa]">
        Loading game…
      </div>
    );
  }

  const myTurn = snap.activeSeat === mySeat;
  const sbpWindow = snap.specialBuildSeat === mySeat;
  const canAct =
    (myTurn && (snap.phase === 'turnMain' || snap.phase === 'turnPreroll')) || sbpWindow;
  const isSetupActor = (snap.phase === 'setupForward' || snap.phase === 'setupReverse') && myTurn;
  const robberPlacing = snap.phase === 'robberMove' && myTurn;

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
        setSetupVertex(vertex);
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

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#071828] text-[#f6f8fa] select-none">
      <ReconnectBanner />
      <ToastStack />
      <ProductionFloaters snap={snap} />

      {/* ============================================================ */}
      {/* 1. FULLSCREEN 3D WEBGL BOARD CANVAS                          */}
      {/* ============================================================ */}
      <div className="absolute inset-0 z-0">
        <ThreeBoard
          snap={snap}
          legalVertices={legalVertices}
          legalEdges={legalEdges}
          legalHexes={legalHexes}
          pulseHexes={pulseHexes}
          rolling={rolling}
          onVertexClick={onVertexClick}
          onEdgeClick={onEdgeClick}
          onHexClick={onHexClick}
        />
      </div>

      {/* ============================================================ */}
      {/* 2. FLOATING HUD OVERLAY                                      */}
      {/* ============================================================ */}
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-4">
        {/* TOP SECTION: Player Badges (left) & Turn Banner (center) */}
        <header className="flex items-start justify-between">
          {/* Top Left: Floating Player Badges */}
          <PlayerBadges snap={snap} />

          {/* Top Center: Sleek Turn Banner & Actions */}
          <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-sky-500/30 bg-[#031422]/90 px-5 py-2.5 shadow-2xl backdrop-blur-md">
            <span
              className="inline-block h-4 w-4 rounded-full border border-black/50 shadow"
              style={{ background: PIECE_COLORS[activePlayer.color]?.main }}
            />
            <div className="flex flex-col">
              <span className="font-[Bricolage_Grotesque,system-ui] text-sm font-bold text-white leading-tight">
                {myTurn ? 'Your Turn' : `${activePlayer.name}'s Turn`}
              </span>
              <span className="text-[10px] font-semibold text-amber-300 uppercase tracking-wide">
                {snap.phase === 'specialBuild'
                  ? `Special Build: ${snap.specialBuildSeat !== null ? snap.players[snap.specialBuildSeat]!.name : 'passing'}`
                  : snap.phase.replace(/([A-Z])/g, ' $1')}
              </span>
            </div>

            <div className="h-6 w-px bg-sky-800/80 mx-1" />

            <DiceDisplay
              die1={snap.dice?.die1 ?? null}
              die2={snap.dice?.die2 ?? null}
              rolling={rolling}
            />
            <TurnTimer />

            {myTurn && snap.phase === 'turnPreroll' ? (
              <button
                type="button"
                onClick={() => {
                  const action: GameAction = { type: 'rollDice' };
                  sendAction(action);
                }}
                className="rounded-xl bg-gradient-to-b from-amber-500 to-amber-600 px-4 py-2 text-xs font-bold text-slate-950 shadow-lg transition hover:scale-105"
                data-testid="roll-button"
              >
                🎲 Roll
              </button>
            ) : null}

            {(myTurn && snap.phase === 'turnMain') || snap.trades.some((t) => t.status === 'open') ? (
              <button
                type="button"
                onClick={() => setTradeModal(true)}
                className="rounded-xl bg-gradient-to-b from-sky-600 to-sky-700 px-3 py-2 text-xs font-bold text-white shadow-lg transition hover:scale-105"
                data-testid="open-trade"
              >
                🔁 Trade
              </button>
            ) : null}

            {myTurn && snap.phase === 'turnMain' ? (
              <button
                type="button"
                onClick={() => {
                  const action: GameAction = { type: 'endTurn' };
                  sendAction(action);
                }}
                className="rounded-xl bg-gradient-to-b from-emerald-600 to-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-lg transition hover:scale-105"
                data-testid="end-turn"
              >
                End Turn ➜
              </button>
            ) : null}

            {sbpWindow ? (
              <button
                type="button"
                onClick={() => {
                  const action: GameAction = { type: 'specialBuildDone' };
                  sendAction(action);
                }}
                className="rounded-xl bg-gradient-to-b from-red-600 to-red-700 px-3 py-2 text-xs font-bold text-white shadow-lg transition hover:scale-105"
                data-testid="sbp-done"
              >
                Pass Window
              </button>
            ) : null}
          </div>

          {/* Top Right: (Reserved for Camera controls rendered by ThreeBoard) */}
          <div className="w-32" />
        </header>

        {/* MIDDLE CONTEXTUAL PROMPT (when placing) */}
        {isSetupActor || placement !== null || robberPlacing ? (
          <div className="pointer-events-none flex justify-center">
            <div className="rounded-2xl border border-amber-400/50 bg-[#04182a]/95 px-6 py-2.5 text-xs font-bold text-amber-200 shadow-2xl backdrop-blur-md animate-pulse">
              {isSetupActor
                ? setupVertex === null
                  ? '✨ Click a glowing golden beacon on the 3D board to place your settlement'
                  : '✨ Now click a glowing golden road to connect your settlement'
                : placement?.kind === 'road'
                  ? '✨ Click a glowing edge on the 3D board to place your road'
                  : placement?.kind === 'settlement'
                    ? '✨ Click a glowing beacon on the 3D board to place your settlement'
                    : placement?.kind === 'city'
                      ? '✨ Click an existing settlement on the 3D board to upgrade to city'
                      : robberPlacing
                        ? '⚔️ Click a highlighted hex to move the robber'
                        : null}
            </div>
          </div>
        ) : <div />}

        {/* BOTTOM SECTION: Card Hand & Build Dock (center) & Event Log (right) */}
        <footer className="flex items-end justify-between">
          <div className="w-24" />

          {/* Bottom Center: Resource Cards Hand & Attached Build Bar */}
          <CardHandTray
            canAct={canAct}
            legal={legal}
            onArm={(kind) => {
              setPlacement(placement?.kind === kind ? null : { kind });
            }}
          />

          {/* Bottom Right: Collapsible Event Log */}
          <CollapsibleLog />
        </footer>
      </div>

      {/* ============================================================ */}
      {/* 3. MODALS & OVERLAYS                                         */}
      {/* ============================================================ */}
      {showTradeModal ? <TradeModal mySeat={mySeat} /> : null}
      <DiscardModal mySeat={mySeat} />
      <VictimPicker mySeat={mySeat} />
      <VictoryOverlay />
    </div>
  );
}
