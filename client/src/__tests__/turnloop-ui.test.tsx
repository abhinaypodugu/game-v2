// Phase 7 component tests: trade modal emissions, discard math, victim
// picker legality, victory overlay, dev card disabled states.

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { GameAction } from '@catan/shared';
import { generateBoard } from '@catan/shared';
import { TradeModal } from '../components/TradeModal';
import { DiscardModal, VictimPicker } from '../components/RobberFlow';
import { VictoryOverlay } from '../components/VictoryOverlay';
import { DevCardConfirmModal, DevCardsGuideModal, MonopolyModal, PlayerInspectModal, YearOfPlentyModal } from '../components/DevCardModals';
import type { PersonalSnapshot } from '../types';
import { useStore } from '../store';

function snapshotFor(partials: Partial<PersonalSnapshot> = {}): PersonalSnapshot {
  const board = generateBoard(3, 'ui-test-seed');
  return {
    version: 1,
    config: 'base',
    playerCount: 3,
    phase: 'turnMain',
    rules: { victoryPointsToWin: 10, discardLimit: 7 },
    activeSeat: 0,
    specialBuildSeat: null,
    turn: 1,
    dice: { die1: 3, die2: 4 },
    board,
    buildings: {},
    roads: {},
    robber: board.robberHex,
    bank: { wood: 19, brick: 19, sheep: 19, wheat: 19, ore: 19 },
    devDeckCount: 25,
    trades: [],
    pendingDiscards: [],
    longestRoad: { holder: null, length: 0 },
    largestArmy: { holder: null, knights: 0 },
    devCardPlayedThisTurn: false,
    winner: null,
    players: [
      { seat: 0, name: 'Alice', color: 'red' as never, resourceCount: 5, devCardCount: 0, playedKnights: 0, connected: true, publicVp: 2, roadsLeft: 13, settlementsLeft: 3, citiesLeft: 4 },
      { seat: 1, name: 'Bob', color: 'blue' as never, resourceCount: 3, devCardCount: 1, playedKnights: 0, connected: true, publicVp: 2, roadsLeft: 13, settlementsLeft: 3, citiesLeft: 4 },
      { seat: 2, name: 'Carol', color: 'orange' as never, resourceCount: 2, devCardCount: 0, playedKnights: 0, connected: true, publicVp: 2, roadsLeft: 13, settlementsLeft: 3, citiesLeft: 4 },
    ],
    you: { seat: 0, resources: { wood: 4, brick: 0, sheep: 2, wheat: 1, ore: 0 }, devHand: [], totalVp: 2 },
    ...partials,
  };
}

/** Point the store at a fake snapshot + capture sendAction. */
function mountWithStore(snap: PersonalSnapshot): Array<GameAction> {
  const sent: GameAction[] = [];
  vi.spyOn(useStore.getState(), 'sendAction').mockImplementation((action) => {
    sent.push(action);
  });
  useStore.setState({ game: snap });
  return sent;
}

