# Product Requirements

This is the personal site for Teddy Wright. It serves three audiences:

- **Visitors** (academics, collaborators, employers) browsing his work and writing
- **Teddy** himself, using it as a notebook + dashboard for ongoing research and personal models
- **Future Teddy** maintaining and extending it over time

## Site sections

### Public

| Path | Purpose |
|---|---|
| `/` | Combined home + about — short bio and contact links |
| `/research` | Formal academic research, grouped by status (In Progress / Finished / Planned / Contributions) |
| `/ai-research` | Outputs of the LLM Iterate pipeline (6-stage refinement of topics) |
| `/models` | Polished interactive quantitative models (sliders, real-time computation) |
| `/dashboards` | Interactive dashboards (public demo + private tier per dashboard) |
| `/writing` | Essays, with tier labels showing how AI-assisted each piece is |
| `/updates` | Weekly (or daily/monthly) notes on what's moving — **placeholder for now** ("coming soon"), no live entries listed |

`/about` redirects to `/`.

### Private

| Path | Purpose |
|---|---|
| `/dashboards` | Auth-gated personal dashboards (life metrics, trackers). Not built yet. |

## Writing tiers

Every essay carries one of three tier labels in its frontmatter:

| Value | Label shown | Meaning |
|---|---|---|
| `mine` | **Me** | Written by Teddy, no AI involvement |
| `collab` | **Me x AI** | Teddy directs and injects substance, AI refines/synthesizes |
| `ai-led` | **AI** | Primarily AI-generated, Teddy curated/edited only |

Tier shows on the post card and at the top of the post. Default is `mine`.

## Models

A model has:

- A canonical name and slug
- An explanatory MDX page (intuition, equations, key insights)
- An optional interactive React component (sliders, real-time computation)
- A `featured` flag controlling whether it gets emphasized on `/models`

Initial roster (drafts/published over time). Public titles are plain-language ("stupid simple to interpret") — the conceptual short-name in parentheses is for internal reference only:

- **Why continuing is rational once you exist** *(option value)* — existence asymmetry from holding an option on future states
- **Why certain harm and suffering gets more attention than others** *(suffering salience)* — vividness, recency, identifiability, narrative fit, etc. distort perceived harm
- **How to parent optimally** *(parental decision-making)* — confidence, stakes, reversibility, disclosure, etc.

Tags on model frontmatter exist in the schema but are no longer rendered — model identity is carried by the title and description.

## AI's Research (LLM Iterate)

A pipeline that turns a topic into a progressively refined artifact across 6 stages:

1. **Lit Review** — landscape analysis, key papers, gaps
2. **Topology** — dependency graph (D3 visualization once implemented)
3. **Model** — formalization, equations, interactive dashboard
4. **Data** — empirical pipeline + findings
5. **Build** — useful artifact (tool / component / site addition)
6. **Writeup** — long-form synthesis of the whole pipeline for an educated lay reader; defines acronyms before use, contains its own TLDR, surfaces the headline findings without technical jargon

Each stage:

- Lives at `/ai-research/<topic>/<stage>`
- Has a refinement log (REFINEMENT / WHY / CHANGES) showing iteration history
- Feeds the next stage as input
- Carries a `refinementPass` integer in frontmatter that **increments on every refinement pass that makes changes** to that stage. The topic registry below tracks the *furthest* stage and its pass number; refining an earlier stage while a later stage already exists does not update the registry. No-op passes (concluded "no refinement needed") do not bump `refinementPass`.

Raw working drafts live in `stage_outputs/<topic>/<stage>.md` (kebab-case topic slug, stage filename one of `lit-review`, `topology`, `model`, `data`, `build`, `writeup`). Polished versions move into `src/content/ai_research/<topic>/<stage>.mdx`.

The topic-level `overview.mdx` is **not written during the pipeline** — it is produced (or revised) only after all six stages are complete, since the writeup itself supersedes the overview as the canonical synthesis.

Per-stage pages do not surface the `status` frontmatter field as label text. Each stage page shows only the **refinement pass number** (`pass N`); pass 0 stubs render no pass label. The `status` field still drives the binary draft-vs-stub coloring of the stage bars on the `/ai-research` index page (any non-stub status renders the bar dark; stub renders grey), but it is never displayed as text.

Topic cards on `/ai-research` do **not** show a "X/N" stage-completion counter. The colored stage bars and the per-stage labels underneath them carry the same information at a glance, and the explicit count was redundant. Same convention for the home page topic list — the bars are the indicator, no count.

A topic's stage-3 model can be **promoted** to `/models` when polished — copy the formalization to a new `src/content/models/<slug>.mdx` entry.

### Topic registry

Active topics — folders exist in `src/content/ai_research/` and `stage_outputs/`:

| Topic slug | Title | Furthest stage | Status |
|---|---|---|---|
| `human-psych-variation` | Psychology of Individual Differences | writeup (pass 5) | **finished** |
| `navigating-ai-world` | Navigating an AI World | writeup (pass 4) | **finished** |
| `technology-utilization-architecture` | Technology Utilization Architecture | writeup (pass 4) | in progress |

A topic is **finished** when every one of its six stages (lit-review, topology, model, data, build, writeup) has `status: complete` in the stage frontmatter. The `/ai-research` index page renders finished topics in a "Finished" bucket above the "In Progress" bucket; cards carry a small `finished` accent tag next to the title; the home page status pill reads `finished`.

Planned topics render from `src/data/ai_research_planned.json` (16 entries — the `{title, desc}` list shown on `/ai-research` and the home page); `prompts.md` holds the longer brainstorm behind them. Each spins up its own `src/content/ai_research/<topic>/` + `stage_outputs/<topic>/` folder pair when started.

## Dashboards

Each dashboard ships in two tiers:

| Tier | URL | Data | Audience |
|---|---|---|---|
| **Public demo** | `/dashboards/<name>` | Visitor's own data in `localStorage`, with CSV import/export | Anyone — uses the model on their own data, no auth |
| **Private** | `/dashboards/<name>/me` (gated) | Teddy's own data (private Google Sheet or gated JSON) | Teddy only, via Cloudflare Access |

**Default behavior**: a visitor lands on the public demo. They get the same UI Teddy uses, but the data starts empty / synthetic and lives only in their browser. They can export to CSV to persist; re-import on next visit. No backend, no account, no privacy concerns.

**Private tier** exists only for dashboards where Teddy's actual data is the point (life metrics, ongoing trackers). Cloudflare Access in front, build-time data fetch from a private source.

Dashboards: decision-helper (planned), finance, emotional-wellbeing, time-tracker, qualitative-coding.

### Per-dashboard product specs

Dashboard-specific scope (data model, page layout, computations) lives below as a subsection per dashboard. The main `Dashboards` section above governs the cross-cutting tier convention.

#### Finance

**Status**: v1 shipped, **private** (not listed publicly). Marked `private: true` in `src/data/dashboards.json` so it's hidden from the `/dashboards` roster and the home page Dashboards column. The page still renders at `/dashboards/finance` for direct navigation. A public demo + how-to-self-host writeup is planned for once the private version is locked in.

A spending-and-budget dashboard that replaces a manual spreadsheet workflow. Single user (Teddy). Answers: *given what I've spent this month and historically, am I on track with my budget, and where is my money actually going?*

**Pages** — internal tabs in a single React component at `/dashboards/finance`:

- **Dashboard** — month selector + headline cards (Spent / Budgeted / Variance / Income / Net cash flow) + per-category breakdown grouped Broad → Mid → Detailed with per-row variance bars. Defaults to current month; navigation to past months uses the budget that was effective for that month.
- **Transactions** — sortable, filterable log (search on item, account/category multi-select, date range). Add / edit / delete via modal. Pagination at 100 rows per page.
- **Budget** — versioned budget editor: editing a category creates a new row with today as `effective_from` rather than mutating history. Includes an Income editor with sources. Warning banner when planned spend exceeds planned income.
- **Insights** — stub in v1. Planned: spending over time, category drift, rolling averages, runway, month-over-month deltas.

**Data model**:

- `Transaction` — `id` (UUID), `date` (ISO), `item`, `amount` (positive USD), `account` (`Amex` / `Debit` / `Cash` / `Other`), `category` (detailed key), `notes?`, `created_at`, `updated_at`.
- `Budget` — `category`, `monthly_amount`, `effective_from`. Versioned by `effective_from`; never mutated in place.
- `Income` — `id`, `source`, `monthly_amount`, `effective_from`. Same versioning convention.

**Category taxonomy**: three-level (Broad → Mid → Detailed). Source of truth: `src/components/dashboards/finance/categories.ts`. Adding/renaming a category is editing that file. Detailed key is the persistent string stored on transactions; renaming it strands historical rows under "Uncategorized" until they're re-categorized in the UI.

**Data persistence**: two-mode.

- **Local-only** (no sign-in, or no Sheets config in `.env`): browser `localStorage` under key `tw-finance-v1`. CSV import/export per entity. The "Reset all data" button only appears in this mode.
- **Sheets-synced** (signed in): a dedicated Google Sheet (ID in `PUBLIC_FINANCE_SHEET_ID`) is the source of truth, with three tabs (`transactions`, `budgets`, `incomes`) matching the entity schemas. localStorage stays as offline cache. Auth via **Google Identity Services** browser-side OAuth (token in `sessionStorage`, scope `https://www.googleapis.com/auth/spreadsheets email profile`); no service account, no server. On sign-in, full pull from sheet replaces in-memory state. On every mutation, the affected entity's full tab is rewritten (clear + write) — per-entity coalescing queue collapses bursts of edits into one write. On window focus, full re-pull. 401 → drop token, prompt re-sign-in.

