# Architecture

## Stack

- **Astro 5.7** static site generator (server adapter optional later for `/dashboards`)
- **Tailwind 3** for styling, `@tailwindcss/typography` for prose
- **MDX** for long-form content (essays, model explanations, AI research stages)
- **React 19** for interactive components (model dashboards)
- **@astrojs/sitemap** for sitemap generation
- **d3-force** for force-directed graph layouts in AI-research topology visualizations (React renders SVG; d3-force only computes positions)

## Folder structure

```
/
├── PRD.md, ARCHITECTURE.md, CLAUDE.md   ← read-first specs
├── stage_outputs/                       ← raw LLM stage outputs (working drafts)
│   └── <topic>/<stage>.md
├── design_handoff_personal_site/        ← V4 design source (reference only)
├── public/
│   ├── favicon.svg
│   └── papers/                          ← published PDFs (papers, posters, working drafts)
│       └── <slug>.pdf
├── src/
│   ├── components/
│   │   ├── Nav.astro                    ← V4 nav (brand + horizontal links, accent active state)
│   │   ├── Footer.astro                 ← global footer (updated date + two bundle downloads + contact)
│   │   ├── SectionLabel.astro           ← Fraunces 18px label + accent "see all →" link, hairline rule below
│   │   ├── GroupHeader.astro            ← shared status-group header used on /research, /models, /ai-research, /dashboards
│   │   ├── TierChip.astro               ← me / me x ai / ai chip (writing tiers)
│   │   ├── DownloadMd.astro             ← uniform "download as .md" button mounted on every content page
│   │   ├── RefinementLog.astro
│   │   ├── models/                      ← React components for interactive models
│   │   │   └── OptionValueDashboard.tsx
│   │   ├── dashboards/                  ← React components for the /dashboards/<slug> apps
│   │   │   ├── finance/                 ← FinanceDashboard.tsx (root, queue), DashboardTab/TransactionsTab/BudgetTab/TransactionForm,
│   │   │   │                               types.ts, categories.ts, compute.ts, storage.ts (localStorage cache + CSV),
│   │   │   │                               sheets.ts (GIS + Sheets REST), spendingLogImporter.ts (one-shot legacy-tab seed), AuthBar.tsx
│   │   │   ├── time-tracker/            ← TimeTrackerDashboard.tsx (root, queue), Clock/Pomodoro/Log tabs, AuthBar.tsx,
│   │   │   │                               types.ts, compute.ts (pure), storage.ts (localStorage cache + CSV), sheets.ts (GIS + Sheets REST + ensureTabs)
│   │   │   └── qualitative-coding/      ← QualitativeCodingDashboard.tsx (root), CodeTree.tsx, DocumentViewer.tsx,
│   │   │                                   MetadataSchemaEditor.tsx, types.ts, compute.ts (pure: tree + segments + color),
│   │   │                                   storage.ts (localStorage + JSON download/import), exporters.ts (JSON + per-doc/project Markdown)
│   │   └── ai-research/                 ← React components for AI-research stage visualizations
│   │       ├── PsychVariationGraph.tsx  ← topology graph (force-directed via d3-force) — pan + wheel-zoom + reset
│   │       ├── PsychVariationModel.tsx  ← model dashboard (variance decomposition + multivariate sex-difference tabs)
│   │       ├── PsychVariationData.tsx   ← data findings panel (six-tab H1–H6 prediction tests, hand-rolled SVG charts)
│   │       ├── PsychVariationExplorer.tsx ← build-stage reader's tool (trait lookup + traps + asymmetric environmental effects)
│   │       ├── AITransitionGraph.tsx    ← topology graph for navigating-ai-world (~50 nodes, 5 variants, pan + wheel-zoom + reset)
│   │       ├── AITransitionModel.tsx    ← model dashboard for navigating-ai-world (integrated ΔNet = ΔV + ΔM with channel decomposition + structural flags + ρ(t) trajectory tab)
│   │       ├── CognitivePartnershipGraph.tsx ← topology graph for technology-utilization-architecture (~66 nodes, 5 variants incl. capability-regime fragility, P-type practitioner nodes + op edge, pan + wheel-zoom + reset)
│       ├── CognitivePartnershipModel.tsx ← model dashboard for technology-utilization-architecture (per-task router with seven presets + day-portfolio four-strategy comparison; V(u,v;θ) generator-verifier loop)
│       └── CognitivePartnershipData.tsx ← data findings panel for technology-utilization-architecture (seven tabs — productivity-record landscape + Q1 CUPS + Q2 Bastani + Q3 mode distribution + Q4 outside-frontier scatter + Q5 workflow swings + Q6 calibration; hand-rolled SVG charts)
│   ├── content/
│   │   ├── blog/<slug>.mdx              ← essays
│   │   ├── research/<slug>.mdx          ← formal research entries
│   │   ├── models/<slug>.mdx            ← model explanations (drafts included)
│   │   ├── updates/<slug>.mdx
│   │   └── ai_research/<topic>/<stage>.mdx
│   ├── content.config.ts
│   ├── data/                            ← singletons (not collections — small, edited-by-hand)
│   │   ├── bio.json                     ← name, credentials (subtitle), blurb, location, contact links
│   │   ├── now.json                     ← `updated` date drives the global Footer (NowStrip retired)
│   │   └── dashboards.json              ← roster of dashboards with status (planned/in-progress/finished)
│   ├── lib/
│   │   └── bundle.ts                    ← shared markdown rendering helpers (bundleHeader, blogToMd, researchToMd, modelToMd, updateToMd, aiStageToMd, section, sortByDate, stripImports)
│   ├── layouts/BaseLayout.astro         ← Nav + slot + Footer, paper bg, flex-column for sticky footer
│   ├── pages/
│   │   ├── index.astro                  ← V4 editorial home (masthead + 3-col index + colophon)
│   │   ├── research.astro
│   │   ├── research/[slug].astro
│   │   ├── writing.astro
│   │   ├── writing/[slug].astro         ← narrow column (640px) + drop cap
│   │   ├── models/
│   │   │   ├── index.astro
│   │   │   └── [slug].astro
│   │   ├── updates/
│   │   │   ├── index.astro
│   │   │   └── [slug].astro
│   │   ├── dashboards/
│   │   │   ├── index.astro              ← roster (links to live dashboards by status)
│   │   │   ├── finance.astro            ← mounts FinanceDashboard with client:only="react"
│   │   │   ├── emotional-wellbeing.astro
│   │   │   ├── time-tracker.astro       ← mounts TimeTrackerDashboard with client:only="react"
│   │   │   └── qualitative-coding.astro ← bypasses BaseLayout: own minimal HTML + white bg + Inter font + client:only QualitativeCodingDashboard
│   │   ├── bundle-mine.md.ts            ← /bundle-mine.md (writing + research + models + updates)
│   │   ├── bundle-ai-research.md.ts     ← /bundle-ai-research.md (every AI-Research stage)
│   │   ├── writing.md.ts                ← /writing.md (all blog as one md file)
│   │   ├── writing/[slug].md.ts         ← /writing/<slug>.md (single post)
│   │   ├── research.md.ts               ← /research.md
│   │   ├── research/[slug].md.ts        ← /research/<slug>.md
│   │   ├── models.md.ts                 ← /models.md
│   │   ├── models/[slug].md.ts          ← /models/<slug>.md
│   │   ├── ai-research.md.ts            ← /ai-research.md
│   │   └── ai-research/
│   │       ├── index.astro
│   │       ├── [topic]/index.astro      ← topic page with stage tabs (Overview + per-stage)
│   │       ├── [topic]/[stage].astro    ← deep-link standalone stage page
│   │       ├── [topic].md.ts            ← /ai-research/<topic>.md (whole topic in stage order)
│   │       └── [topic]/[stage].md.ts    ← /ai-research/<topic>/<stage>.md (single stage)
│   └── styles/global.css                ← font imports, design tokens, .essay-prose / .paper-prose
├── scripts/
│   └── finance_import_xlsx.py          ← one-shot: Finances Sheet.xlsx → CSVs the dashboard imports
├── astro.config.mjs
├── tailwind.config.mjs
└── tsconfig.json
```