describe('TradeModal', () => {
  it('bank tab: 4:1 trade emits bankTrade with correct resources', async () => {
    const user = userEvent.setup();
    const sent = mountWithStore(snapshotFor());
    render(<TradeModal mySeat={0} />);

    // Give 4 wood, receive 1 sheep.
    await user.click(screen.getByTestId('count-give-wood').parentElement!.querySelectorAll('button')[1]!);
    await user.click(screen.getByTestId('count-give-wood').parentElement!.querySelectorAll('button')[1]!);
    await user.click(screen.getByTestId('count-give-wood').parentElement!.querySelectorAll('button')[1]!);
    await user.click(screen.getByTestId('count-give-wood').parentElement!.querySelectorAll('button')[1]!);
    await user.click(screen.getByTestId('count-receive-sheep').parentElement!.querySelectorAll('button')[1]!);
    await user.click(screen.getByTestId('bank-submit'));

    expect(sent).toContainEqual({ type: 'bankTrade', give: 'wood', receive: 'sheep' });
  });

  it('player tab: offer emits tradeOffer with full bags', async () => {
    const user = userEvent.setup();
    const sent = mountWithStore(snapshotFor());
    render(<TradeModal mySeat={0} />);

    await user.click(screen.getByRole('button', { name: 'Players' }));
    await user.click(screen.getByTestId('count-give-wood').parentElement!.querySelectorAll('button')[1]!);
    await user.click(screen.getByTestId('count-give-brick').parentElement!.querySelectorAll('button')[1]!);
    await user.click(screen.getByTestId('count-receive-sheep').parentElement!.querySelectorAll('button')[1]!);
    await user.click(screen.getByTestId('offer-submit'));

    expect(sent).toContainEqual({
      type: 'tradeOffer',
      give: { wood: 1, brick: 0, sheep: 0, wheat: 0, ore: 0 },
      receive: { wood: 0, brick: 0, sheep: 1, wheat: 0, ore: 0 },
    });
  });

  it('accept button emits tradeRespond accept for an open offer', async () => {
    const user = userEvent.setup();
    const snap = snapshotFor({
      activeSeat: 1,
      trades: [
        { id: 't1', proposer: 1, give: { wood: 1 }, receive: { sheep: 1 }, status: 'open' as const, counterOf: null, declinedBy: [] },
      ],
    });
    const sent = mountWithStore(snap);
    render(<TradeModal mySeat={0} />);
    await user.click(screen.getByRole('button', { name: 'Players' }));
    await user.click(screen.getByTestId('accept-t1'));
    expect(sent).toContainEqual({ type: 'tradeRespond', offerId: 't1', response: 'accept' });
  });
});

describe('DiscardModal', () => {
  it('shows required count and submits the selected bag', async () => {
    const user = userEvent.setup();
    const snap = snapshotFor({
      phase: 'discard',
      pendingDiscards: [{ seat: 0, count: 4, received: false }],
      you: { seat: 0, resources: { wood: 4, brick: 4, sheep: 0, wheat: 0, ore: 0 }, devHand: [], totalVp: 2 },
    });
    const sent = mountWithStore(snap);
    render(<DiscardModal mySeat={0} />);
    expect(screen.getByTestId('discard-modal')).toHaveTextContent('Discard 4 cards');

    for (let i = 0; i < 4; i++) await user.click(screen.getByTestId('discard-plus-wood'));
    // Cannot exceed the required count.
    expect(screen.getByTestId('discard-plus-brick')).toBeDisabled();
    await user.click(screen.getByTestId('discard-submit'));
    // The modal sends a PARTIAL bag (only chosen resources) — the reducer
    // validates the sum against the required count.
    expect(sent).toContainEqual({
      type: 'discard',
      resources: { wood: 4 },
    });
  });

  it('renders nothing when the seat is not pending', () => {
    mountWithStore(snapshotFor());
    const { container } = render(<DiscardModal mySeat={0} />);
    expect(container.querySelector('[data-testid="discard-modal"]')).toBeNull();
  });
});

describe('VictimPicker', () => {
  it('lists only opponents with buildings adjacent to the robber', () => {
    const snap = snapshotFor({
      phase: 'robberSteal',
    });
    // Put Bob's settlement next to the robber.
    const robberVertices = snap.board.topology.hexVertices[snap.robber]!;
    snap.buildings[robberVertices[0]!] = { seat: 1, type: 'settlement' };
    mountWithStore(snap);
    render(<VictimPicker mySeat={0} />);
    expect(screen.getByTestId('steal-from-1')).toBeInTheDocument();
    expect(screen.queryByTestId('steal-from-2')).toBeNull();
  });
});

describe('VictoryOverlay', () => {
  it('renders winner name and breakdown on victory', () => {
    const snap = snapshotFor({
      phase: 'finished',
      winner: 0,
      buildings: { '0': { seat: 0, type: 'city' }, '1': { seat: 0, type: 'settlement' } },
    });
    mountWithStore(snap);
    render(<VictoryOverlay />);
    expect(screen.getByTestId('victory-overlay')).toHaveTextContent('Alice wins!');
    expect(screen.getByTestId('vp-breakdown')).toHaveTextContent('Settlements: 1');
    expect(screen.getByTestId('vp-breakdown')).toHaveTextContent('Cities: 1');
  });

  it('renders nothing while the game runs', () => {
    mountWithStore(snapshotFor());
    const { container } = render(<VictoryOverlay />);
    expect(container.querySelector('[data-testid="victory-overlay"]')).toBeNull();
  });
});

