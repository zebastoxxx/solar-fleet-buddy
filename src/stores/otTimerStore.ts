import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useState, useEffect } from 'react';

interface TimerState {
  activeOTId: string | null;
  activeOTCode: string | null;
  machineName: string | null;
  status: 'idle' | 'running' | 'paused';
  startedAt: number | null;
  totalPausedMs: number;
  pauseStartedAt: number | null;
  startTimer: (otId: string, otCode: string, machineName: string) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  stopTimer: () => void;
  getElapsedMs: () => number;
}

export const useOTTimerStore = create<TimerState>()(
  persist(
    (set, get) => ({
      activeOTId: null,
      activeOTCode: null,
      machineName: null,
      status: 'idle',
      startedAt: null,
      totalPausedMs: 0,
      pauseStartedAt: null,

      startTimer: (otId, otCode, machineName) => set({
        activeOTId: otId,
        activeOTCode: otCode,
        machineName,
        status: 'running',
        startedAt: Date.now(),
        totalPausedMs: 0,
        pauseStartedAt: null,
      }),

      pauseTimer: () => set({
        status: 'paused',
        pauseStartedAt: Date.now(),
      }),

      resumeTimer: () => {
        const { pauseStartedAt, totalPausedMs } = get();
        const pauseDuration = pauseStartedAt ? Date.now() - pauseStartedAt : 0;
        set({
          status: 'running',
          totalPausedMs: totalPausedMs + pauseDuration,
          pauseStartedAt: null,
        });
      },

      stopTimer: () => set({
        activeOTId: null,
        activeOTCode: null,
        machineName: null,
        status: 'idle',
        startedAt: null,
        totalPausedMs: 0,
        pauseStartedAt: null,
      }),

      getElapsedMs: () => {
        const { startedAt, totalPausedMs, pauseStartedAt, status } = get();
        if (!startedAt) return 0;
        const now = Date.now();
        const currentPause = status === 'paused' && pauseStartedAt
          ? now - pauseStartedAt : 0;
        return now - startedAt - totalPausedMs - currentPause;
      },
    }),
    { name: 'ot-timer-storage' }
  )
);

export function useChrono() {
  const [display, setDisplay] = useState('00:00:00');
  const status = useOTTimerStore((s) => s.status);
  const getElapsedMs = useOTTimerStore((s) => s.getElapsedMs);

  useEffect(() => {
    if (status === 'idle') {
      setDisplay('00:00:00');
      return;
    }
    const interval = setInterval(() => {
      const ms = getElapsedMs();
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setDisplay(
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [status, getElapsedMs]);

  return display;
}
