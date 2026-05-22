import { useEffect, useState } from 'react';
import type { Settings, Timers, Pomodoro, RewardSpend } from './types';
import { fmtClock, rewardBankMin, ticksOn, ticksBetween, todayKey, dayKey } from './compute';
import { chime } from './notify';

type Props = {
  now: number;
  settings: Settings;
  onChangeSettings: (s: Settings) => void;
  timers: Timers;
  onChangeTimers: (t: Timers) => void;
  pomodoros: Pomodoro[];
  rewardSpends: RewardSpend[];
  clockedInReal: boolean;
  onRewardSpend: (startedAt: string, endedAt: string, minutes: number) => void;
};

const btnAccent = 'font-mono text-[12px] uppercase tracking-[0.1em] border border-accent text-accent ' +
  'hover:bg-accent hover:text-paper rounded-sm px-4 py-2.5 transition-colors disabled:opacity-40 ' +
  'disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-accent';
const btnMuted = 'font-mono text-[12px] uppercase tracking-[0.1em] border border-rule text-ink-soft ' +
  'hover:border-accent hover:text-accent rounded-sm px-4 py-2.5 transition-colors disabled:opacity-40 ' +
  'disabled:cursor-not-allowed disabled:hover:border-rule disabled:hover:text-ink-soft';
const btnSmall = 'font-mono text-[10px] uppercase tracking-[0.1em] border border-rule text-ink-soft ' +
  'hover:border-accent hover:text-accent rounded-sm px-2.5 py-1.5 transition-colors disabled:opacity-40 ' +
  'disabled:cursor-not-allowed disabled:hover:border-rule disabled:hover:text-ink-soft';