describe('DevCardModals', () => {
  it('MonopolyModal selects a resource and dispatches playDevCard', async () => {
    const user = userEvent.setup();
    const sent = mountWithStore(snapshotFor());
    const onClose = vi.fn();
    render(<MonopolyModal cardId="m1" onClose={onClose} />);

    await user.click(screen.getByTestId('mono-select-ore'));
    expect(sent).toContainEqual({
      type: 'playDevCard',
      cardId: 'm1',
      payload: { resource: 'ore' },
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('YearOfPlentyModal selects 2 resources and enables submit', async () => {
    const user = userEvent.setup();
    const sent = mountWithStore(snapshotFor());
    const onClose = vi.fn();
    render(<YearOfPlentyModal cardId="yop1" onClose={onClose} />);

    // Submit is disabled with 0 selected
    expect(screen.getByTestId('yop-submit')).toBeDisabled();

    // Increment wood and wheat
    const plusButtons = screen.getAllByRole('button', { name: '+' });
    await user.click(plusButtons[0]!); // wood
    await user.click(plusButtons[3]!); // wheat

    expect(screen.getByTestId('yop-submit')).toBeEnabled();
    await user.click(screen.getByTestId('yop-submit'));

    expect(sent).toContainEqual({
      type: 'playDevCard',
      cardId: 'yop1',
      payload: { resources: ['wood', 'wheat'] },
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('DevCardConfirmModal prompts before playing and invokes callbacks', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    const { unmount } = render(
      <DevCardConfirmModal card={{ id: 'k1', type: 'knight' }} onConfirm={onConfirm} onClose={onClose} />,
    );

    expect(screen.getByText('Play Knight?')).toBeInTheDocument();
    expect(screen.getByText(/Move the robber/i)).toBeInTheDocument();

    await user.click(screen.getByTestId('dev-confirm-cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);

    unmount();
    render(<DevCardConfirmModal card={{ id: 'k1', type: 'knight' }} onConfirm={onConfirm} onClose={onClose} />);
    await user.click(screen.getByTestId('dev-confirm-play'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('DevCardConfirmModal shows inspection mode with reason when card cannot be played', () => {
    const onClose = vi.fn();
    render(
      <DevCardConfirmModal
        card={{
          id: 'k1',
          type: 'knight',
          playable: false,
          reason: 'Wait for your turn! You can play dev cards on your turn.',
        }}
        onConfirm={vi.fn()}
        onClose={onClose}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Knight' })).toBeInTheDocument();
    expect(screen.getByText(/Wait for your turn/i)).toBeInTheDocument();
    expect(screen.queryByTestId('dev-confirm-play')).toBeNull();
  });

  it('DevCardsGuideModal lists all 5 development cards and their descriptions', () => {
    const onClose = vi.fn();
    render(<DevCardsGuideModal onClose={onClose} />);

    expect(screen.getByText('Development Cards Guide')).toBeInTheDocument();
    expect(screen.getByText('Knight')).toBeInTheDocument();
    expect(screen.getByText('Road Building')).toBeInTheDocument();
    expect(screen.getByText('Year of Plenty')).toBeInTheDocument();
    expect(screen.getByText('Monopoly')).toBeInTheDocument();
    expect(screen.getByText('Victory Point')).toBeInTheDocument();
  });

  it('PlayerInspectModal displays player profile, VP breakdown, and holdings', () => {
    const snap = snapshotFor();
    const player = snap.players[0]!;
    const onClose = vi.fn();
    const onOpenGuide = vi.fn();

    render(
      <PlayerInspectModal
        player={player}
        snap={snap}
        onClose={onClose}
        onOpenGuide={onOpenGuide}
      />,
    );

    expect(screen.getByTestId('player-inspect-modal')).toBeInTheDocument();
    expect(screen.getByText(/Victory Point Breakdown/i)).toBeInTheDocument();
    expect(screen.getByText(/Pieces & Cards/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Development Cards/i })).toBeInTheDocument();
  });
});
