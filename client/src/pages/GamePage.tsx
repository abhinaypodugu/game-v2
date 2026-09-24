// Game page: mobile-first colonist-style layout around the 2D SVG board.
//
// Phone portrait (top → bottom, all in document flow so nothing overlaps):
//   1. Player strip (horizontal scroll, one chip per seat)
//   2. Turn/status line (whose turn, instruction prompt, dice)
//   3. Open trade offer banner (only while an offer is open)
//   4. Board region (pinch/pan/zoom) with the corner toolbar floating top-left
//   5. Bottom dock: my hand + dev cards, then the action bar
// The log / bank / player-details panel is a slide-up sheet on phones and a
// permanent right sidebar on ≥1024px.

import { useMemo, useState } from 'react';
import type { DevCardType, GameAction } from '@catan/shared';
import { legalRobberHexes } from '@catan/shared';
import { Board2D } from '../board/Board2D';
import { ColonistTopLeftToolbar } from '../components/ColonistTopLeftToolbar';
import { ColonistTradeBanner } from '../components/ColonistTradeBanner';
import { ColonistRightSidebar } from '../components/ColonistRightSidebar';
import { ColonistBottomDock } from '../components/ColonistBottomDock';
import { DiscardModal, VictimPicker } from '../components/RobberFlow';
import { OfflineHostBanner, ReconnectBanner, ToastStack } from '../components/Overlays';
import { TradeModal } from '../components/TradeModal';
import { VictoryOverlay } from '../components/VictoryOverlay';
import { DevCardConfirmModal, MonopolyModal, YearOfPlentyModal } from '../components/DevCardModals';
import { FlyingCards } from '../components/FlyingCards';
import { PlayerStrip } from '../components/PlayerStrip';
import { TurnStatusBar, type StatusPrompt } from '../components/TurnStatusBar';
import { useGameSounds } from '../hooks/useGameSounds';
import { useLegalMoves } from '../hooks/useLegalMoves';
import { useStore, type PlacementMode } from '../store';
import type { GameEvent, PersonalSnapshot } from '../types';

export function GamePage(): React.JSX.Element {
  const snap = useStore((s) => s.game);
  useGameSounds();
  if (snap === null) {
    return (
      <div className="fixed inset-0 flex h-[100dvh] items-center justify-center bg-ocean font-display text-xl font-bold text-white">
        Loading game…
      </div>
    );
  }
  return <GameScreen snap={snap} />;
}

interface RoadBuildingState {
  cardId: string;
  /** Turn the card was played on — the selection dies with the turn. */
  turn: number;
  edges: string[];
}