export default function PomodoroTab({
  now, settings, onChangeSettings, timers, onChangeTimers,
  pomodoros, rewardSpends, clockedInReal, onRewardSpend,
}: Props) {
  const intervalMs = settings.intervalMin * 60_000;

  // --- Pomodoro countdown ---------------------------------------------------
  const running = timers.pomodoroEndsAt !== null;
  const paused = !running && timers.pomodoroRemainingSec !== null;
  const remainingMs = running
    ? Math.max(0, timers.pomodoroEndsAt! - now)
    : paused
      ? timers.pomodoroRemainingSec! * 1000
      : intervalMs;

  // Interval completion (notification + chime + reward credit + auto-start)
  // is detected by the dashboard, which stays mounted on every tab — so it
  // fires even when this tab isn't open. See TimeTrackerDashboard.

  const start = () => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
    chime(); // unlocks AudioContext on this user gesture, then stays silent-capable
    onChangeTimers({ ...timers, pomodoroEndsAt: now + remainingMs, pomodoroRemainingSec: null });
  };
  const pause = () => {
    onChangeTimers({ ...timers, pomodoroEndsAt: null, pomodoroRemainingSec: Math.round(remainingMs / 1000) });
  };
  const reset = () => {
    onChangeTimers({ ...timers, pomodoroEndsAt: null, pomodoroRemainingSec: null });
  };

  // --- Reward bank ----------------------------------------------------------
  const bankMin = rewardBankMin(pomodoros, rewardSpends);
  const playing = timers.rewardPlayStartedAt !== null;
  const playElapsedMin = playing ? (now - timers.rewardPlayStartedAt!) / 60_000 : 0;
  const liveBankMin = Math.max(0, bankMin - playElapsedMin);

  const stopReward = () => {
    if (timers.rewardPlayStartedAt === null) return;
    const startedAt = new Date(timers.rewardPlayStartedAt).toISOString();
    const spent = Math.min((now - timers.rewardPlayStartedAt) / 60_000, bankMin);
    onChangeTimers({ ...timers, rewardPlayStartedAt: null });
    if (spent > 0) onRewardSpend(startedAt, new Date(now).toISOString(), spent);
  };
  // Starting a reward break pauses the focus timer — you're not focusing
  // while spending reward minutes. It stays paused; resume it yourself.
  const playReward = () => {
    if (bankMin <= 0) return;
    const next: Timers = { ...timers, rewardPlayStartedAt: now };
    if (running) {
      next.pomodoroEndsAt = null;
      next.pomodoroRemainingSec = Math.round(remainingMs / 1000);
    }
    onChangeTimers(next);
  };

  // Auto-stop the reward countdown when it drains to zero.
  useEffect(() => {
    if (playing && liveBankMin <= 0) stopReward();
  }); // eslint-disable-line react-hooks/exhaustive-deps

  // Manual reward-bank adjustment, recorded as a reward_spend row: a negative
  // "spend" adds minutes, a positive one subtracts, a spend of the whole bank
  // resets it to zero. Keeps the bank fully derived (no stored running total).
  const [adjMin, setAdjMin] = useState('');
  const nowIso = () => new Date(now).toISOString();
  const adjustReward = (sign: 1 | -1) => {
    const n = Math.abs(Math.round(Number(adjMin))) || 1;  // empty box → 1
    onRewardSpend(nowIso(), nowIso(), sign * n);           // sign -1 adds, +1 subtracts
    setAdjMin('');
  };
  const resetReward = () => {
    if (bankMin <= 0) return;
    if (!window.confirm(`Reset the reward bank to zero? (Currently ${fmtClock(bankMin * 60_000)}.)`)) return;
    onRewardSpend(nowIso(), nowIso(), bankMin);
  };

  const todayTicks = ticksOn(pomodoros, todayKey(now));
  const weekStart = dayKey(now - new Date(now).getDay() * 86_400_000);
  const weekTicks = ticksBetween(pomodoros, weekStart, todayKey(now));

  return (
    <div className="space-y-7">
      {/* Countdown */}
      <div className="rounded-lg border border-rule bg-paper p-6 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted m-0 mb-1">
          {running ? 'Focus interval' : paused ? 'Paused' : 'Ready'}
        </p>
        <p className="font-display text-[64px] leading-none text-ink m-0 tabular-nums">
          {fmtClock(remainingMs)}
        </p>
        <div className="flex gap-2.5 flex-wrap justify-center mt-5">
          {running
            ? <button className={btnMuted} onClick={pause}>Pause</button>
            : <button className={btnAccent} onClick={start}>{paused ? 'Resume' : 'Start'}</button>}
          <button className={btnMuted} onClick={reset} disabled={!running && !paused}>Reset</button>
        </div>
        <div className="flex flex-col items-center gap-1.5 mt-4">
          <label className="flex items-center gap-2 font-serif text-[12px] text-ink-soft">
            <input type="checkbox" checked={settings.autoStart}
                   onChange={e => onChangeSettings({ ...settings, autoStart: e.target.checked })} />
            Auto-start the next interval
          </label>
          <label className="flex items-center gap-2 font-serif text-[12px] text-ink-soft">
            <input type="checkbox" checked={settings.autoRunWhenClockedIn}
                   onChange={e => {
                     if (e.target.checked) {
                       // Toggling on is a user gesture — grant notification
                       // permission and unlock audio so auto-run completions
                       // can alert even if Start was never pressed.
                       if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
                         Notification.requestPermission().catch(() => {});
                       }
                       chime();
                     }
                     onChangeSettings({ ...settings, autoRunWhenClockedIn: e.target.checked });
                   }} />
            Run automatically while clocked in
          </label>
        </div>
        <p className={'font-serif text-[12px] m-0 mt-2 ' + (clockedInReal ? 'text-accent' : 'text-muted')}>
          {clockedInReal
            ? 'Clocked in — finished intervals earn reward minutes.'
            : 'Not clocked in — intervals count, but earn no reward minutes.'}
        </p>
      </div>

      {/* Settings + tick count */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
            Interval (min)
          </span>
          <input
            type="number" min={1} max={180}
            value={settings.intervalMin}
            onChange={e => {
              const v = Math.max(1, Math.min(180, Math.round(Number(e.target.value) || 1)));
              onChangeSettings({ ...settings, intervalMin: v });
            }}
            className="mt-1 w-full font-serif text-[15px] bg-paper border border-rule rounded-sm
                       px-3 py-2 text-ink focus:border-accent outline-none" />
        </label>
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
            Reward min / interval
          </span>
          <input
            type="number" min={0} max={120}
            value={settings.rewardPerInterval}
            onChange={e => {
              const v = Math.max(0, Math.min(120, Math.round(Number(e.target.value) || 0)));
              onChangeSettings({ ...settings, rewardPerInterval: v });
            }}
            className="mt-1 w-full font-serif text-[15px] bg-paper border border-rule rounded-sm
                       px-3 py-2 text-ink focus:border-accent outline-none" />
        </label>
        <div className="rounded-sm border border-rule bg-paper px-3 py-2 flex flex-col justify-center">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
            Intervals today
          </span>
          <span className="font-display text-[24px] leading-tight text-ink tabular-nums">
            {todayTicks}
            <span className="font-serif text-[12px] text-muted ml-2">
              {weekTicks} this week · {pomodoros.length} all-time
            </span>
          </span>
        </div>
      </div>

      {/* Reward bank */}
      <div className="rounded-lg border border-accent/40 bg-paper p-6 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted m-0 mb-1">
          Reward minutes
        </p>
        <p className="font-display text-[44px] leading-none text-accent m-0 tabular-nums">
          {fmtClock(liveBankMin * 60_000)}
        </p>
        <div className="flex gap-2.5 flex-wrap justify-center mt-5">
          {playing
            ? <button className={btnAccent} onClick={stopReward}>Stop</button>
            : <button className={btnAccent} onClick={playReward} disabled={bankMin <= 0}>Play</button>}
        </div>
        <p className="font-serif text-[12px] text-muted m-0 mt-4">
          {playing
            ? 'Counting down — spending your reward bank.'
            : 'Earned by completing intervals while clocked in. Play to spend it.'}
        </p>

        {/* Manual adjustment */}
        <div className="flex items-center justify-center gap-2 flex-wrap mt-4 pt-4 border-t border-rule-soft">
          <input
            type="number" min={1} value={adjMin} disabled={playing}
            onChange={e => setAdjMin(e.target.value)}
            placeholder="1"
            className="w-20 font-serif text-[14px] bg-paper border border-rule rounded-sm
                       px-2.5 py-1.5 text-ink focus:border-accent outline-none disabled:opacity-40" />
          <button className={btnSmall} disabled={playing}
                  onClick={() => adjustReward(-1)}>+ Add</button>
          <button className={btnSmall} disabled={playing}
                  onClick={() => adjustReward(1)}>− Subtract</button>
          <button className={btnSmall} disabled={playing || bankMin <= 0}
                  onClick={resetReward}>Reset to 0</button>
        </div>
      </div>
    </div>
  );
}
