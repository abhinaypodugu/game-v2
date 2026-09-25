// Victory overlay: winner celebration, full player rankings & holdings leaderboard,
// dice roll distribution histogram, resource analytics, and board inspection toggle.

import { useEffect, useMemo, useState } from 'react';
import confetti from 'canvas-confetti';
import { RESOURCES, type DevCardType, type GameEvent, type Resource } from '@catan/shared';
import { useStore } from '../store';
import { Avatar } from './PlayerStrip';
import { DEV_META, RESOURCE_META, ResourceCard } from './resourceArt';

const THEORETICAL_PROBS: Record<number, number> = {
  2: 1 / 36,
  3: 2 / 36,
  4: 3 / 36,
  5: 4 / 36,
  6: 5 / 36,
  7: 6 / 36,
  8: 5 / 36,
  9: 4 / 36,
  10: 3 / 36,
  11: 2 / 36,
  12: 1 / 36,
};

const RESOURCE_ICONS: Record<Resource, string> = {
  wood: '🌲',
  brick: '🧱',
  sheep: '🐑',
  wheat: '🌾',
  ore: '🪨',
};

export function VictoryOverlay(): React.JSX.Element | null {
  const snap = useStore((s) => s.game);
  const log = useStore((s) => s.log);
  const clearSession = useStore((s) => s.clearSession);
  const leaveRoom = useStore((s) => s.leaveRoom);

  const [activeTab, setActiveTab] = useState<'leaderboard' | 'dice' | 'stats'>('leaderboard');
  const [minimized, setMinimized] = useState(false);

  const winner = snap?.winner ?? null;

  useEffect(() => {
    if (winner === null) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    void confetti({
      particleCount: 200,
      spread: 120,
      origin: { y: 0.55 },
      colors: ['#f5a524', '#2fb344', '#4cb3e6', '#d7263d', '#ffffff', '#eab308'],
      disableForReducedMotion: true,
    });
  }, [winner]);

  // Dice roll statistics
  const diceStats = useMemo(() => {
    const counts: Record<number, number> = {};
    for (let i = 2; i <= 12; i++) counts[i] = 0;
    let totalRolls = 0;

    for (const e of log) {
      if (e.type === 'rolled') {
        const sum = e.die1 + e.die2;
        counts[sum] = (counts[sum] ?? 0) + 1;
        totalRolls++;
      }
    }

    let maxRoll = 7;
    let maxCount = -1;
    let minRoll = 7;
    let minCount = Infinity;

    for (let i = 2; i <= 12; i++) {
      const c = counts[i] ?? 0;
      if (c > maxCount) {
        maxCount = c;
        maxRoll = i;
      }
      if (c < minCount) {
        minCount = c;
        minRoll = i;
      }
    }

    return { counts, totalRolls, maxRoll, maxCount, minRoll, minCount };
  }, [log]);

  // Production and economy statistics
  const economyStats = useMemo(() => {
    const resTotals: Record<Resource, number> = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 };
    let totalProduced = 0;
    let playerTrades = 0;
    let bankTrades = 0;
    let cardsStolen = 0;
    let cardsDiscarded = 0;

    for (const e of log) {
      if (e.type === 'produced') {
        resTotals[e.resource] = (resTotals[e.resource] ?? 0) + e.amount;
        totalProduced += e.amount;
      } else if (e.type === 'tradeCompleted') {
        playerTrades++;
      } else if (e.type === 'bankTraded') {
        bankTrades++;
      } else if (e.type === 'stolenFrom') {
        cardsStolen++;
      } else if (e.type === 'discarded') {
        const count = Object.values(e.resources).reduce((s: number, n) => s + (n ?? 0), 0);
        cardsDiscarded += count;
      }
    }

    let topResource: Resource = 'wheat';
    let topAmount = -1;
    for (const r of RESOURCES) {
      if (resTotals[r] > topAmount) {
        topAmount = resTotals[r];
        topResource = r;
      }
    }

    return { resTotals, totalProduced, playerTrades, bankTrades, cardsStolen, cardsDiscarded, topResource };
  }, [log]);

  // Leaderboard ranking of players
  const leaderboard = useMemo(() => {
    if (!snap) return [];
    return snap.players
      .map((p) => {
        const isYou = p.seat === snap.you.seat;
        const totalVp = p.totalVp ?? (isYou ? snap.you.totalVp : p.publicVp);
        const buildings = Object.values(snap.buildings).filter((b) => b.seat === p.seat);
        const settlements = buildings.filter((b) => b.type === 'settlement').length;
        const cities = buildings.filter((b) => b.type === 'city').length;
        const roads = 15 - p.roadsLeft;
        const hasLongestRoad = snap.longestRoad.holder === p.seat;
        const hasLargestArmy = snap.largestArmy.holder === p.seat;
        const isWinner = p.seat === snap.winner;

        const vpCards = isYou
          ? snap.you.devHand.filter((c) => c.type === 'victoryPoint').length
          : (p.devCards?.filter((c) => c.type === 'victoryPoint').length ?? 0);

        const devCards = isYou ? snap.you.devHand : (p.devCards ?? []);
        const resources = isYou ? snap.you.resources : p.resources;

        return {
          ...p,
          totalVp,
          settlements,
          cities,
          roads,
          hasLongestRoad,
          hasLargestArmy,
          isWinner,
          vpCards,
          devCards,
          resources,
        };
      })
      .sort((a, b) => {
        if (a.isWinner) return -1;
        if (b.isWinner) return 1;
        if (b.totalVp !== a.totalVp) return b.totalVp - a.totalVp;
        return b.resourceCount - a.resourceCount;
      });
  }, [snap]);

  if (snap === null || winner === null) return null;
  const winnerPlayer = snap.players[winner]!;

  if (minimized) {
    return (
      <div className="fixed bottom-4 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-3 rounded-full border-2 border-line bg-cream px-4 py-2 shadow-2xl">
        <span className="font-bold text-sm text-ink">👑 {winnerPlayer.name} won!</span>
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className="rounded-full bg-cta px-3 py-1 text-xs font-bold text-ink shadow-[0_2px_0_#a86d08] active:translate-y-px"
        >
          📊 Show Leaderboard & Stats
        </button>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/65 p-3 backdrop-blur-xs"
      data-testid="victory-overlay"
    >
      <div className="animate-pop-in relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border-2 border-line bg-cream text-ink shadow-2xl">
        {/* Header / Winner spotlight */}
        <div className="relative border-b-2 border-line bg-linear-to-b from-[#fff7d6] to-cream px-5 pt-5 pb-4 text-center">
          <button
            type="button"
            onClick={() => setMinimized(true)}
            className="absolute top-3 right-3 flex h-10 w-10 items-center justify-center rounded-full border-2 border-line bg-white text-sm font-bold shadow-xs active:translate-y-px"
            title="Inspect final board"
            aria-label="Inspect board"
          >
            👁️
          </button>

          <div className="mb-2 flex justify-center">
            <div className="relative">
              <Avatar name={winnerPlayer.name} color={winnerPlayer.color} size="md" />
              <span className="absolute -top-3.5 -right-2 text-2xl">👑</span>
            </div>
          </div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">{winnerPlayer.name} wins!</h1>
          <p className="mt-0.5 text-xs font-semibold text-ink-soft sm:text-sm">
            {snap.you.seat === winner ? '🎉 Congratulations on your victory!' : 'Well played! Better luck next match.'}{' '}
            · Goal: {snap.rules.victoryPointsToWin} VP
          </p>

          {/* Navigation tabs */}
          <div className="mt-4 flex rounded-xl border-2 border-line bg-white/70 p-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('leaderboard')}
              className={`flex-1 rounded-lg py-1.5 transition-all ${
                activeTab === 'leaderboard' ? 'bg-cta text-ink shadow-xs' : 'text-ink-soft hover:text-ink'
              }`}
            >
              🏆 Leaderboard
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('dice')}
              className={`flex-1 rounded-lg py-1.5 transition-all ${
                activeTab === 'dice' ? 'bg-cta text-ink shadow-xs' : 'text-ink-soft hover:text-ink'
              }`}
            >
              🎲 Dice Rolls ({diceStats.totalRolls})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('stats')}
              className={`flex-1 rounded-lg py-1.5 transition-all ${
                activeTab === 'stats' ? 'bg-cta text-ink shadow-xs' : 'text-ink-soft hover:text-ink'
              }`}
            >
              📊 Island Stats
            </button>
          </div>
        </div>

        {/* Scrollable content section */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* TAB 1: LEADERBOARD */}
          {activeTab === 'leaderboard' ? (
            <div className="flex flex-col gap-3" data-testid="vp-breakdown">
              {leaderboard.map((p, idx) => {
                const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
                const isYou = p.seat === snap.you.seat;

                return (
                  <div
                    key={p.seat}
                    className={`flex flex-col gap-2 rounded-2xl border-2 p-3 shadow-xs ${
                      p.isWinner ? 'border-amber-400 bg-[#fffbf0]' : 'border-line bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 text-center font-display text-base font-bold text-ink-soft">{medal}</span>
                      <Avatar name={p.name} color={p.color} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-ink truncate">{p.name}</span>
                          {isYou ? (
                            <span className="rounded-full bg-cta/20 px-1.5 py-0.2 text-[9px] font-bold text-ink">You</span>
                          ) : null}
                          {p.isWinner ? (
                            <span className="rounded-full bg-amber-400 px-1.5 py-0.2 text-[9px] font-bold text-ink">Winner</span>
                          ) : null}
                        </div>
                        <div className="text-[10px] font-semibold text-ink-soft">
                          {p.roads} roads built · {p.playedKnights} knights played
                        </div>
                      </div>
                      <div className="flex flex-col items-center justify-center rounded-xl bg-parchment px-2.5 py-1">
                        <span className="font-display text-lg font-bold text-ink">{p.totalVp}</span>
                        <span className="text-[8px] uppercase font-bold text-ink-soft">Points</span>
                      </div>
                    </div>

                    {/* VP breakdown pills */}
                    <div className="flex flex-wrap gap-1 text-[11px] font-bold">
                      <span className="rounded-md bg-parchment px-2 py-0.5" title={`${p.settlements} settlements built`}>
                        🏠 Settlements: <b>{p.settlements}</b> ({p.settlements} VP)
                      </span>
                      <span className="rounded-md bg-parchment px-2 py-0.5" title={`${p.cities} cities built`}>
                        🏰 Cities: <b>{p.cities}</b> ({p.cities * 2} VP)
                      </span>
                      {p.hasLongestRoad ? (
                        <span className="rounded-md bg-[#fde7b0] px-2 py-0.5 text-[#7a5200]">
                          🛣️ Longest Road (+2 VP)
                        </span>
                      ) : null}
                      {p.hasLargestArmy ? (
                        <span className="rounded-md bg-[#fcd5d5] px-2 py-0.5 text-[#8a1424]">
                          ⚔️ Largest Army (+2 VP)
                        </span>
                      ) : null}
                      {p.vpCards > 0 ? (
                        <span className="rounded-md bg-[#e6ddfa] px-2 py-0.5 text-[#4a268a]">
                          🏛️ {p.vpCards} VP Card{p.vpCards > 1 ? 's' : ''} (+{p.vpCards} VP)
                        </span>
                      ) : null}
                    </div>

                    {/* What this player has: Dev Cards & Final Hand */}
                    <div className="mt-1 flex flex-col gap-1 border-t border-line/60 pt-2 text-[11px]">
                      {p.devCards && p.devCards.length > 0 ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-ink-soft text-[10px] uppercase">Dev Cards:</span>
                          {p.devCards.map((c, i) => {
                            const meta = DEV_META[c.type as DevCardType] ?? { icon: '🎴', label: c.type };
                            return (
                              <span
                                key={c.id ?? i}
                                className="inline-flex items-center gap-1 rounded-md border border-line bg-parchment px-1.5 py-0.5 text-[10px] font-bold"
                                title={`${meta.label} (${c.played ? 'Played' : 'Unplayed in hand'})`}
                              >
                                <span>{meta.icon}</span>
                                <span>{meta.label}</span>
                                {c.played ? <span className="text-[8px] text-ink-soft opacity-70">✓</span> : null}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-[10px] text-ink-soft">No development cards</span>
                      )}

                      {/* Final Resources in Hand */}
                      {p.resources ? (
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="font-bold text-ink-soft text-[10px] uppercase">Hand ({p.resourceCount}):</span>
                          {RESOURCES.map((r) => {
                            const count = p.resources?.[r] ?? 0;
                            if (count === 0) return null;
                            return (
                              <span
                                key={r}
                                className="inline-flex items-center gap-1 rounded-md bg-white border border-line px-1.5 py-0.5 text-[10px] font-bold"
                              >
                                <span>{RESOURCE_ICONS[r]}</span>
                                <span>{count}</span>
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-[10px] text-ink-soft">
                          Resource cards left: <b>{p.resourceCount}</b>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {/* TAB 2: DICE STATISTICS */}
          {activeTab === 'dice' ? (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-xl border-2 border-line bg-white p-2">
                  <div className="text-[10px] font-bold uppercase text-ink-soft">Total Rolls</div>
                  <div className="font-display text-lg font-bold text-ink">{diceStats.totalRolls}</div>
                </div>
                <div className="rounded-xl border-2 border-line bg-white p-2">
                  <div className="text-[10px] font-bold uppercase text-ink-soft">Hottest Roll 🔥</div>
                  <div className="font-display text-lg font-bold text-cta">
                    {diceStats.maxRoll} ({diceStats.maxCount}×)
                  </div>
                </div>
                <div className="rounded-xl border-2 border-line bg-white p-2">
                  <div className="text-[10px] font-bold uppercase text-ink-soft">Coldest Roll ❄️</div>
                  <div className="font-display text-lg font-bold text-ocean">
                    {diceStats.minRoll} ({diceStats.minCount}×)
                  </div>
                </div>
              </div>

              {/* Histogram bars */}
              <div className="rounded-2xl border-2 border-line bg-white p-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-ink-soft mb-2.5">
                  Roll Distribution (2 to 12)
                </h4>
                <div className="flex flex-col gap-1.5 text-xs">
                  {Array.from({ length: 11 }, (_, i) => i + 2).map((roll) => {
                    const count = diceStats.counts[roll] ?? 0;
                    const pct = diceStats.totalRolls > 0 ? (count / diceStats.totalRolls) * 100 : 0;
                    const isSeven = roll === 7;
                    const isHot = roll === diceStats.maxRoll && count > 0;

                    return (
                      <div key={roll} className="flex items-center gap-2">
                        <span
                          className={`w-6 text-right font-display text-xs font-bold ${
                            isSeven ? 'text-[#d7263d]' : isHot ? 'text-cta' : 'text-ink'
                          }`}
                        >
                          {roll}
                        </span>
                        <div className="relative flex-1 h-5 rounded-md bg-parchment overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${
                              isSeven ? 'bg-[#d7263d]' : isHot ? 'bg-cta' : 'bg-[#4cb3e6]'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(pct > 0 ? 4 : 0, pct * 2.2))}%` }}
                          />
                        </div>
                        <div className="w-16 text-right font-bold text-[11px] tabular-nums">
                          <span>{count}×</span>{' '}
                          <span className="text-[9px] text-ink-soft">({pct.toFixed(0)}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-3 text-[10px] text-center text-ink-soft">
                  Red = 7 (Robber activation). Amber = most frequent roll.
                </p>
              </div>
            </div>
          ) : null}

          {/* TAB 3: ISLAND ECONOMY & STATS */}
          {activeTab === 'stats' ? (
            <div className="flex flex-col gap-3">
              <div className="rounded-2xl border-2 border-line bg-white p-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-ink-soft mb-2">
                  Total Resource Harvest ({economyStats.totalProduced} cards)
                </h4>
                <div className="grid grid-cols-5 gap-1.5 text-center">
                  {RESOURCES.map((r) => {
                    const amount = economyStats.resTotals[r];
                    const isTop = r === economyStats.topResource;
                    return (
                      <div
                        key={r}
                        className={`flex flex-col items-center rounded-xl p-2 border ${
                          isTop ? 'border-cta bg-[#fff8e6]' : 'border-line bg-parchment'
                        }`}
                      >
                        <span className="text-2xl">{RESOURCE_ICONS[r]}</span>
                        <span className="font-display text-base font-bold text-ink mt-0.5">{amount}</span>
                        <span className="text-[9px] font-bold uppercase text-ink-soft">{RESOURCE_META[r].label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-2xl border-2 border-line bg-white p-3">
                  <div className="text-[10px] font-bold uppercase text-ink-soft">Player Trades</div>
                  <div className="font-display text-xl font-bold text-ink mt-0.5">{economyStats.playerTrades}</div>
                  <div className="text-[10px] text-ink-soft">between players</div>
                </div>
                <div className="rounded-2xl border-2 border-line bg-white p-3">
                  <div className="text-[10px] font-bold uppercase text-ink-soft">Bank / Port Trades</div>
                  <div className="font-display text-xl font-bold text-ink mt-0.5">{economyStats.bankTrades}</div>
                  <div className="text-[10px] text-ink-soft">exchanges with bank</div>
                </div>
                <div className="rounded-2xl border-2 border-line bg-white p-3">
                  <div className="text-[10px] font-bold uppercase text-ink-soft">Cards Stolen</div>
                  <div className="font-display text-xl font-bold text-ink mt-0.5">{economyStats.cardsStolen}</div>
                  <div className="text-[10px] text-ink-soft">via robber attacks</div>
                </div>
                <div className="rounded-2xl border-2 border-line bg-white p-3">
                  <div className="text-[10px] font-bold uppercase text-ink-soft">Cards Lost to 7s</div>
                  <div className="font-display text-xl font-bold text-ink mt-0.5">{economyStats.cardsDiscarded}</div>
                  <div className="text-[10px] text-ink-soft">discarded on 7 rolls</div>
                </div>
              </div>

              <div className="rounded-2xl border-2 border-line bg-white p-3 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-line/60">
                  <span className="font-bold text-ink-soft">Total Turns Played:</span>
                  <span className="font-bold text-ink">{snap.turn} turns</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-line/60">
                  <span className="font-bold text-ink-soft">Longest Road:</span>
                  <span className="font-bold text-ink">
                    {snap.longestRoad.holder !== null
                      ? `${snap.players[snap.longestRoad.holder]?.name} (${snap.longestRoad.length} segments)`
                      : 'None'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="font-bold text-ink-soft">Largest Army:</span>
                  <span className="font-bold text-ink">
                    {snap.largestArmy.holder !== null
                      ? `${snap.players[snap.largestArmy.holder]?.name} (${snap.largestArmy.knights} knights)`
                      : 'None'}
                  </span>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer actions */}
        <div className="border-t-2 border-line bg-cream p-4 flex gap-2">
          <button
            type="button"
            onClick={() => setMinimized(true)}
            className="flex-1 h-12 rounded-2xl border-2 border-line bg-white px-3 font-display text-sm font-bold text-ink shadow-[0_2px_0_#d9cfb8] active:translate-y-px"
          >
            👁️ Inspect Board
          </button>
          <button
            type="button"
            onClick={() => {
              clearSession();
              leaveRoom();
            }}
            className="flex-1 h-12 rounded-2xl bg-cta px-3 font-display text-sm font-bold text-ink shadow-[0_3px_0_#a86d08] active:translate-y-px"
            data-testid="return-lobby"
          >
            🏠 Return to Home
          </button>
        </div>
      </div>
    </div>
  );
}