function statusPrompt(
  snap: PersonalSnapshot,
  mySeat: number,
  armed: PlacementMode | null,
  setupVertex: number | null,
  roadBuilding: RoadBuildingState | null,
): StatusPrompt {
  const myTurn = snap.activeSeat === mySeat;
  const active = snap.players[snap.activeSeat]?.name ?? 'Someone';
  switch (snap.phase) {
    case 'finished': {
      const w = snap.winner !== null ? snap.players[snap.winner]?.name : undefined;
      return { text: w !== undefined ? `${w} won the game!` : 'Game over', tone: 'wait' };
    }
    case 'setupForward':
    case 'setupReverse':
      if (!myTurn) return { text: `${active} is placing a settlement and road`, tone: 'wait' };
      return setupVertex === null
        ? { text: `Place your ${snap.phase === 'setupReverse' ? 'second ' : ''}settlement`, tone: 'action' }
        : { text: 'Now place a road next to it (or tap another spot)', tone: 'action' };
    case 'turnPreroll':
      return myTurn ? { text: 'Roll the dice', tone: 'action' } : { text: `${active} is rolling…`, tone: 'wait' };
    case 'discard': {
      const mine = snap.pendingDiscards.find((d) => d.seat === mySeat && !d.received);
      return mine !== undefined
        ? { text: `Discard ${mine.count} cards`, tone: 'action' }
        : { text: 'Waiting for players to discard…', tone: 'wait' };
    }
    case 'robberMove':
      return myTurn ? { text: 'Move the robber to a new tile', tone: 'action' } : { text: `${active} is moving the robber`, tone: 'wait' };
    case 'robberSteal':
      return myTurn ? { text: 'Choose a player to steal from', tone: 'action' } : { text: `${active} is stealing a card`, tone: 'wait' };
    case 'specialBuild': {
      if (snap.specialBuildSeat === mySeat) {
        if (armed !== null) break;
        return { text: 'Special build: build now or tap Done', tone: 'action' };
      }
      const who = snap.specialBuildSeat !== null ? snap.players[snap.specialBuildSeat]?.name : undefined;
      return { text: `${who ?? 'Someone'} may special-build`, tone: 'wait' };
    }
    case 'turnMain':
      if (!myTurn) return { text: `${active} is building and trading`, tone: 'wait' };
      if (roadBuilding !== null) {
        return { text: `Road Building: place free road ${roadBuilding.edges.length + 1} of 2`, tone: 'action' };
      }
      if (armed === null) return { text: 'Build, trade, or end your turn', tone: 'action' };
      break;
  }
  if (armed?.kind === 'road') return { text: 'Place a road', tone: 'action' };
  if (armed?.kind === 'settlement') return { text: 'Place a settlement', tone: 'action' };
  if (armed?.kind === 'city') return { text: 'Pick a settlement to upgrade to a city', tone: 'action' };
  return { text: 'Build or trade', tone: 'action' };
}