**Public-data conventions**: never commit personal data. The user's actual `.xlsx` workbook stays gitignored (`Finances Sheet*.xlsx` rule). The `.env` holding the Client ID + Sheet ID is gitignored too.

**Sheets seed action**: when signed in and the dashboard's `transactions` tab is empty, a one-click "Seed from Spending Log" callout appears in the Transactions tab. It reads the user's legacy `Spending Log` tab from the same workbook (column layout `Date | Item | Price | Account | Category`), runs the same translation as `scripts/finance_import_xlsx.py` (account `Debt → Debit`, category renames `ChatGPT → AI Subscription`, `OneDrive → One Drive`, `Car Maintenence → Car Maintenance`), and writes the result to the new `transactions` tab. Confirmation dialog reports counts + unknown categories before committing.

**Required env (when using Sheets sync)**:
- `PUBLIC_GOOGLE_CLIENT_ID` — OAuth 2.0 Web Client ID from Google Cloud Console (Sheets API enabled; authorized JS origins include `http://localhost:4321` and the deploy domain)
- `PUBLIC_FINANCE_SHEET_ID` — the long ID from the sheet URL between `/d/` and `/edit`
- The OAuth client *secret* is **not** used (browser-side OAuth flow)

**Future (v3 — public demo)**: drop `private: true` from the roster entry, keep localStorage-only for unauthenticated visitors, and ship a writeup explaining how to fork the dashboard and wire it to your own Google Sheet.

#### Emotional Well-being

**Status**: v1 shipped (public demo). Private tier deferred.

A needs-rating dashboard that surfaces the highest-leverage emotional needs to act on. Single user (Teddy in private tier; any visitor in public demo). Answers: *which of my needs are most under-met relative to how much I care about them, where do the biggest aggregate gaps live by domain, and which sources (self / friends / romantic / activities / career / other) are over- or under-contributing relative to where I'd want them?*

**Pages** — internal tabs in a single React component at `/dashboards/emotional-wellbeing`:

- **Needs** — domain-grouped list of needs. Each row: editable name + domain dropdown, two button-strip scales (priority 0–5, currently-met 0–7), a leverage score, and an expand caret that opens the per-source allocation panel (six rows of `actual %` + `ideal %` sliders 0–100, plus per-source gap and a remove button). Domain filter chips above the list. "+ Add need" at the bottom.
- **Insights** — four sub-views (Leverage / By domain / Sources / Distribution). Empty state shown until at least one need has both priority and currently-met set.

**Inputs (per need)**:

- `priority` — 1–5 (1 = not relevant, 5 = core); 0 = unset.
- `currently_met` — 1–7 (1 = not at all, 7 = fully); 0 = unset.
- *(optional)* per-source allocation: for each of `self / friends / romantic / activities / career / other`, an `actual %` and `ideal %` (0–100 each, step 5). Allocations don't need to sum to 100 — they're independent scalars; a small inline note flags "ideal should sum to ~100" when totals look off.

**Default seed**: 25 universal needs across 8 domains (Purpose / Contribution, Relational / Social, Cognitive / Intellectual, Emotional, Creative, Physical, Spiritual / Existential, Autonomy / Agency), names + domains only, all ratings unset. Trimmed from an earlier 35 to drop near-synonyms (e.g. "feeling understood" / "being known"; "freedom to choose" / "self-determination"; "awe" / "connection to something bigger") and to split the emotional cluster into steady-state ("loved & accepted") vs acute ("emotionally held in distress"). Two gap-fillers added: belonging / community and shared laughter & play. Source is `src/components/dashboards/emotional-wellbeing/seed.ts`. Personal numbers are never committed to the repo.

**Computations** (`compute.ts`):

- `leverage(need) = priority × (8 − currently_met)`, range 1..35 when both set, 0 when either is unset. Drives the leverage ranking.
- Domain rollups: `avgPriority`, `avgMet`, `totalLeverage`, top-leverage need name per domain.
- Source gaps: priority-weighted sum of `actual` and `ideal` per source across all rated needs; `weightedGap = weightedIdeal − weightedActual` (positive = source under-contributing). Also reports each source's share of total weighted contribution.
- `metShare = Σ(priority × currently_met / 7) / Σ(priority)` over rated needs — the headline "how met are your needs" score (0..1).