## Content collections

Defined in `src/content.config.ts` using the legacy `type: 'content'` API (consistent with the rest of the project).

| Collection | Path glob | Key frontmatter fields |
|---|---|---|
| `blog` | `src/content/blog/*.mdx` | title, description, date, tier, draft, tags |
| `research` | `src/content/research/*.mdx` | title, description, date, status, collaborators, venue, paperUrl, externalUrl, featured |
| `models` | `src/content/models/*.mdx` | title, description, date, status, featured, component, tags |
| `ai_research` | `src/content/ai_research/<topic>/<stage>.mdx` | title, description, date, status, refinementPass, refinementLog |
| `updates` | `src/content/updates/*.mdx` | title, description, date, period, tags, draft |

For `ai_research`, the topic and stage are derived from the file path. The entry slug is `<topic>/<stage>` and is split on `/` in the routes. Collection key matches folder name (Astro's content auto-discovery).

## Routing

Static routes:

- `/` `/about` `/research` `/writing` `/models` `/ai-research`

Dynamic routes via `getStaticPaths()`:

- `/writing/[slug]` — one entry from `blog`
- `/research/[slug]` — one entry from `research`
- `/models/[slug]` — one entry from `models`
- `/ai-research/[topic]` — one topic landing (lists stages)
- `/ai-research/[topic]/[stage]` — one stage
- `/updates/[slug]` — one entry from `updates`

Redirects (in `astro.config.mjs`):

- `/about` → `/`

## AI Research stage convention

Each topic is a folder under `src/content/ai_research/<topic>/`. Inside:

- `overview.mdx` (optional) — topic summary, used as the topic landing page description
- `lit-review.mdx` — stage 1
- `topology.mdx` — stage 2
- `model.mdx` — stage 3
- `data.mdx` — stage 4
- `build.mdx` — stage 5
- `writeup.mdx` — stage 6 (long-form synthesis for an educated lay reader)

`stage_outputs/<topic>/<stage>.md` holds raw LLM outputs that feed each stage. Topic slugs are kebab-case; stage filenames are exactly one of `lit-review`, `topology`, `model`, `data`, `build`, `writeup` (no version suffixes — git provides history). Polished versions move into `src/content/ai_research/<topic>/<stage>.mdx`.

The topic-level `overview.mdx` is **not written during the pipeline**. It is produced or revised only after all six stages are complete; until then the topic page renders the existing overview (or a minimal placeholder for new topics) and the per-stage tabs carry the substance. The writeup stage is the canonical synthesis once the pipeline is done.

**Stage-page status display**: each AI-research stage page (both the topic-tab variant and the deep-link `[stage].astro` variant) shows only the **refinement pass number** (`pass N`) — no `status: in-progress` / `status: complete` text and no color-coded status pills. The `status` frontmatter field still drives the binary "has draft / is stub" coloring of the topic-card stage bars on `/ai-research`, but it is not surfaced as label text anywhere visible to the reader. Pass 0 (untouched stub) renders no pass label at all.

**Topic-card progress display**: topic cards on `/ai-research` (and the topic list on the home page) do not show a "X/N" stage-completion count. The colored stage bars carry the same information visually; the explicit numeric counter was redundant and has been removed.

For the data stage specifically, raw working drafts can be accompanied by a sibling `stage_outputs/<topic>/data/` folder containing the curated input CSVs, the runnable Python pipeline, and a `data/out/` folder with derived outputs. The CSVs are the canonical artifact (one source-cited row per estimate); the Python script is reference code that reproduces every chart on the published `data.mdx`. Stage-5 build artifacts consume the CSVs directly.

**Public data convention.** Once a data-stage CSV is finalized for publication it is copied to `public/data/<topic>/<file>.csv`. Astro serves `public/` as-is, so the file is downloadable at `/data/<topic>/<file>.csv` on the live site. This (a) makes the audit trail visible to visitors, (b) provides a stable URL Stage 5 build artifacts can fetch, and (c) keeps the file tracked in git (the `stage_outputs/` folder is gitignored as raw working state). The pipeline source (`pipeline.py`) and intermediate `out/` files stay in `stage_outputs/` as they are working artifacts, not publication artifacts.

Stage-specific interactive components (D3 graphs for topology, dashboards for model/data) live at `src/components/ai-research/<ComponentName>.tsx` and are mounted in the stage's MDX with `client:load` (wrap in `not-prose` so Tailwind Typography doesn't override styles).

