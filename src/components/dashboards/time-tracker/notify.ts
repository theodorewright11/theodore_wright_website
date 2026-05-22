// Pomodoro completion alerts — shared so they fire from the dashboard-level
// completion watcher (which runs on every tab) and so PomodoroTab can reuse
// `chime` to unlock audio on a user gesture.

// Two-tone chime via WebAudio — no asset file. The AudioContext is created
// lazily; it only produces sound once unlocked by a user gesture (the first
// Start click / auto-run toggle), after which it works even in the background.
let audioCtx: AudioContext | null = null;

export function chime(): void {
  try {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = audioCtx || new Ctor();
    const ctx = audioCtx;
    if (ctx.state === 'suspended') ctx.resume();
    const t0 = ctx.currentTime;
    const tone = (freq: number, start: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0 + start);
      g.gain.exponentialRampToValueAtTime(0.3, t0 + start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + start + 0.55);
      o.start(t0 + start);
      o.stop(t0 + start + 0.6);
    };
    tone(880, 0);
    tone(1175, 0.28);
  } catch { /* audio unavailable — notification still fires */ }
}

export function notifyIntervalComplete(credited: boolean, rewardMin: number): void {
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    new Notification('Pomodoro complete', {
      body: credited
        ? `+${rewardMin} reward minutes earned.`
        : 'Interval done. (Not clocked in — no reward minutes.)',
    });
  }
  chime();
}