function GameScreen({ snap }: { snap: PersonalSnapshot }): React.JSX.Element {
  const session = useStore((s) => s.session);
  const sendAction = useStore((s) => s.sendAction);
  const setPlacement = useStore((s) => s.setPlacement);
  const placement = useStore((s) => s.ui.placement);
  const showTradeModal = useStore((s) => s.ui.showTradeModal);
  const log = useStore((s) => s.log);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [setupSel, setSetupSel] = useState<{ key: string; vertex: number } | null>(null);
  const [confirmDevCard, setConfirmDevCard] = useState<{ id: string; type: DevCardType } | null>(null);
  const [devModal, setDevModal] = useState<{ type: 'monopoly' | 'yearOfPlenty'; cardId: string } | null>(null);
  const [roadBuildingSel, setRoadBuildingSel] = useState<RoadBuildingState | null>(null);
  const mySeat = session?.seatIndex ?? -1;
  const legal = useLegalMoves(snap, mySeat);

  const myTurn = snap.activeSeat === mySeat;
  const sbpWindow = snap.specialBuildSeat === mySeat;
  const canAct = (myTurn && (snap.phase === 'turnMain' || snap.phase === 'turnPreroll')) || sbpWindow;
  const isSetupActor = (snap.phase === 'setupForward' || snap.phase === 'setupReverse') && myTurn;
  const robberPlacing = snap.phase === 'robberMove' && myTurn;

  // A setup selection belongs to one (phase, active seat) step and only while
  // its vertex is still legal — e.g. after the turn timer auto-placed, a stale
  // pick must not keep highlighting roads for an already-built vertex.
  const setupKey = `${snap.phase}:${snap.activeSeat}`;
  const setupVertex =
    isSetupActor && setupSel !== null && setupSel.key === setupKey && legal.setupVertices.has(setupSel.vertex)
      ? setupSel.vertex
      : null;
  const roadBuilding =
    roadBuildingSel !== null && roadBuildingSel.turn === snap.turn && myTurn && snap.phase === 'turnMain'
      ? roadBuildingSel
      : null;
  const armed = canAct && roadBuilding === null ? placement : null;

  const rollKey = useMemo(() => log.filter((e: GameEvent) => e.type === 'rolled').length, [log]);

  // Production pulse: hexes whose token matches the last roll (excluding robber).
  const pulseHexes = useMemo(() => {
    const rolledIdx = log.map((e: GameEvent) => e.type === 'rolled').lastIndexOf(true);
    if (rolledIdx === -1) return new Set<string>();
    const roll = log[rolledIdx] as Extract<GameEvent, { type: 'rolled' }>;
    const sum = roll.die1 + roll.die2;
    const hexes = new Set<string>();
    for (const [hex, data] of Object.entries(snap.board.hexes)) {
      if (data.token === sum && hex !== snap.robber) hexes.add(hex);
    }
    return hexes;
  }, [log, snap.board.hexes, snap.robber]);

  const legalVertices =
    roadBuilding !== null
      ? undefined
      : armed?.kind === 'settlement'
        ? legal.settlementVertices
        : armed?.kind === 'city'
          ? legal.cityVertices
          : isSetupActor
            ? legal.setupVertices
            : undefined;

  const legalEdges = useMemo(() => {
    if (roadBuilding !== null) return legal.freeRoadEdges(roadBuilding.edges);
    if (armed?.kind === 'road') return legal.roadEdges;
    if (setupVertex !== null) return new Set(legal.setupRoadsForVertex(setupVertex));
    return undefined;
  }, [legal, roadBuilding, armed?.kind, setupVertex]);

  const legalHexes = useMemo(
    () => (robberPlacing ? new Set(legalRobberHexes(snap as never)) : undefined),
    [robberPlacing, snap],
  );

  const onVertexClick = (vertex: number): void => {
    if (isSetupActor) {
      if (!legal.setupVertices.has(vertex)) return;
      setSetupSel(setupVertex === vertex ? null : { key: setupKey, vertex });
      return;
    }
    if (armed?.kind === 'settlement' && legal.settlementVertices.has(vertex)) {
      const action: GameAction = { type: 'buildSettlement', vertex };
      sendAction(action);
      setPlacement(null);
    } else if (armed?.kind === 'city' && legal.cityVertices.has(vertex)) {
      const action: GameAction = { type: 'buildCity', vertex };
      sendAction(action);
      setPlacement(null);
    }
  };

  const onEdgeClick = (edge: string): void => {
    if (roadBuilding !== null) {
      if (legalEdges === undefined || !legalEdges.has(edge)) return;
      if (roadBuilding.edges.length === 0) {
        // Only one road possible (last road piece or no connected spot left): place it now.
        if (legal.freeRoadEdges([edge]).size === 0) {
          sendAction({ type: 'playDevCard', cardId: roadBuilding.cardId, payload: { edges: [edge] } });
          setRoadBuildingSel(null);
        } else {
          setRoadBuildingSel({ ...roadBuilding, edges: [edge] });
        }
      } else {
        sendAction({ type: 'playDevCard', cardId: roadBuilding.cardId, payload: { edges: [roadBuilding.edges[0]!, edge] } });
        setRoadBuildingSel(null);
      }
      return;
    }
    if (setupVertex !== null) {
      if (!legal.setupRoadsForVertex(setupVertex).includes(edge)) return;
      const action: GameAction = { type: 'setupPlace', settlementVertex: setupVertex, roadEdge: edge };
      sendAction(action);
      setSetupSel(null);
      return;
    }
    if (armed?.kind === 'road' && legal.roadEdges.has(edge)) {
      const action: GameAction = { type: 'buildRoad', edge };
      sendAction(action);
      setPlacement(null);
    }
  };

  const onHexClick = (hex: string): void => {
    if (robberPlacing && legalHexes?.has(hex) === true) {
      const action: GameAction = { type: 'moveRobber', hex };
      sendAction(action);
    }
  };

  const cancelable = armed !== null || roadBuilding !== null || setupVertex !== null;
  const prompt = statusPrompt(snap, mySeat, armed, setupVertex, roadBuilding);
  const myColor = snap.players[mySeat]?.color;

  return (
    <div
      className="fixed inset-0 flex h-[100dvh] w-full overflow-hidden bg-ocean pt-[var(--safe-top)] pr-[var(--safe-right)] pb-[var(--safe-bottom)] pl-[var(--safe-left)] text-ink select-none lg:gap-3 lg:p-3"
      data-testid="game-page"
    >
      <ReconnectBanner />
      <ToastStack />

      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="relative z-20 mx-auto flex w-full max-w-3xl flex-col gap-1 px-2 pt-1 lg:px-0 lg:pt-0">
          <PlayerStrip snap={snap} />
          <TurnStatusBar
            snap={snap}
            prompt={prompt}
            rollKey={rollKey}
            onCancel={
              cancelable
                ? () => {
                    setPlacement(null);
                    setRoadBuildingSel(null);
                    setSetupSel(null);
                  }
                : undefined
            }
          />
          <ColonistTradeBanner snap={snap} />
          <OfflineHostBanner repair />
        </header>

        <main className="relative min-h-0 flex-1" data-testid="board-region">
          <div className="absolute inset-0">
            <Board2D
              snap={snap}
              legalVertices={legalVertices}
              legalEdges={legalEdges}
              legalHexes={legalHexes}
              pulseHexes={pulseHexes}
              previewBuilding={setupVertex !== null && myColor !== undefined ? { vertex: setupVertex, color: myColor } : undefined}
              onVertexClick={onVertexClick}
              onEdgeClick={onEdgeClick}
              onHexClick={onHexClick}
              fitInsetClassName="pt-14 pb-14 lg:py-2 lg:px-16"
              controlsClassName="bottom-2 right-2 flex-row lg:flex-col lg:bottom-auto lg:top-1/2 lg:-translate-y-1/2"
            />
          </div>
          <div className="scrollbar-none pointer-events-none absolute top-2 left-2 z-10 max-h-[calc(100%-1rem)] overflow-y-auto">
            <ColonistTopLeftToolbar snap={snap} detailsOpen={detailsOpen} onToggleDetails={() => setDetailsOpen((o) => !o)} />
          </div>
        </main>

        <footer className="relative z-20 mx-auto w-full max-w-3xl px-2 pb-2 lg:px-0 lg:pb-0">
          <ColonistBottomDock
            snap={snap}
            legal={legal}
            canAct={canAct && roadBuilding === null}
            placement={armed}
            onArm={(kind) => setPlacement(armed?.kind === kind ? null : { kind })}
            onPlayDevCard={(card) => {
              setConfirmDevCard(card as { id: string; type: DevCardType });
            }}
          />
        </footer>
      </div>

      <ColonistRightSidebar snap={snap} open={detailsOpen} onClose={() => setDetailsOpen(false)} />

      <FlyingCards />

      {showTradeModal ? <TradeModal mySeat={mySeat} /> : null}
      <DiscardModal mySeat={mySeat} />
      <VictimPicker mySeat={mySeat} />
      <VictoryOverlay />
      {confirmDevCard !== null ? (
        <DevCardConfirmModal
          card={confirmDevCard}
          onClose={() => setConfirmDevCard(null)}
          onConfirm={() => {
            const card = confirmDevCard;
            setConfirmDevCard(null);
            if (card.type === 'knight') {
              sendAction({ type: 'playDevCard', cardId: card.id });
            } else if (card.type === 'monopoly' || card.type === 'yearOfPlenty') {
              setDevModal({ type: card.type, cardId: card.id });
            } else if (card.type === 'roadBuilding') {
              setPlacement(null);
              setRoadBuildingSel({ cardId: card.id, turn: snap.turn, edges: [] });
            }
          }}
        />
      ) : null}
      {devModal?.type === 'monopoly' ? <MonopolyModal cardId={devModal.cardId} onClose={() => setDevModal(null)} /> : null}
      {devModal?.type === 'yearOfPlenty' ? (
        <YearOfPlentyModal cardId={devModal.cardId} onClose={() => setDevModal(null)} />
      ) : null}
    </div>
  );
}