**Topology-graph pan/zoom pattern.** Force-directed topology graphs (`PsychVariationGraph`, `AITransitionGraph`) share a pan-and-zoom interaction. Implementation:

- A full-size transparent `<rect>` is rendered first inside the SVG as the pan capture surface. Because nodes/edges are rendered after, in SVG render order they sit on top — node clicks hit nodes, empty-space clicks hit the rect.
- Nodes and edges are wrapped in an inner `<g transform="translate(${panX},${panY}) scale(${scale})">`. Positions are stored in graph coordinates; the transform handles display.
- A `pointerToGraph` helper applies the inverse transform: `(svgCoord - pan) / scale`. Used inside node drag handlers so dragging continues to feel correct at any zoom.
- `e.stopPropagation()` on node `pointerDown` prevents pan from starting during a node drag (defensive — render order alone already prevents it).
- Wheel handler computes a new scale (clamped to `[0.4, 3]`) and adjusts pan so the cursor's graph position stays fixed under the pointer.
- A `reset view` button restores `panX=panY=0, scale=1`.

Future force-directed components in this directory should follow the same pattern. Both `<svg>` and the pan rect set `touchAction: 'none'` so trackpad gestures don't fight the pan/zoom logic.

Refinement history is stored as an array in frontmatter:

```yaml
refinementLog:
  - pass: 3
    date: '2026-04-27'
    passes: ['gap scan', 'compression']
    why: 'noticed missing connections to free energy literature; intro was bloated'
    changes:
      - 'Added FEP section (~200 words)'
      - 'Compressed intro from 6 paragraphs to 3'
```

Rendered at the bottom of each stage page by `<RefinementLog>`. Newest pass is prepended (top of the array); the rendered log shows passes in reverse-chronological order.

**Frontmatter pass-number convention.** Every refinement pass that makes changes to a stage MUST: (1) increment the integer `refinementPass` field in the stage's frontmatter, (2) prepend a new entry to the `refinementLog` array, and (3) trigger an update to the PRD topic registry only if the *furthest* stage's pass number changed. Refining an earlier stage while a later stage exists does NOT update the registry. A no-op pass (concluded "no refinement needed") does not bump `refinementPass` and does not add a log entry — but the standard REFINEMENT / WHY / CHANGES report still goes to chat with `CHANGES: none`.

## Design system

V4 "Quiet Paper + Editorial Front" — locked tokens. Do not deviate without updating this file. Reference: `design_handoff_personal_site/v4-quiet-paper-plus.jsx`.

### Colors (Tailwind theme + raw)

- `paper` `#f7f3ec` — page background (warm off-white)
- `paper-edge` `#efe9dd` — NOW strip background
- `ink` `#1a1614` — primary text, headlines
- `ink-soft` `#3a342c` — body text, secondary headlines
- `muted` `#7a7166` — metadata, labels, dates
- `rule` `#d9d0bf` — primary hairlines
- `rule-soft` `#e6dfcf` — softer hairlines (between items inside a group)
- `accent` `#8a4a2b` — sienna; links on hover, NOW tag, drop cap, active nav
- `accent-soft` `#c98a6e` — in-progress markers, partial progress bars

The `primary` indigo ramp is retained in the Tailwind config but unused in V4. Don't reach for it.

### Typography

- `font-display` — Fraunces (variable, opsz 9..144), used for all headlines and brand
- `font-serif` — Source Serif 4, body and most metadata
- `font-mono` — JetBrains Mono, labels / dates / chips / "→" affordances

Loaded via Google Fonts at the top of `global.css`.

### Containers

- **Home**: `max-w-[1080px]` with `px-8 pt-12 pb-20`
- **Inner index/detail**: `max-w-[760px]` with `px-8 pt-14 pb-24`
- **Essay reader**: `max-w-[640px]` (narrow) with `px-8 pt-14 pb-24`

### Patterns

- **Section label** (column heading on home): Fraunces 18px ink + accent `see all →` mono link, hairline rule below — see `SectionLabel.astro`.
- **Group header** (status sections on /research, /models, /ai-research): Fraunces 18px label + count on the right, hairline rule below. No `§ N` numeral — see `GroupHeader.astro`.
- **Eyebrow / status pills**: mono 10px uppercase letter-spacing 0.12em. Live = accent border + accent text; Draft/Planned = rule border + muted text.
- **Tier chip** (writing tier): mono 10px uppercase, rule border, muted text. Labels: `me` / `me x ai` / `ai` (mapped from `mine` / `collab` / `ai-led`) — see `TierChip.astro`.
- **Paper / external CTAs**: `font-mono text-[13px] font-semibold uppercase` border-button — accent border + accent text, hover fills accent. Used on /research index, detail, and home Research column.
- **Item separator** (writing/models/updates/dashboards lists): `border-t border-rule` between items, plus `border-b` on the last item to close the list.
- **No left-rule cards** (the V3 indigo `border-l-2 border-primary-200` pattern is retired).
- **Active link**: italic + accent + `underline underline-offset-4`. Inactive nav: `text-ink-soft`, hovers to `text-accent`.
- **Hover**: linked titles transition `color` over `0.18s` to `text-accent`. Featured-essay title underlines on hover instead of color-shifting.
- **Selection**: `rgba(179, 51, 31, 0.18)` (sienna at low alpha), set in `global.css`.