**Data persistence (v1)**: browser `localStorage` under key `tw-emotional-wellbeing-v1`. CSV import/export round-trips one row per need with all source allocations as columns (`<source>_actual`, `<source>_ideal`).

**Public-data conventions**: never seed the public demo with personal ratings. The source-of-truth `.xlsx` (`My Needs.xlsx`) stays gitignored.

**Future (v2)**: private tier behind Cloudflare Access pre-seeded with Teddy's actual ratings (build-time fetch from a private source); free-text `actual_detail` / `ideal_detail` fields per source (the spreadsheet has these — short prose explaining where each contribution comes from); longitudinal snapshots (track ratings over time, surface deltas); domain-level reweighting in `metShare` (currently flat across needs).

#### Time Tracker

**Status**: v1 shipped and listed in the `/dashboards` roster. Data is still personal — the Sheets sync requires `PUBLIC_TIMETRACKER_SHEET_ID` and an account that owns that sheet, so a visitor without those just gets the local-only mode in their own browser. Mounted at `/dashboards/time-tracker`. No "public demo" pre-seed planned — this is a personal tool that happens to be reachable.

A personal time tracker for research work (OAIP, SPUR, and any user-made categories). Single user (Teddy). Answers: *how much real time did I put into each thing over any date range, and how is my focus work going?*

**Pages** — internal tabs in a single React component at `/dashboards/time-tracker`:

- **Clock** — clock in/out against a category. While clocked in: live worked-time readout, "Take a break" (a pseudo clock-out for meals/errands that pauses worked time without ending the session), **"Lap"** (mark the end of a segment within the session — a notation only, doesn't change time accounting), and clock out. Each lap and break has an inline editable notes field and can be deleted individually (deleting a break adds its time back to worked time). Clocking out opens a skippable panel to rate the session just ended — mood, productivity, enjoyment (each 1–5) — plus a notes field and an activity picker (what kind of work it was). Manage the category list (add / remove) here.
- **Pomodoro** — a focus-interval countdown (default 25 min, adjustable) with browser-notification + WebAudio chime on completion, a tick counter (today / this week / all-time), and a reward-minutes bank. Each interval completed *while clocked in for real* grants an adjustable number of reward minutes; reward minutes accrue to a bank with a play/stop countdown that spends them. The bank can also be manually adjusted (add / subtract minutes, reset to zero) — there is no automatic daily/weekly reset. Two toggles: auto-start the next interval on completion (default on), and auto-run the timer in lockstep with being clocked in — clocking in starts it, clocking out resets it, a break pauses it, ending the break resumes it (default off). Starting a reward-minutes countdown pauses the focus timer.

A **week strip** is pinned under the tab bar on every tab: this week's net worked time (Sunday-start), filterable to a single category or all.
- **Log** — session history over a chosen date range (custom From/To plus presets: Today, This week, Last 7d, This month, Last 30d, All time) and an optional **category filter** that scopes the stats, chart, and session list. Metrics: total worked, avg per calendar day, avg per working day (+ "worked N of M days"), session count, longest/median/shortest session, total break time and break share of clocked time, and a per-category breakdown (time, session count, % of total, avg/day). The **worked-per-day chart** is a category-stacked bar chart with an hours y-axis, a per-day total label on each bar, a site-styled hover tooltip (per-category breakdown + total), and per-bar weekday/date x-axis labels when the range is ≤ 31 days (endpoints only beyond that). Add / edit / delete of sessions (for backfill and fixing forgotten clock-outs). CSV export of the full session log.

**Data model**:

- `Session` — `id` (UUID), `category`, `clock_in` (ISO), `clock_out` (ISO, null while active), `breaks` (`Break[]`), `notes?`, `mood` / `productivity` / `enjoyment` (self-report ratings, 0 = unrated else 1–5), `activity1` / `activity2` / `activity1Pct` / `activity2Pct` (the top one or two activity types from a fixed taxonomy, each with its own independent 0–100 share of the session — shares need not sum to 100; what kind of work the session was; `category` = which project, activity = which mode of work, orthogonal axes), `created_at`, `updated_at`. Net worked time = (clock-out − clock-in) − Σ break durations.
- `Break` — `id`, `start`, `end` (null = currently on break), optional `notes`. A pseudo clock-out; excluded from net time. Deletable individually (its time becomes worked time).
- `Lap` — `id`, `start`, `end`, optional `notes`. A stopwatch-style marker within a session, from the previous lap's end (or `clock_in`) to the moment Lap was pressed. Purely a notation; doesn't affect net time.
- `Pomodoro` — `id`, `completed_at`, `length_min`, `reward_minutes`, `credited`. One row per completed interval; `credited` true only if clocked in (not on break) at completion.
- `RewardSpend` — `id`, `started_at`, `ended_at`, `minutes`. One row per play→stop of the reward countdown. The reward bank is derived (`Σ credited reward − Σ spent`), never stored as a running total.

**Pomodoro ↔ clock-in link**: the timer is independent (runs anytime) but reward minutes only accrue when clocked in for real (active session, not on break) — evaluated at interval completion and frozen onto `Pomodoro.credited`. Non-credited intervals still count toward the tick total.

**Data persistence**: two-mode, same pattern as Finance.

- **Local-only** (no Sheets config in `.env`, or not signed in): `localStorage` key `tw-timetracker-v1`. Session-log CSV export for backup; "Reset all data" appears only in this mode.
- **Sheets-synced** (signed in): a dedicated private Google Sheet (ID in `PUBLIC_TIMETRACKER_SHEET_ID`) with four tabs — `sessions`, `categories`, `pomodoros`, `reward_spends`. Missing tabs are auto-created on first sync. Per-entity clear+write queue, focus re-pull, and 401 handling as Finance.
- **Auth**: OAuth **authorization-code flow with a server-side refresh token** (shared `src/lib/googleAuth.ts` + `api/auth/*` Vercel functions) — sign in once, sessions last weeks. Replaced the old hourly-expiring implicit flow. See ARCHITECTURE.md "Google sign-in". Needs `GOOGLE_CLIENT_SECRET` + `TOKEN_ENC_KEY` env vars on Vercel.
- Pomodoro preferences and live-timer state are device-local (`tw-timetracker-settings-v1`, `tw-timetracker-timers-v1`) and never synced.

**Required env (when using Sheets sync)**: `PUBLIC_GOOGLE_CLIENT_ID` (the same OAuth client as Finance), `PUBLIC_TIMETRACKER_SHEET_ID` (a separate spreadsheet), plus the server-side `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `TOKEN_ENC_KEY`.

#### Qualitative Coding

**Status**: shipped, **public** (listed in `src/data/dashboards.json` without the `private` flag, so it appears in the `/dashboards` roster and the home Dashboards column). The page renders at `/dashboards/qualitative-coding`. Public-but-data-isolated: there is no Cloudflare Access gate; the URL is reachable to anyone, but the app stores everything in the visitor's own localStorage and the only cloud sync target is the signed-in user's own Google Drive. A stranger landing on the URL gets the empty "create your first project" screen, never the owner's data.

This dashboard deliberately uses a different UI language than the rest of the site — white background, Inter sans-serif, app-style layout — and bypasses `BaseLayout` (no site Nav/Footer). The goal is a clean tool-style interface tuned for text annotation work, not editorial reading.

A personal qualitative-coding tool: organize text documents into projects, build a nested code tree, tag spans of text with codes, group annotations into interpretive **themes**, **grade** coding quality against a rubric, capture per-document Markdown notes, and export the result as JSON or Markdown for AI-comparison work in VS Code. Multi-project, with a cross-project Explore view for aggregating annotations across project boundaries (e.g. "my coding of interviews" vs. "AI's coding of the same interviews" as two projects to compare).

**Six top-level views** (toggle in the TopBar):

- **Documents** — the active project's documents and codes. Sidebar (left, resizable) lists documents grouped by folder (path-style nesting, e.g. `Interviews/Round 1`) with collapsible folder headers, plus the nested code tree. Main pane shows the active document with title + metadata + body; `Codes` / `Themes` toolbar toggles gate which highlight layer renders, and an optional line-view chunks the text by sentence or fixed character count. A right-side **Notes** panel (toggle from the doc toolbar) opens a Markdown editor for personal commentary on the document (separate from the coded body; never appears in annotations).
- **Codebook** — full-page code-tree manager (sidebar hidden). Drag-drop reordering with multi-parent support (Alt-drag adds a parent without removing the old one), collapse/expand, inline editing, alphabetical sort, definitions toggle.
- **Themes** — an analyst-level interpretive layer *above* the codes. Build a hierarchical theme tree; each theme has a Markdown narrative, a set of linked annotations (each toggled **core** vs **supporting**), optional uncoded-text highlights, an "auto-include codes" set, and a multi-axis rating. Themes are the synthesis step after line-by-line coding.
- **Grading** — rubric-rating dashboard for assessing coding quality (built for comparing one project's coding against another, e.g. AI vs analyst). Three tabs: **Codes** (specificity 1–5), **Annotations** (accuracy 1–5, with a per-code drill-down), **Themes** (five axes: grounding / usefulness / independence / interpretation level / prevalence). Ratings live on the entities themselves.
- **Explore** — cross-project annotation browser. Filter by code (hierarchical multi-select across selected projects), folder, metadata field, free-text search of span/note. Headline counts (annotations / unique codes / documents / projects), top-codes chip row, an optional code co-occurrence matrix, then a card list (flat or grouped by code) of every matching annotation with project chip, folder path, doc title, code path, span text, note, theme links, and the doc's metadata. Clicking a card jumps to Documents view focused on that annotation. Projects in view = the active project plus any others ticked via the project-picker checkboxes.
- **Info** — project-level metadata: editable name, a one-line description, and an `About` Markdown doc (Write/Read tabs) for project background, code-tree decisions, research questions, etc. Plus a "Project at a glance" stat strip (docs / codes / annotations / metadata fields) and a created/updated date line.

**Sidebar mechanics**:

- Documents are grouped by `Document.folder` (a path string with `/` separators). Folders render as collapsible groups, nested by path depth. Documents with no folder appear at the top, ungrouped. Each folder group has a "+" button to add a document directly inside it (auto-fills the folder path on the new doc). Editing a document's folder in the doc header (a `📁` input above the title) reparents it.
- Code tree gains a **`defs` toggle** (next to "+ new") that, when on, displays each code's description inline beneath its name. Each code's edit form (pencil icon) now exposes name, description (the definition / when-to-apply guidance), and an inline color palette. Definitions also appear in the selection popover (under each code name) and in the annotations panel below the doc (when an annotation is focused).

**Multi-select projects**: the project picker dropdown gives each project (other than the active one) a checkbox to include it in the Explore aggregation. The active project is always included implicitly. The selection persists in `AppState.exploreProjectIds`.

**Data model**:

- `Project` — `{ version: 1, id, name, description?, about? (markdown), metadataSchema, documents, codes, annotations, themes?, folders?, drive?, created_at, updated_at }`.
- `Document` — `{ id, title, text, kind?, notes? (markdown), folder? (path string), metadata: Record<key, value>, created_at, updated_at }`. Body remains plain text — character offsets matter for annotations.
- `Code` — `{ id, name, parentIds: string[], color, description?, order?, specificity?: 1–5, specificityNotes?, created_at }`. **Multi-parent**: a code can live under more than one parent. `parentIds = []` means top-level. Codebook renders one row per parent context. Drag-drop moves between parents (Alt-drag adds a parent without removing the old one). Annotations stay attached to the single code id, so counts/colors don't double-count. `specificity` is the Grading-view rating.
- `Annotation` — `{ id, docId, ranges: { start, end }[], codeId, note?, accuracy?: 1–5, accuracyNotes?, created_at }`. **Multi-range**: one annotation can group multiple disjoint spans under a single entry. Legacy `{ start, end }` annotations are auto-migrated to `ranges: [{ start, end }]` on load. The selection popover can **add a range to** or **replace ranges on** a focused annotation. `accuracy` is the Grading-view rating.
- `Theme` — `{ id, name, description?, parentIds: string[], color, order?, annotationLinks: { annotationId, role: 'core' | 'supporting' }[], includeCodeIds: string[], uncodedHighlights?, rating?: ThemeRating, created_at }`. A theme groups annotations (and optionally whole codes) into an interpretive cluster with a narrative. `ThemeRating` = `{ grounding?, usefulness?, independence?, interpretationLevel?, prevalence? (each 1–5), notes? }`.
- `MetadataField` — `{ key, label, type: 'text' | 'number' | 'date' | 'enum', options? }`.
- `AppState` — `{ version: 1, projects, activeProjectId }` plus optional UI state: `view` (`documents` | `codebook` | `themes` | `grading` | `explore` | `about`), `exploreProjectIds`, `showCodeDefinitions`, `activeThemeId`, resizable-panel sizes, and per-view collapse/display toggles.

**Persistence**: single `tw-qual-coding-v1` localStorage key. `themes`, `Document.notes`/`folder`/`kind`, `Project.about`/`drive`, and all the rating fields ride inside their parent records. Tolerant import (`coerceProject`) migrates legacy single-`parentId` codes and `{start,end}` annotations forward.

**Google Drive sync** (v3 layout — folder per project):

- Each project syncs to a Drive folder named after the project. Folder is created inside `PUBLIC_QUAL_CODING_DRIVE_FOLDER_ID` if set, otherwise in My Drive root. Inside each project folder:
  - `project.json` — canonical state (machine-readable; the dashboard's source of truth).
  - `project.md` — full project export (all documents + annotation tables).
  - `codebook.md` — code tree with names + definitions.
  - `documents/` — subfolder. Inside, each `Document` is rendered to its own `.md` file, with subfolders mirroring `Document.folder` (e.g. a doc with `folder: "Interviews/Round 1"` lives at `documents/Interviews/Round 1/<title>.md`).
- Only `project.json` carries the `appProperties.tw_qual_coding=v1` tag — that's what `listAppFiles` uses to discover projects. The .md files are read-only exports (the dashboard never reads them).
- **Legacy migration**: v2 wrote a single flat JSON per project directly in the configured folder (or root). On the first v3 sync, `syncProjectToDrive` detects a `drive.fileId` (or a `projectJsonId` whose parent is the configured root), creates a new project folder, moves the legacy file in, renames it to `project.json`, and writes the new derived files alongside.
- OAuth scope `https://www.googleapis.com/auth/drive.file` (file-level — the app only sees files it created or the user explicitly opens with it; *not* full Drive). Scopes are unified with Time Tracker so one sign-in covers both.
- **Auth**: OAuth **authorization-code flow with a server-side refresh token** (shared `src/lib/googleAuth.ts` + `api/auth/*` Vercel functions) — sign in once, sessions last weeks. Replaced the old implicit flow whose silent refresh COOP-broke and forced hourly re-sign-in. See ARCHITECTURE.md "Google sign-in". 401/403 from Drive first attempts a silent refresh, then falls back to a "sign in again" prompt.
- **Sync lifecycle**: on sign-in → `listAppFiles` finds all `project.json` files → pull each → merge into local state (server wins for existing project IDs, local projects without a Drive folder get pushed up). On every project mutation → debounce 800ms, then `syncProjectToDrive(token, project, rootFolderId)` writes the whole project tree to Drive (latest-wins per-project queue). On `window` focus → re-pull all (catches edits from another device). On project delete → delete the whole Drive folder.
- AuthBar in the TopBar shows the current sync state: `local only` (no env var) / `Sign in to sync` (configured but not signed in) / signed-in pill with email + colored sync dot (`idle` green / `syncing` blue pulsing / `error` red / `offline` grey) and a dropdown with synced-project count, last error, **"Refresh from Drive"** (re-pull everything — use after editing on another device), and Sign out.

**Required env (when using Drive sync)**:
- `PUBLIC_GOOGLE_CLIENT_ID` — same OAuth 2.0 Web Client ID used by Finance/Time Tracker. **The Drive API must be enabled** on that Cloud project (separate from the Sheets API enable). Authorized JS origins must cover localhost + the deploy domain.
- `PUBLIC_QUAL_CODING_DRIVE_FOLDER_ID` — *optional*. The Drive folder ID where project files should live (copy the long ID from the folder URL). If unset, files go to My Drive root.

**Export formats** (downloads, complementary to Drive sync; builders in `exporters.ts`):

- `<project>.json` — canonical full-project dump. Round-trips through Import JSON (a fresh project ID is assigned on import; the `drive` link is dropped so the import doesn't try to overwrite an existing Drive file).
- `<project>.md` — Project Markdown. Project name + code-tree listing + every document with metadata, full text, and an annotations table.
- `codebook.md` — code tree with names + definitions. `themes.md` — theme tree with narratives + ratings.
- `<doc>.coded.md` — single-document Markdown for the AI hand-off workflow.

**Editing safety**: when the user switches from `Edit text` back to `Read & code` and the text has shrunk, annotations whose `start` is past the new length are deleted; annotations whose `end` overruns are clamped. Notes (`Document.notes`) and the project About doc (`Project.about`) are free-form Markdown — no offset constraints.

**Future (v3)**: inline `[span]{code}` rendering in per-document Markdown export. PDF import (PDF.js text extraction). Multi-code-per-span shorthand in the popover. Drive conflict resolution beyond "server wins on pull / client wins on write" (e.g. surface diffs when both sides have changed). Code-co-occurrence and intercoder-reliability stats in Explore.

**Public-data conventions**: no source-document content is ever committed to the repo. The dashboard's only persistent stores are localStorage and the user's own Drive — both per-user. Coded transcripts stay in those stores; this is enforced by convention (no scripts read project state from disk).

## Papers and PDFs

PDFs live in `public/papers/<slug>.pdf`. Once dropped in that folder, they're served at `/papers/<slug>.pdf` automatically — no build step.

Research entries reference their paper via `paperUrl: '/papers/<slug>.pdf'` in frontmatter. The detail page surfaces an "Open paper →" link.

Word documents (.docx) should be converted to PDF before upload (Word: File → Save As → PDF). Hosting `.docx` directly causes browsers to download rather than display.

## Site chrome

- **Nav** at the top of every page (brand + section links). Research tab is labeled **My Research** to distinguish it from AI's Research.
- **Footer** at the bottom of every page (replaces the old top-of-page NOW strip). Shows the site's last-updated date (driven by `src/data/now.json`), two download links (`mine ↓` and `ai's research ↓`), and contact links.
- **Content bundles**: two top-level markdown bundles served at build time:
  - `/bundle-mine.md` — every essay, research entry, model writeup, and update (the user's own work).
  - `/bundle-ai-research.md` — every stage of every AI-Research topic (the full LLM Iterate pipeline output).
  - `/bundle-all.md` — both bundles concatenated. Footer surfaces all three (`mine ↓`, `ai's research ↓`, `all ↓`).
- **Per-page downloads**: every content page has a uniform `download as .md` button at the top. Endpoints: `/writing.md`, `/writing/<slug>.md`, `/research.md`, `/research/<slug>.md`, `/models.md`, `/models/<slug>.md`, `/ai-research.md`, `/ai-research/<topic>.md` (whole topic in stage order), `/ai-research/<topic>/<stage>.md`. Shared rendering helpers live in `src/lib/bundle.ts`.

## Out of scope (for now)

- Comments
- Multi-user auth
- CMS / admin UI (content is authored as MDX in repo)
- Search
- Math rendering (KaTeX/MathJax) — can be added later if equations get heavy; for now use code-style monospace

## Decisions log

Major product and architecture turning points only. **Per-stage LLM Iterate refinement history is not logged here** — it lives canonically in each stage's `refinementLog` frontmatter (and in git). Adding a refinement-pass narration to this log would just duplicate that record.

- **2026-04-27**: Pipeline section `/iterate` renamed to `/ai-research` ("AI's Research"); the formal-research tab is labeled **My Research** to distinguish the two.
- **2026-04-27**: Three writing tiers chosen — `mine` / `collab` / `ai-led`, shown as **Me** / **Me x AI** / **AI** chips.
- **2026-04-28**: Adopted the **V4 "Quiet Paper + Editorial Front"** design system (Fraunces + Source Serif 4 + JetBrains Mono; paper/ink/accent tokens). Retired the V3 indigo left-rule-card look. Tokens are locked in `ARCHITECTURE.md`.
- **2026-04-28**: Home and About merged into a single `/`; `/about` redirects to `/`.
- **2026-04-28**: `/research` reorganized into status groups (In Progress / Finished / Planned / Contributions).
- **2026-04-28**: `/updates` (content collection) and `/dashboards` (top-level tab) added.
- **2026-04-28**: Singletons (bio, now-date, dashboard roster, planned AI topics) live in `src/data/*.json` rather than content collections — small, hand-edited, not worth the collection machinery.
- **2026-04-28**: AI's Research topic page is a single page with stage tabs (Overview + per-stage); standalone deep-link `[stage]` routes also exist.
- **2026-04-28**: Top-of-page NOW strip retired in favor of a global **Footer** (last-updated date + bundle downloads + contacts).
- **2026-04-28**: Model titles rewritten in plain language (e.g. "Option Value" → "Why continuing is rational once you exist").
- **2026-04-29**: `/updates` set to a "coming soon" placeholder — the collection + one entry exist, but the index intentionally lists nothing live yet.
- **2026-04-29**: Content bundles + per-page `download as .md` endpoints shipped (`/bundle-mine.md`, `/bundle-ai-research.md`, `/bundle-all.md`, plus per-collection/per-page `.md`); shared helpers in `src/lib/bundle.ts`. Designed for LLM ingestion.
- **2026-05-02**: **Finance** dashboard shipped (v1, public demo), then reframed to **private** (`private: true` in `dashboards.json`, hidden from the roster). Google Sheets sync wired via browser-side OAuth + direct Sheets v4 REST (per-entity clear+write with a coalescing queue); a public demo + self-host writeup is the eventual v3.
- **2026-05-16**: **Time Tracker** dashboard (v1) shipped at `/dashboards/time-tracker` — clock/breaks/laps, Pomodoro with a derived reward bank, per-session ratings + activity tagging, Sheets sync.
- **2026-05**: **Auth migrated** from the GIS implicit-token flow (silent refresh permanently COOP-broken → hourly re-sign-in) to an **OAuth authorization-code flow with a server-side refresh token** — shared `src/lib/googleAuth.ts` + `api/auth/*` Vercel serverless functions, sealed HttpOnly cookie, sessions last weeks. Time Tracker and Qual Coding use it; Finance migration is still pending. See `ARCHITECTURE.md` → "Google sign-in".
- **2026-05/06**: **Qualitative Coding** grew from the v2 coding tool (multi-parent codes, multi-range annotations, Drive folder-per-project sync) into a fuller analysis tool: a **Themes** interpretive layer over annotations and a **Grading** rubric (code specificity, annotation accuracy, five-axis theme ratings) — the TopBar now has six views. Built for comparing one project's coding against another (AI vs analyst).
