// Time-tracker domain types. All datetimes are ISO 8601 strings (UTC, via
// `Date#toISOString`). A `null` end on a Break or `null` clock_out means
// "still open right now".

export type Break = {
  start: string;        // ISO datetime
  end: string | null;   // null = currently on this break
};

export type Session = {
  id: string;
  category: string;
  clock_in: string;          // ISO datetime
  clock_out: string | null;  // null = still clocked in
  breaks: Break[];           // pseudo clock-outs (meals etc.); excluded from net time
  notes?: string;
  created_at: string;
  updated_at: string;
};

// A completed Pomodoro interval. `credited` is true when the user was clocked
// in "for real" (active session, not on break) at the moment it finished —
// only credited intervals add reward minutes.
export type Pomodoro = {
  id: string;
  completed_at: string;     // ISO datetime
  length_min: number;       // interval length used
  reward_minutes: number;   // reward granted (0 when not credited)
  credited: boolean;
};

// One play→stop run of the reward-minutes countdown.
export type RewardSpend = {
  id: string;
  started_at: string;
  ended_at: string;
  minutes: number;          // reward minutes consumed (fractional)
};

export type DataState = {
  version: 1;
  sessions: Session[];
  categories: string[];
  pomodoros: Pomodoro[];
  rewardSpends: RewardSpend[];
};

export const DEFAULT_CATEGORIES = ['OAIP', 'SPUR'];

export const EMPTY_STATE: DataState = {
  version: 1,
  sessions: [],
  categories: [],
  pomodoros: [],
  rewardSpends: [],
};

// Device-local preferences (not synced — they're per-device choices).
export type Settings = {
  intervalMin: number;        // Pomodoro work interval
  rewardPerInterval: number;  // reward minutes earned per credited interval
  autoStart: boolean;         // start the next interval automatically on completion
};

export const DEFAULT_SETTINGS: Settings = {
  intervalMin: 25,
  rewardPerInterval: 5,
  autoStart: true,
};

// Live timer state (device-local, not synced — a running countdown belongs to
// one device). Epoch-ms timestamps so a refresh can resume mid-interval.
export type Timers = {
  pomodoroEndsAt: number | null;        // running: when the interval ends
  pomodoroRemainingSec: number | null;  // paused: seconds left
  rewardPlayStartedAt: number | null;   // reward countdown is playing
};

export const EMPTY_TIMERS: Timers = {
  pomodoroEndsAt: null,
  pomodoroRemainingSec: null,
  rewardPlayStartedAt: null,
};