### Prose styles

`prose prose-gray` from `@tailwindcss/typography` is **not** used (it ships its own colors and rhythm that fight the paper aesthetic). Two custom prose classes live in `global.css`:

- `.essay-prose` — for `/writing/[slug]`. 18px Source Serif body, 21px lead paragraph, drop cap on first paragraph (76px Fraunces accent, floated). 1.75 line-height, generous paragraph spacing.
- `.paper-prose` — for research/model/update/stage detail pages. 16px Source Serif body, 1.7 line-height, no drop cap.

Both styles use ink/ink-soft/muted/rule/accent tokens consistently.

### Footer

`Footer.astro` is mounted in `BaseLayout.astro` after the main slot. It reads `src/data/now.json` for the `updated` date (the previous top-of-page NOW strip is retired) and `src/data/bio.json` for contact links. Three slots: left (`updated <date>` + a download link to `/content-bundle.md`), right (email / substack / github). Border-top `rule`, `font-mono text-[11px]`, all in muted/ink-soft.

### Content bundles + per-page downloads

Static endpoints that prerender to `.md` files at build time. All endpoints share helpers in `src/lib/bundle.ts` (header/footer rendering, MDX import-stripping, per-collection serializers).

**Top-level bundles** linked from the global Footer:

- `/bundle-mine.md` — `blog` + `research` + `models` + `updates` (the user's own writing/research). Source: `src/pages/bundle-mine.md.ts`.
- `/bundle-ai-research.md` — every stage of every `ai_research` topic (the full LLM Iterate output). Source: `src/pages/bundle-ai-research.md.ts`.

**Per-page downloads** mounted on every content page via `DownloadMd.astro` (a uniform top-of-page button):

- `/writing.md`, `/writing/<slug>.md` — all writing / single post.
- `/research.md`, `/research/<slug>.md` — all research / single entry.
- `/models.md`, `/models/<slug>.md` — all models / single model.
- `/ai-research.md`, `/ai-research/<topic>.md`, `/ai-research/<topic>/<stage>.md` — all AI's Research / whole topic / single stage.

The per-stage AI's Research endpoint excludes `overview` entries from `getStaticPaths`; the topic-level endpoint pulls all stages in pipeline order (`lit-review → topology → model → data → build → writeup`).

Bundle output strips MDX `import` lines and component embeds — just title/date/status header plus the body. Designed for an LLM to ingest as one document.

## Interactive components

Mounted in MDX with `client:load`:

```mdx
import OptionValueDashboard from '../../components/models/OptionValueDashboard';

<OptionValueDashboard client:load />
```

Each dashboard is its own `.tsx` file in `src/components/models/`. Style with Tailwind classes inside JSX (Tailwind processes `.tsx` via the `content` glob in `tailwind.config.mjs`).

Wrap interactive components in `not-prose` so Tailwind Typography doesn't override their styles when embedded in MDX.

## Papers (PDFs)

Drop a PDF into `public/papers/<slug>.pdf` — it's served at `https://theodorewright.dev/papers/<slug>.pdf`. No build step needed; Astro serves `public/` as-is.

To attach a paper to a research entry, set `paperUrl: '/papers/<slug>.pdf'` in that entry's frontmatter. The detail page renders an "Open paper →" link in the header.

**For Word documents**: convert to PDF first (Word: File → Save As → PDF). Don't host `.docx` directly — browsers download instead of displaying, and the file stays editable, which is rarely what you want for a published artifact.

## Auth strategy & dashboards

- Static for everything public
- `/dashboards/*` will be protected by **Cloudflare Access** when those routes get built. No server code required — Cloudflare sits in front of the static deploy and challenges visitors to authenticate.

### Dashboard data tiers

Two tiers per dashboard:

| Tier | URL | Data source | Audience |
|---|---|---|---|
| **Public demo** | `/dashboards/<name>` | localStorage (visitor's browser) + CSV import/export | Anyone — interact with the model using their own data, no auth |
| **Private** | `/dashboards/<name>/me` (or same URL gated) | Teddy's own data (private Google Sheet via API key, or static JSON in a gated path) | Teddy only, via Cloudflare Access |

**Public demo pattern**: the React dashboard component takes a `data` prop. On the public route, data starts as a small synthetic example or empty state, persists to `localStorage` per visitor, and offers Import CSV / Export CSV buttons. Visitors play with the model without an account.

**Private pattern**: the same component receives Teddy's data fetched at build time (or runtime via a Cloudflare Worker if it needs to be live). Build-time fetch from a private Google Sheet via service account is the simplest path.

Most dashboards should ship as public demos first; the private tier is added only when the dashboard accumulates real personal data worth restricting.

### Dashboard component layout

Each dashboard's React code lives under `src/components/dashboards/<slug>/`, with the entry component named after the dashboard (e.g. `FinanceDashboard.tsx`). The Astro page at `src/pages/dashboards/<slug>.astro` is a thin wrapper that mounts the entry component with `client:only="react"` (not `client:load` — these dashboards rely on `localStorage`, which doesn't exist during SSR/build).

Internal directory convention for a dashboard:

```
src/components/dashboards/<slug>/
├── <Slug>Dashboard.tsx     ← entry: tab router + state + persistence
├── types.ts                ← shared TypeScript types for entities
├── categories.ts           ← taxonomy / config (where applicable)
├── storage.ts              ← localStorage read/write + CSV import/export
├── compute.ts              ← pure functions (aggregations, variance, etc.)
└── *Tab.tsx                ← one component per top-level tab
```

Compute-layer rules: every function is pure (data in, derived out, no side effects, no hidden date state — pass "today" explicitly). Division by zero returns `null`, never `Infinity`/`NaN`/sentinel strings; UI renders `null` as `—`. Money is rounded to two decimals at the render boundary only.

Persistence rules: load from `localStorage` once on mount, persist on every state change after hydration. Re-fetch on `window` `focus` so a tab open in two windows stays in sync. Never write to `localStorage` during SSR (guard with `typeof window === 'undefined'`).

### Finance dashboard specifics

Lives at [src/components/dashboards/finance/](src/components/dashboards/finance/). Mounted at `/dashboards/finance`. v1 is **private** (hidden from `/dashboards` roster via `private: true` in `dashboards.json`). Two persistence modes: local-only (no env vars set or signed out) and Sheets-synced (signed in to a Google account that owns the configured sheet).

**Storage key**: `tw-finance-v1` (a single JSON object containing transactions, budgets, incomes). Schema is versioned via the `version` field on the persisted object so future migrations have a hook.

**CSV format** (one file per entity; each round-trips through Import/Export):

| Entity | Headers (in order) |
|---|---|
| Transactions | `id,date,item,amount,account,category,notes,created_at,updated_at` |
| Budgets | `category,monthly_amount,effective_from` |
| Incomes | `id,source,monthly_amount,effective_from` |

Headers are authoritative on import; column order doesn't matter. Quoted fields with embedded commas/newlines/quotes are supported (`""` escapes a quote inside a quoted field).

**Budget versioning**: editing a category creates a new `Budget` row with today's date as `effective_from` rather than mutating the old row. `currentBudgets(budgets, ym)` picks the most-recent row per category whose `effective_from` is on or before the first day of the target month, so historical month views naturally use the budget that was in effect then. Same convention for `Income`.

**Category taxonomy**: source of truth at [src/components/dashboards/finance/categories.ts](src/components/dashboards/finance/categories.ts). Three-level (Broad → Mid → Detailed). The detailed string is the persistent key stored on `Transaction.category`; it must round-trip via `isValidCategory`. Renaming a leaf strands existing transactions under "Uncategorized" (surfaced as a sienna-tinted bucket on the Dashboard tab).

**Spreadsheet importer** at [scripts/finance_import_xlsx.py](scripts/finance_import_xlsx.py) converts the user's `Finances Sheet.xlsx` (the existing spreadsheet workflow) into `transactions.import.csv` + `budgets.import.csv` shaped for the dashboard's CSV importer. Account remap (`Debt` → `Debit`) and category remap (`ChatGPT` → `AI Subscription`, `OneDrive` → `One Drive`, `Car Maintenence` → `Car Maintenance`) live in dictionaries at the top of the script — extend them as the spreadsheet evolves. The script is one-shot; the dashboard does not depend on it at runtime.

**Personal data hygiene**: never seed the public route with real financial data. `.gitignore` excludes `Finances Sheet*.xlsx`, `My Needs*.xlsx`, `*.private.csv`, and `finance-data-local/`. The user can keep their `.xlsx` in project root for context without risk of committing. `.env` (holding Sheets config) is also gitignored.

**Google Sheets sync** (when signed in): see [src/components/dashboards/finance/sheets.ts](src/components/dashboards/finance/sheets.ts). Browser-side OAuth via Google Identity Services (script lazy-loaded on first sign-in attempt; no SDK dependency). Token in `sessionStorage` with a 60-second safety margin on expiry; scope is `https://www.googleapis.com/auth/spreadsheets email profile`. Sheets v4 REST endpoints called directly with `fetch` + `Authorization: Bearer <token>`. No service account, no Cloudflare Worker, no client secret in this repo.

**Sheet schema**: three tabs in the workbook identified by `PUBLIC_FINANCE_SHEET_ID`, with header row in row 1:

| Tab | Headers (canonical order) |
|---|---|
| `transactions` | `id,date,item,amount,account,category,notes,created_at,updated_at` |
| `budgets` | `category,monthly_amount,effective_from` |
| `incomes` | `id,source,monthly_amount,effective_from` |

Reads are tolerant of column reorders (matched by header name via `rowsToObjects`). Writes use the canonical order — every write rewrites the header row too. Existing tabs (`Current Budget`, `Spending Log`, `Dashboard`) are not touched by the dashboard except for the one-shot read in `spendingLogImporter.ts` which reads the legacy `Spending Log` tab to seed historical transactions.

**Write strategy**: per-entity `clear + write-all` on every mutation. Simpler than per-row diffs (no row-index tracking), resilient to manual sheet edits, and at <1000 rows the round-trip is well under 2s. A per-entity coalescing queue (`pending` + `inflight` refs in `FinanceDashboard.tsx`) collapses bursts of edits into a single write — pending payload is overwritten by the latest, in-flight writes don't block UI updates, and writes serialize per entity so out-of-order completion can't desync the sheet.

**Lifecycle**: on mount, `localStorage` hydrates immediately for fast UI; if a stored token exists in `sessionStorage`, a full pull replaces in-memory state. On sign-in, same full pull. On every state mutation that originates in the dashboard, the affected entity gets queued for write. On `window.focus`, full re-pull (cross-tab edits, manual sheet edits). On `SheetsAuthError` (401/403), token cleared and user prompted to re-sign-in; in-memory state stays intact.

**One-time historical seed**: when signed in and the `transactions` tab is empty, the Transactions tab surfaces a "Seed from Spending Log" callout. Calls `fetchSpendingLog` (mirrors the Python importer at [scripts/finance_import_xlsx.py](scripts/finance_import_xlsx.py) — keep them in sync if the legacy schema changes), confirms with the user (showing imported count, skipped count, and any unknown categories that'll show as "Uncategorized"), then writes the result to the new `transactions` tab.

**Required env**:
- `PUBLIC_GOOGLE_CLIENT_ID` — OAuth 2.0 Web Client ID from Google Cloud Console (Sheets API enabled; authorized JS origins must include `http://localhost:4321` for dev and `https://teddy-wright.com` for prod)
- `PUBLIC_FINANCE_SHEET_ID` — the long ID from the sheet URL between `/d/` and `/edit`
- The `PUBLIC_` prefix exposes them to the client bundle (Astro convention). The OAuth client *secret* is never used (browser-side flow doesn't need it) and must not be committed.

**Auth UI**: [src/components/dashboards/finance/AuthBar.tsx](src/components/dashboards/finance/AuthBar.tsx) lives in the dashboard's app top-bar. Four states: `local only · sync not configured` (no env vars), `Sign in to sync` (configured, no token), signed-in row with sync indicator (synced / syncing / error / offline) + email + sign out + retry-on-error. The "Reset all data" button is hidden when signed in — sheet is the source of truth, so a local reset would just trigger a re-pull on next focus.

### Emotional Well-being dashboard specifics

Lives at [src/components/dashboards/emotional-wellbeing/](src/components/dashboards/emotional-wellbeing/). Mounted at `/dashboards/emotional-wellbeing`. v1 is public-demo only.

**Files**: `EmotionalWellbeingDashboard.tsx` (entry; tab router, state, persistence, all sub-components inline), `types.ts` (Need / Domain / Source / DataState + label maps), `seed.ts` (25 starter needs across 8 domains, names + domains only, ratings unset; trimmed from an earlier 35 to remove near-synonyms and fill two gaps), `storage.ts` (localStorage + CSV round-trip with field coercion), `compute.ts` (pure: `leverage`, `rankedByLeverage`, `domainRollups`, `sourceGaps`, `distribution`, `metShare`).

**Storage key**: `tw-emotional-wellbeing-v1` — a single JSON object `{ version: 1, needs: Need[] }`. Schema versioned via `version` for future migrations. On load, every persisted need is coerced through `coerceNeed` (clamps numeric ranges, validates domain enum, defaults missing source allocations to 0) so a stray hand-edit can't crash the UI.

**Data model** (`types.ts`):

- `Need` = `{ id, name, domain, priority (0–5), currentlyMet (0–7), sources: Record<Source, { actual, ideal }> }`. `0` on either scale = unset; needs with both > 0 are "rated" and feed into the insights.
- `Domain` is one of 8 fixed strings (Purpose / Contribution, Relational / Social, Cognitive / Intellectual, Emotional, Creative, Physical, Spiritual / Existential, Autonomy / Agency). Adding/renaming a domain means editing `DOMAINS` in `types.ts` — old persisted needs that reference a removed domain fall back to `'Emotional'` via `coerceNeed`.
- `Source` is one of 6 fixed strings (`self / friends / romantic / activities / career / other`).
- `SourceAlloc.actual` and `.ideal` are independent 0–100 scalars; they don't have to sum to anything (the UI just notes when ideal totals look off).

**CSV format** (one file, one row per need; round-trips through Import/Export):

| Headers (in order) |
|---|
| `id,name,domain,priority,currently_met,self_actual,self_ideal,friends_actual,friends_ideal,romantic_actual,romantic_ideal,activities_actual,activities_ideal,career_actual,career_ideal,other_actual,other_ideal` |

Headers are authoritative on import; column order doesn't matter. Same quoting rules as the finance CSVs. Rows missing `id` or `name` are skipped silently; out-of-range numerics are clamped.

**Compute layer** — every function in `compute.ts` is pure (no `Date.now`, no side effects). The four insights views read from the same source-of-truth `needs` array each render:

- `leverage(n) = priority × (8 − currently_met)` → ranks Leverage view.
- `domainRollups(needs)` → groups by `Need.domain`, returns avg priority/met, total leverage, and the top-leverage need's name per domain.
- `sourceGaps(needs)` → for each source, sums `priority × actual` and `priority × ideal` across rated needs and returns the gap (`weightedIdeal − weightedActual`); positive = source under-contributing.
- `metShare(needs)` → priority-weighted average of `currently_met / 7` over rated needs; the headline 0..1 score.

**Personal data hygiene**: never seed the public route with the user's actual ratings. `.gitignore` already excludes `My Needs*.xlsx` (covered by the finance entry).

### Time-tracker dashboard specifics

Lives at [src/components/dashboards/time-tracker/](src/components/dashboards/time-tracker/). Mounted at `/dashboards/time-tracker`. v1 is **private** (`private: true` in `dashboards.json`, hidden from the roster). Three UI tabs: **Clock**, **Pomodoro**, **Log**.

**Files**: `TimeTrackerDashboard.tsx` (entry — tab router, state, 4-entity sync queue, the shared 1-second clock), `ClockTab.tsx` / `PomodoroTab.tsx` / `LogTab.tsx`, `WeekStrip.tsx` (always-visible week total pinned under the tab bar), `RatingRow.tsx` (shared 1–5 rating scale), `ActivityPicker.tsx` (shared activity-type picker with split sliders), `types.ts`, `compute.ts` (pure derivations + formatters), `storage.ts` (localStorage + session-log CSV export), `sheets.ts` (GIS OAuth + Sheets REST + `ensureTabs`), `AuthBar.tsx`.

**Data model** (`types.ts`):

- `Session` = `{ id, category, clock_in, clock_out (null = active), breaks: Break[], laps: Lap[], notes?, mood, productivity, enjoyment, activity1, activity2, activity1Pct, activity2Pct, created_at, updated_at }`. All datetimes are ISO strings. `mood`/`productivity`/`enjoyment` are self-report ratings (0 = unrated, else 1–5), prompted at clock-out by a skippable panel in `ClockTab` and editable in the Log form; both UIs use the shared `RatingRow` component. `activity1`/`activity2` are up to two values from the fixed `ACTIVITY_TYPES` taxonomy (in `types.ts`, with one-line `ACTIVITY_DEFINITIONS`) and `activity1Pct`/`activity2Pct` are each activity's own independent 0–100 share of the session (they need not sum to 100) — picked via the shared `ActivityPicker` (a per-activity slider, shown once that activity is selected). Activity is orthogonal to `category`: category = which project, activity = which mode of work. Reads/`loadState` default missing rating/activity fields (rating 0, activity `''`, pcts 100/50) so rows that predate these features stay valid.
- `Break` = `{ id, start, end (null = on break now), notes? }`. A break is a "pseudo clock-out" (meal/errand) that pauses worked time without ending the session. **Net** worked time = gross (clock-out − clock-in) − Σ break durations. Breaks are deletable individually (their time returns to worked time) and editable for notes; the active break is also surfaced in the on-break header on the Clock tab.
- `Lap` = `{ id, start, end, notes? }`. A stopwatch-style segment marker within a clock-in session, from the previous lap's end (or `clock_in` for the first lap) to the moment Lap was pressed. Doesn't affect time accounting — purely a notation for what was done in that segment. Stored as `laps_json` on the session row; rendered on the Clock tab via the shared `SegmentList` (also used for breaks and reused in the Log edit form).
- `Pomodoro` = `{ id, completed_at, length_min, reward_minutes, credited }`. One row per completed interval. `credited` is true only when the user was clocked in **and not on break** at completion — only credited intervals add reward minutes.
- `RewardSpend` = `{ id, started_at, ended_at, minutes }`. One row per play→stop run of the reward countdown.
- The **reward bank** is fully derived (never stored as a running total): `Σ credited reward_minutes − Σ spend minutes`, floored at 0.

**Storage**: three localStorage keys. `tw-timetracker-v1` is the synced data cache (`{ version, sessions, categories, pomodoros, rewardSpends }`). `tw-timetracker-settings-v1` holds Pomodoro preferences (interval length, reward-min per interval) and `tw-timetracker-timers-v1` holds live-timer state (`pomodoroEndsAt` / `pomodoroRemainingSec` / `rewardPlayStartedAt`, epoch ms so a refresh resumes mid-interval). **Settings and timers are device-local and never synced** — a running countdown belongs to one device.

**Sheets sync**: same browser-side GIS OAuth pattern as the finance dashboard (token in `sessionStorage`, scope `spreadsheets email profile`, per-entity `clear + write-all` with a latest-wins coalescing queue, full pull on sign-in and `window.focus`). Four tabs, headers in row 1:

| Tab | Headers (canonical order) |
|---|---|
| `sessions` | `id,category,clock_in,clock_out,breaks_json,laps_json,notes,mood,productivity,enjoyment,activity1,activity2,activity1_pct,activity2_pct,created_at,updated_at` |
| `categories` | `name` |
| `pomodoros` | `id,completed_at,length_min,reward_minutes,credited` |
| `reward_spends` | `id,started_at,ended_at,minutes` |

`breaks_json` is the JSON-encoded `Break[]` for a session — breaks are a small 1-to-many list always loaded and edited with their parent session, so a dedicated sub-tab would be overkill. This is the one deliberate departure from finance's flat-columns-only convention. `ensureTabs()` creates any missing tabs on a fresh spreadsheet, so first-time setup only needs an empty sheet (no manual tab creation). Reads tolerate column reorders; writes rewrite the header row.

**Required env**: `PUBLIC_GOOGLE_CLIENT_ID` (the same OAuth client the finance dashboard uses — Sheets API enabled, authorized origins cover localhost + prod) and `PUBLIC_TIMETRACKER_SHEET_ID` (a separate private spreadsheet's ID). If either is unset the dashboard runs local-only (localStorage, no sync).

**Pomodoro ↔ clock-in link**: the timer is independent (its own tab, runs anytime), but reward minutes only accrue when clocked in "for real". `compute.isClockedInReal` (active session && not on break) is evaluated at the instant an interval completes and stored as `Pomodoro.credited`. A non-credited interval still counts toward the tick total but grants 0 reward minutes. Interval completion fires a browser notification (permission requested on first Start, or when the auto-run toggle is switched on) plus a two-tone WebAudio chime (helpers in `notify.ts`) — both only while the browser tab is open. **Completion is detected by an effect in `TimeTrackerDashboard` (which stays mounted on every dashboard tab), not in `PomodoroTab`** — so the notification, chime, reward credit, and auto-start fire even when the user is on the Clock or Log tab. A `firedFor` ref keyed on the `pomodoroEndsAt` value guarantees one fire per interval.

`settings.autoRunWhenClockedIn` (default off) optionally couples the timer to the clock: the clock-in/out/break handlers in `TimeTrackerDashboard` start / reset / pause / resume the Pomodoro timer via functional `setTimers` updaters. The coupling fires only on those clock *events* — toggling the setting mid-session doesn't retroactively start the timer. Starting a reward-minutes countdown also pauses a running focus timer (it stays paused; resume is manual).

**Reward bank** is fully derived and the only way it changes is reward-spend rows. Manual adjustments (add / subtract minutes, reset to zero) are written as `reward_spends` rows with the convention that a *negative* `minutes` adds to the bank, a positive one subtracts, and a row equal to the current bank resets it. No schema change, no stored running total, no automatic daily/weekly reset.

**Compute layer** (`compute.ts`) is pure: `now` (epoch ms) is always passed in, never read from `Date` inside. The dashboard runs one shared 1-second interval and threads `now` to every tab so all live timers read a consistent instant.

**Personal data hygiene**: the time-tracker has no public route, so there is no synthetic seed to protect. Default categories (`OAIP`, `SPUR`) seed an empty `categories` tab on first sync.

### Qualitative Coding dashboard specifics

Lives at [src/components/dashboards/qualitative-coding/](src/components/dashboards/qualitative-coding/). Mounted at `/dashboards/qualitative-coding`. v1 is **private** (`private: true` in `dashboards.json`, hidden from the roster).

**Layout deviation**: this is the one dashboard whose page does *not* use `BaseLayout`. [src/pages/dashboards/qualitative-coding.astro](src/pages/dashboards/qualitative-coding.astro) declares its own minimal `<html>/<body>` with a white background, loads `global.css` for Tailwind, pulls in Inter from Google Fonts, and mounts the dashboard at full viewport (`100vh × 100vw`). The site Nav/Footer are deliberately absent — this is a text-annotation tool that needs maximum vertical space and a UI language distinct from the editorial paper aesthetic. The "← Dashboards" affordance is rendered inside the dashboard's own TopBar.

**Files**:

- `QualitativeCodingDashboard.tsx` — root component. Owns `AppState` (in localStorage), the active project / document / code selection, all CRUD handlers, the schema-editor modal, the export menu, and the JSON import file input. Composes `TopBar` + `Sidebar` + `DocumentViewer` (or `EmptyDocPane`) + `MetadataSchemaEditor`. The `NoProjects` empty state replaces the entire UI before the first project is created.
- `CodeTree.tsx` — recursive renderer of the code tree. Per-row inline rename (double-click), color swatch (click to open a 12-color palette popover, "inherit" clears to null), "+" to add a child, "×" to delete (cascades to descendants + dependent annotations after a `confirm`). Top-level "+ new" adds a root code.
- `DocumentViewer.tsx` — the meat. Title input + per-schema-field metadata inputs at the top. A two-state mode toggle (`Read & code` vs `Edit text`): edit mode is a plain `<textarea>`; read mode renders text as segments produced by `segmentText` from `compute.ts`. Selection is captured on `mouseUp`/`keyUp` using `document.createRange()` + `Range#toString().length` to map DOM selection back to character offsets in the original text (works across the span-segmented DOM because `Range#toString()` concatenates text-node content). When the selection is non-empty inside the container, a `SelectionPopover` (a `forwardRef` component) opens anchored to the selection's bounding rect; it searches the flattened code tree and commits the annotation on click or Enter. Below the text, `AnnotationsPanel` lists every annotation for the doc with a click-to-focus interaction (focused → its segment gets a thicker underline; opens an editable note textarea).
- `MetadataSchemaEditor.tsx` — modal for editing the per-project metadata schema. Add/rename/delete fields, change type (`text` / `number` / `date` / `enum`), edit comma-separated options for enums. Field `key` is derived from the label (slugified) once and never changes after creation.
- `types.ts` — `SchemaVersion`, `MetadataField`, `Document`, `Code`, `Annotation`, `Project`, `AppState` plus the 12-color `PALETTE` constant.
- `storage.ts` — `loadState` / `saveState` with a single localStorage key, `coerceProject` for tolerant JSON import, `cryptoRandomId`, `newProject`, `downloadJSON` / `downloadText` (Blob → anchor click → revoke), `readFileAsText`.
- `compute.ts` — pure: `buildCodeTree` (parentId map → recursive nodes), `flattenTree`, `codePath` / `codePathString` (root → leaf), `descendantIds` (transitive closure, for cascade delete / filter), `resolveColor` (walk up to find inherited color), `nextPaletteColor` (next unused palette color for new top-level codes), `segmentText` (split text at annotation boundaries → text segments each tagged with the covering annotations), `annotationsForDoc`, `codeCounts` / `deepCodeCounts`, `findDoc`. `segmentText` is the key piece — every rendering decision in `DocumentViewer` reads off its output.
- `exporters.ts` — pure builders for the three export shapes (`exportProjectJSON`, `exportProjectMarkdown`, `exportDocumentMarkdown`). Markdown table escapes pipes in span text and code paths.

**Storage**: one localStorage key, `tw-qual-coding-v1`. Schema `{ version: 1, projects: Project[], activeProjectId: string | null }`. On import, the entire incoming project is reassigned a fresh `id` to avoid colliding with an existing project of the same id. All mutations go through `updateActiveProject(p => ...)` which immutably replaces the active project in `state.projects` and stamps `updated_at`.

**Selection-offset technique**: the document is rendered as a sequence of `<span>` text nodes (annotated segments) inside a single container `<div>`. The container has no other non-text descendants. To map a `Selection`'s `startContainer/startOffset` (a text node inside one of those spans) back to a character offset in `Document.text`:

```ts
const range = document.createRange();
range.selectNodeContents(container);
range.setEnd(node, offset);
const charOffset = range.toString().length;
```

This works because `Range#toString()` returns the concatenated text content of everything in the range. No tree walker, no manual offset accumulation, no `<br>` / non-text-node edge cases (the container holds only text-bearing spans).

**Future**: Google Drive sync (one JSON file per project, browser-side OAuth using Drive REST + the same GIS pattern Finance/Time Tracker use for Sheets). Until then, the dashboard is local-only — Export JSON is the only way to back up.

## Build / deploy

- `npm run dev` — local at http://localhost:4321
- `npm run build` — static output to `dist/`
- Deployed at **https://teddy-wright.com**. (Hosting platform recorded here when known — Cloudflare Pages is recommended if Cloudflare Access ever gets used to gate `/dashboards/*` private dashboards.)

## Known pitfalls

- React 19 + Astro 5: ensure `client:load` (or another client directive) on interactive components inside MDX
- Content collection schema changes require a dev server restart
- MDX files importing React components require the `@astrojs/mdx` integration (configured)
- Tailwind classes inside React `.tsx` need the file to be in the `content` glob in `tailwind.config.mjs` (already covered by `**/*.{...,tsx}`)
- Equation rendering: not yet wired. Use code-style inline (`G - B + w(E - C)`) until KaTeX is added.
- Dashboards backed by `localStorage` must mount with `client:only="react"`, not `client:load`. With `client:load` Astro pre-renders the component on the server, where `window.localStorage` is undefined; the dashboard would either crash or hydrate with a one-frame "empty data" flash before localStorage loads. `client:only` skips SSR entirely.
