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
import { ColonistTopLeftToolbar } from '../components/ColonistTopLeftToolbar';
import { ColonistTradeBanner } from '../components/ColonistTradeBanner';
import { ColonistRightSidebar } from '../components/ColonistRightSidebar';
import { ColonistBottomDock } from '../components/ColonistBottomDock';
import { DiscardModal, VictimPicker } from '../components/RobberFlow';
import { ReconnectBanner, ToastStack } from '../components/Overlays';
import { TradeModal } from '../components/TradeModal';
import { VictoryOverlay } from '../components/VictoryOverlay';
import { ProductionFloaters } from '../components/ProductionFloaters';
import { useLegalMoves } from '../hooks/useLegalMoves';
import { useStore } from '../store';
import type { GameEvent } from '../types';
export function GamePage(): React.JSX.Element {
  const snap = useStore((s) => s.game);
  const session = useStore((s) => s.session);
  const sendAction = useStore((s) => s.sendAction);
  const setPlacement = useStore((s) => s.setPlacement);
  const placement = useStore((s) => s.ui.placement);
  const showTradeModal = useStore((s) => s.ui.showTradeModal);
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
      {/* 2. COLONIST.IO HUD OVERLAYS                                  */}
      {/* ============================================================ */}
      {/* Top Left: Circular Utility Toolbar (Settings, Rules, Fullscreen, Info) */}
      <ColonistTopLeftToolbar snap={snap} />

      {/* Top Center: Trade Offer & Turn Status Banner */}
      <div className="pointer-events-none fixed top-3 left-0 right-0 z-20 flex justify-center px-4">
        <ColonistTradeBanner snap={snap} rolling={rolling} />
      </div>

      {/* Right Sidebar: Game Log, Bank Cards Bar, and Player Roster */}
      <ColonistRightSidebar snap={snap} />

      {/* Middle Contextual Prompt Banner (when placing road / settlement / city / robber) */}
      {isSetupActor || placement !== null || robberPlacing ? (
        <div className="pointer-events-none fixed top-16 left-0 right-0 z-20 flex justify-center px-4">
          <div className="rounded-2xl border border-amber-400/60 bg-[#04182a]/95 px-6 py-2 text-xs font-bold text-amber-200 shadow-2xl backdrop-blur-md animate-pulse">
            {isSetupActor
              ? setupVertex === null
                ? '✨ Click a valid circle on the board to place your settlement'
                : '✨ Now click a valid path to connect your road'
              : placement?.kind === 'road'
                ? '✨ Click a valid path on the board to place your road'
                : placement?.kind === 'settlement'
                  ? '✨ Click a valid circle on the board to place your settlement'
                  : placement?.kind === 'city'
                    ? '✨ Click an existing settlement on the board to upgrade to city'
                    : robberPlacing
                      ? '⚔️ Click an occupied hex to move the robber'
                      : null}
          </div>
        </div>
      ) : null}

      {/* Bottom Dock: My Resource Hand (left) & Build Action Bar (right) */}
      <ColonistBottomDock
        snap={snap}
        legal={legal}
        canAct={canAct}
        placement={placement}
        onArm={(kind) => {
          setPlacement(placement?.kind === kind ? null : { kind });
        }}
        rolling={rolling}
      />
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
