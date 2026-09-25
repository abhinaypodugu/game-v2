import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useStore } from '../store';
import { ColonistRightSidebar } from '../components/ColonistRightSidebar';
import { TradeModal } from '../components/TradeModal';
import { ColonistTopLeftToolbar } from '../components/ColonistTopLeftToolbar';
import type { PersonalSnapshot, RoomState } from '../types';
import { DEFAULT_RULES, boardConfigForPlayers, generateBoard } from '@catan/shared';

function makeSnapshot(hideBankCardsCount: boolean): PersonalSnapshot {
  const board = generateBoard(4, 'test-seed');
  return {
    version: 1,
    config: 'base',
    playerCount: 4,
    rules: { ...DEFAULT_RULES, hideBankCardsCount },
    phase: 'turnMain',
    activeSeat: 0,
    specialBuildSeat: null,
    turn: 2,
    dice: { die1: 3, die2: 4 },
    board,
    buildings: {},
    roads: {},
    robber: board.robberHex,
    bank: hideBankCardsCount
      ? { wood: -1, brick: -1, sheep: -1, wheat: -1, ore: -1 }
      : { wood: 19, brick: 19, sheep: 19, wheat: 19, ore: 19 },
    devDeckCount: 25,
    trades: [],
    pendingDiscards: [],
    longestRoad: { holder: null, length: 0 },
    largestArmy: { holder: null, knights: 0 },
    devCardPlayedThisTurn: false,
    winner: null,
    players: [
      { seat: 0, name: 'Alice', color: 'red', resourceCount: 4, devCardCount: 0, playedKnights: 0, connected: true, publicVp: 2, roadsLeft: 13, settlementsLeft: 3, citiesLeft: 4 },
      { seat: 1, name: 'Bob', color: 'blue', resourceCount: 3, devCardCount: 0, playedKnights: 0, connected: true, publicVp: 2, roadsLeft: 13, settlementsLeft: 3, citiesLeft: 4 },
    ],
    you: {
      seat: 0,
      resources: { wood: 4, brick: 0, sheep: 0, wheat: 0, ore: 0 },
      devHand: [],
      totalVp: 2,
    },
  };
}

describe('Hide Bank Cards Count Feature', () => {
  it('updates hideBankCardsCount in lobby room settings store', () => {
    const initialRoom: RoomState = {
      roomCode: 'BANK',
      host: 0,
      players: [
        { seatIndex: 0, name: 'Host', color: 'red', ready: true, connected: true },
      ],
      settings: {
        maxPlayers: 4,
        turnTimerSec: 120,
        diceMode: 'random',
        victoryPointsToWin: 10,
        discardLimit: 7,
        hideBankCardsCount: false,
      },
      seed: 'seed123',
      started: false,
    };

    useStore.setState({
      room: initialRoom,
      session: { roomCode: 'BANK', seatIndex: 0, reconnectToken: 'tok0' },
      route: 'room',
    });

    useStore.getState().updateSettings({ hideBankCardsCount: true });
    expect(useStore.getState().room?.settings.hideBankCardsCount).toBe(true);

    useStore.getState().updateSettings({ hideBankCardsCount: false });
    expect(useStore.getState().room?.settings.hideBankCardsCount).toBe(false);
  });

  it('renders "?" count badge and hidden title on bank cards in sidebar when hideBankCardsCount is true', () => {
    const snap = makeSnapshot(true);
    render(
      <ColonistRightSidebar
        snap={snap}
        open={true}
        onClose={() => {}}
      />
    );

    const bankElement = screen.getByTestId('bank');
    expect(bankElement).toBeInTheDocument();
    // Cards should display '?'
    const questionBadges = screen.getAllByText('?');
    // 5 resource cards + 1 dev cards button
    expect(questionBadges.length).toBeGreaterThanOrEqual(5);

    // Title should mention hidden
    const woodCard = bankElement.querySelector('[data-resource="wood"]');
    expect(woodCard).toHaveAttribute('title', 'wood (bank count hidden)');
  });

  it('renders exact counts on bank cards in sidebar when hideBankCardsCount is false', () => {
    const snap = makeSnapshot(false);
    render(
      <ColonistRightSidebar
        snap={snap}
        open={true}
        onClose={() => {}}
      />
    );

    const bankElement = screen.getByTestId('bank');
    const woodCard = bankElement.querySelector('[data-resource="wood"]');
    expect(woodCard).toHaveAttribute('title', '19 wood in the bank');
    expect(screen.getAllByText('19').length).toBe(5);
  });

  it('displays "in bank: ?" in TradeModal when hideBankCardsCount is true', () => {
    const snap = makeSnapshot(true);
    useStore.setState({ game: snap });

    render(<TradeModal mySeat={0} />);

    // Sublabel should say in bank: ?
    const hiddenLabels = screen.getAllByText('in bank: ?');
    expect(hiddenLabels.length).toBe(5);
  });

  it('displays rules modal with Bank cards count: Hidden (Memory mode) when enabled', async () => {
    const user = userEvent.setup();
    const snap = makeSnapshot(true);

    render(
      <ColonistTopLeftToolbar
        snap={snap}
        detailsOpen={false}
        onToggleDetails={() => {}}
      />
    );

    // Click rules button
    const rulesBtn = screen.getByTestId('btn-rules');
    await user.click(rulesBtn);

    const bankCardsRule = screen.getByTestId('rules-bank-cards');
    expect(bankCardsRule).toHaveTextContent('Hidden (Memory mode)');
  });
});
