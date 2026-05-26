// Time-tracker domain types. All datetimes are ISO 8601 strings (UTC, via
// `Date#toISOString`). A `null` end on a Break or `null` clock_out means
// "still open right now".

export type Break = {
  id: string;
  start: string;        // ISO datetime
  end: string | null;   // null = currently on this break
  notes?: string;
};

// A stopwatch-style lap: an explicit start/stop segment within a clock-in
// session. Press Lap once to start the lap (end stays null), press again to
// stop it (end set to that moment). At most one lap is open at a time. Laps
// don't affect net worked time — they're just markers for what was done.
export type Lap = {
  id: string;
  start: string;
  end: string | null;
  notes?: string;
};

export type Session = {
  id: string;
  category: string;
  clock_in: string;          // ISO datetime
  clock_out: string | null;  // null = still clocked in
  breaks: Break[];           // pseudo clock-outs (meals etc.); excluded from net time
  laps: Lap[];               // marker segments within the session; don't affect net time
  notes?: string;
  // Self-report ratings, prompted (skippably) at clock-out. 0 = unrated, else 1–5.
  mood: number;
  productivity: number;
  enjoyment: number;
  // What kind of work the session was: the top one or two activity types.
  // activity1Pct / activity2Pct are each activity's own share of the whole
  // session (0–100) — independent, so they need not sum to 100 (the rest is
  // other untracked work). Empty strings = unset.
  activity1: string;
  activity2: string;
  activity1Pct: number;
  activity2Pct: number;
  created_at: string;
  updated_at: string;
};

export const RATING_KEYS = ['mood', 'productivity', 'enjoyment'] as const;

// Endpoint anchors for the 1–5 rating scales, keyed by the RatingRow label.
export const RATING_ANCHORS: Record<string, { low: string; high: string }> = {
  Mood: { low: 'rough', high: 'great' },
  Productivity: { low: 'distracted', high: 'locked in' },
  Enjoyment: { low: 'disliked it', high: 'loved it' },
};

// Fixed activity taxonomy — kept stable on purpose so cross-tabs stay
// comparable over time. Edit this list to change the options.
export const ACTIVITY_TYPES = [
  'Coding', 'Writing', 'Reading', 'Thinking', 'Meetings', 'Admin', 'Learning', 'Other',
] as const;

export const ACTIVITY_DEFINITIONS: Record<string, string> = {
  Coding: 'Writing, debugging, or refactoring code.',
  Writing: 'Prose work — drafting or editing papers, posts, notes.',
  Reading: 'Reading papers, articles, or docs to take information in.',
  Thinking: 'Planning, problem-solving, or designing — working it out in your head or on paper.',
  Meetings: 'Calls, meetings, syncs — working with other people.',
  Admin: 'Email, scheduling, logistics, and other busywork.',
  Learning: 'Courses, tutorials, deliberately building a skill.',
  Other: "Anything that doesn't fit the buckets above.",
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
  intervalMin: number;             // Pomodoro work interval
  rewardPerInterval: number;       // reward minutes earned per credited interval
  autoStart: boolean;              // start the next interval automatically on completion
  autoRunWhenClockedIn: boolean;   // run the timer in lockstep with being clocked in
};

export const DEFAULT_SETTINGS: Settings = {
  intervalMin: 25,
  rewardPerInterval: 5,
  autoStart: true,
  autoRunWhenClockedIn: false,
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
