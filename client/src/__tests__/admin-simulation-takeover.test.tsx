import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AdminPasswordModal } from '../components/AdminPasswordModal';
import { AiTakeoverReturnModal } from '../components/AiTakeoverReturnModal';
import { useStore } from '../store';

describe('AdminPasswordModal & Simulation Protection', () => {
  it('rejects incorrect admin password and displays error', () => {
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    render(<AdminPasswordModal onClose={onClose} onSuccess={onSuccess} />);

    const input = screen.getByTestId('admin-password-input');
    fireEvent.change(input, { target: { value: 'incorrect123' } });

    const unlockBtn = screen.getByTestId('btn-unlock-admin');
    fireEvent.click(unlockBtn);

    expect(screen.getByText(/incorrect password/i)).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(useStore.getState().isAdminUnlocked).toBe(false);
  });

  it('accepts valid admin password, unlocks store, and calls callbacks', () => {
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    render(<AdminPasswordModal onClose={onClose} onSuccess={onSuccess} />);

    const input = screen.getByTestId('admin-password-input');
    fireEvent.change(input, { target: { value: 'admin' } });

    const unlockBtn = screen.getByTestId('btn-unlock-admin');
    fireEvent.click(unlockBtn);

    expect(useStore.getState().isAdminUnlocked).toBe(true);
    expect(onSuccess).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();

    // Clean up
    useStore.getState().lockAdmin();
    expect(useStore.getState().isAdminUnlocked).toBe(false);
  });
});

describe('AiTakeoverReturnModal', () => {
  it('renders takeover notice and invokes onResume on button click', () => {
    const onResume = vi.fn();
    render(<AiTakeoverReturnModal playerName="Alice" onResume={onResume} />);

    expect(screen.getByText(/Alice, your turn timer expired/i)).toBeInTheDocument();
    const resumeBtn = screen.getByTestId('btn-resume-control');
    fireEvent.click(resumeBtn);

    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it('can be minimized to pill to stay spectating', () => {
    const onResume = vi.fn();
    const onStaySpectating = vi.fn();
    render(<AiTakeoverReturnModal playerName="Alice" onResume={onResume} onStaySpectating={onStaySpectating} />);

    const spectateBtn = screen.getByTestId('btn-stay-spectating');
    fireEvent.click(spectateBtn);

    expect(onStaySpectating).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('ai-takeover-minimized-pill')).toBeInTheDocument();

    // Clicking pill restores the full modal
    fireEvent.click(screen.getByTestId('ai-takeover-minimized-pill'));
    expect(screen.getByTestId('btn-resume-control')).toBeInTheDocument();
  });
});

describe('Store AI Takeover & Admin methods', () => {
  it('unlocks and locks admin mode', () => {
    expect(useStore.getState().unlockAdmin('catan-admin')).toBe(true);
    expect(useStore.getState().isAdminUnlocked).toBe(true);

    useStore.getState().lockAdmin();
    expect(useStore.getState().isAdminUnlocked).toBe(false);
  });

  it('resumeControl resets aiTakeover on active room seat', () => {
    useStore.setState({
      session: { roomCode: 'TEST', seatIndex: 1, reconnectToken: 'token123' },
      room: {
        roomCode: 'TEST',
        host: 0,
        players: [
          { seatIndex: 0, name: 'Host', color: 'red', ready: true, connected: true, isBot: false },
          { seatIndex: 1, name: 'Bob', color: 'blue', ready: true, connected: true, isBot: false, aiTakeover: true },
        ],
        settings: {
          maxPlayers: 3,
          turnTimerSec: 60,
          diceMode: 'random',
          victoryPointsToWin: 10,
          discardLimit: 7,
        },
        started: true,
        seed: 'TESTSEED',
      },
    });

    expect(useStore.getState().room?.players[1]?.aiTakeover).toBe(true);
    useStore.getState().resumeControl();
    expect(useStore.getState().room?.players[1]?.aiTakeover).toBe(false);
  });
});
