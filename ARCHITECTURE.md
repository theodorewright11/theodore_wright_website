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
├── api/auth/                            ← Vercel Node serverless functions for the OAuth code-flow
│   ├── _lib.js                          ← crypto / cookie / token helpers
│   ├── exchange.js, refresh.js, signout.js
├── vercel.json                          ← COOP header (same-origin-allow-popups) for the sign-in popup
├── stage_outputs/                       ← raw LLM stage outputs (working drafts; gitignored)
│   └── <topic>/<stage>.md
├── design_handoff_personal_site/        ← V4 design source (reference only)
├── public/
│   ├── favicon.svg
│   └── papers/                          ← published PDFs (papers, posters, working drafts)
│       └── <slug>.pdf
├── src/
│   ├── components/
│   │   ├── Nav.astro                    ← V4 nav (brand + horizontal links, accent active state)
│   │   ├── Footer.astro                 ← global footer (updated date + bundle downloads + contact)
│   │   ├── SectionLabel.astro           ← Fraunces 18px label + accent "see all →" link, hairline rule below
│   │   ├── GroupHeader.astro            ← shared status-group header used on /research, /models, /ai-research, /dashboards
│   │   ├── StatusPill.astro             ← small status badge (live / planned / soft tones) used on the home index columns
│   │   ├── TierChip.astro               ← me / me x ai / ai chip (writing tiers)
│   │   ├── DownloadMd.astro             ← uniform "download as .md" button mounted on every content page
│   │   ├── RefinementLog.astro
│   │   ├── NowStrip.astro               ← retired top-of-page NOW strip; file kept but no longer imported anywhere
│   │   ├── models/                      ← React components for interactive models
│   │   │   └── OptionValueDashboard.tsx
│   │   ├── dashboards/                  ← React components for the /dashboards/<slug> apps
│   │   │   ├── finance/                 ← FinanceDashboard.tsx (root, queue), DashboardTab/TransactionsTab/BudgetTab/TransactionForm,
│   │   │   │                               types.ts, categories.ts, compute.ts, storage.ts (localStorage cache + CSV),
│   │   │   │                               sheets.ts (GIS + Sheets REST), spendingLogImporter.ts (one-shot legacy-tab seed), AuthBar.tsx
│   │   │   ├── time-tracker/            ← TimeTrackerDashboard.tsx (root, queue, googleAuth code-flow), Clock/Pomodoro/Log tabs,
│   │   │   │                               WeekStrip/RatingRow/ActivityPicker/TimeStepper, AuthBar.tsx, notify.ts (chime + notification),
│   │   │   │                               types.ts, compute.ts (pure), storage.ts (localStorage cache + CSV), sheets.ts (Sheets REST + ensureTabs)
│   │   │   └── qualitative-coding/      ← QualitativeCodingDashboard.tsx (root, 6-view router, Drive sync queue, googleAuth code-flow).
│   │   │                                   Views: DocumentViewer.tsx (+Notes panel), CodebookView.tsx, ThemesView.tsx, GradingView.tsx,
│   │   │                                   ExploreView.tsx (cross-project filter+stats+co-occurrence), ProjectAboutView.tsx.
│   │   │                                   Shared: CodeTree.tsx, HierarchicalCodePicker.tsx, CodeEditModal/AnnotationEditModal,
│   │   │                                   ThemeMembershipEditor.tsx, MetadataSchemaEditor.tsx, ColorPicker.tsx, Resizable.tsx,
│   │   │                                   Markdown.tsx (inline MD renderer + editor), AuthBar.tsx.
│   │   │                                   types.ts, compute.ts (pure: tree + segments + color + lines + co-occurrence + explore),
│   │   │                                   storage.ts (localStorage + JSON import/export), exporters.ts (JSON + Markdown: doc/codebook/themes/project),
│   │   │                                   drive.ts (Drive Files REST + multipart), driveSync.ts (folder-per-project orchestrator)
│   │   └── ai-research/                 ← React components for AI-research stage visualizations
│   │       ├── PsychVariationGraph.tsx  ← topology graph (force-directed via d3-force) — pan + wheel-zoom + reset
│   │       ├── PsychVariationModel.tsx  ← model dashboard (variance decomposition + multivariate sex-difference tabs)
│   │       ├── PsychVariationData.tsx   ← data findings panel (six-tab H1–H6 prediction tests, hand-rolled SVG charts)
│   │       ├── PsychVariationExplorer.tsx ← build-stage reader's tool (trait lookup + traps + asymmetric environmental effects)
│   │       ├── AITransitionGraph.tsx    ← topology graph for navigating-ai-world (~50 nodes, 5 variants, pan + wheel-zoom + reset)
│   │       ├── AITransitionModel.tsx    ← model dashboard for navigating-ai-world (integrated ΔNet = ΔV + ΔM with channel decomposition + structural flags + ρ(t) trajectory tab)
│   │       ├── AITransitionData.tsx     ← data findings panel for navigating-ai-world (six Q1–Q6 tabs covering λ atrophy speed, dose-response, gate τ, scalar identity, κ calibration, per-domain α; hand-rolled SVG charts)
│   │       ├── AITransitionExplorer.tsx ← build-stage reader's tool for navigating-ai-world (six views: profile lookup default + six channels demystified + four motivated-reasoning traps + ten-year trajectory under three λ regimes + five moves S2–S6 with channel annotations + eight-bullet take-away; runs the same `compute()` as AITransitionModel with hardcoded parameter vectors per profile)
│   │       ├── CognitivePartnershipGraph.tsx ← topology graph for technology-utilization-architecture (~66 nodes, 5 variants incl. capability-regime fragility, P-type practitioner nodes + op edge, pan + wheel-zoom + reset)
│   │       ├── CognitivePartnershipModel.tsx ← model dashboard (per-task router with seven presets + day-portfolio four-strategy comparison; V(u,v;θ) generator-verifier loop)
│   │       ├── CognitivePartnershipData.tsx ← data findings panel (seven tabs — productivity landscape + Q1 CUPS + Q2 Bastani + Q3 mode distribution + Q4 outside-frontier scatter + Q5 workflow swings + Q6 calibration)
│   │       └── CognitivePartnershipExplorer.tsx ← build-stage reader's tool (five views: pick-a-task router + compare-strategies portfolio + common-mistakes + when-to-verify + cheat sheet; same bilinear math as the model)
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
│   │   ├── dashboards.json              ← roster of dashboards with status (planned/in-progress/finished) + optional `private`
│   │   └── ai_research_planned.json     ← 16 planned AI-research topics ({title, desc}) rendered on /ai-research + home (prompts.md is the longer brainstorm)
│   ├── lib/
│   │   ├── bundle.ts                    ← shared markdown rendering helpers (bundleHeader, blogToMd, researchToMd, modelToMd, updateToMd, aiStageToMd, section, sortByDate, stripImports)
│   │   └── googleAuth.ts                ← shared OAuth code-flow client (signIn/refresh/signOut/loadCachedToken); talks to api/auth/*
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
│   │   ├── bundle-all.md.ts             ← /bundle-all.md (mine + ai-research concatenated)
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
| `blog` | `src/content/blog/*.mdx` | title, description, date, tier (`mine`/`collab`/`ai-led`), draft, tags |
| `research` | `src/content/research/*.mdx` | title, description, date, status (`in-progress`/`published`/`upcoming`/`contribution`), paperStatus?, abstract?, authors[] (`{name, affiliation?, mine}`), collaborators[] (legacy), venue, paperUrl, externalUrl, featured |
| `models` | `src/content/models/*.mdx` | title, description, date, status (`draft`/`published`), featured, component, tags |
| `ai_research` | `src/content/ai_research/<topic>/<stage>.mdx` | title, description, date, status (`not-started`/`in-progress`/`complete`), refinementPass, refinementLog |
| `updates` | `src/content/updates/*.mdx` | title, description?, date, period (`daily`/`weekly`/`monthly`), tags, draft |

`research` carries both the new `authors` array (with affiliations; `mine: true` flags Teddy's own entry) and the legacy `collaborators` string array for entries not yet migrated. Source of truth: `src/content.config.ts`.

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

`Footer.astro` is mounted in `BaseLayout.astro` after the main slot. It reads `src/data/now.json` for the `updated` date (the previous top-of-page NOW strip is retired) and `src/data/bio.json` for contact links. Slots: left (`updated <date>` + bundle downloads `mine ↓` / `ai's research ↓` / `all ↓`), right (email / substack / github). Border-top `rule`, `font-mono text-[11px]`, all in muted/ink-soft.

### Content bundles + per-page downloads

Static endpoints that prerender to `.md` files at build time. All endpoints share helpers in `src/lib/bundle.ts` (header/footer rendering, MDX import-stripping, per-collection serializers).

**Top-level bundles** linked from the global Footer (`mine ↓`, `ai's research ↓`, `all ↓`):

- `/bundle-mine.md` — `blog` + `research` + `models` + `updates` (the user's own writing/research). Source: `src/pages/bundle-mine.md.ts`.
- `/bundle-ai-research.md` — every stage of every `ai_research` topic (the full LLM Iterate output). Source: `src/pages/bundle-ai-research.md.ts`.
- `/bundle-all.md` — the two above concatenated. Source: `src/pages/bundle-all.md.ts`.

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

### Google sign-in (Time Tracker, Qual Coding; Finance pending)

Auth uses the **OAuth 2.0 authorization-code flow with a refresh token**, backed by three Vercel serverless functions. This replaced the old GIS *implicit token flow*, whose silent refresh (`requestAccessToken({ prompt: 'none' })`) was permanently broken: it opens a popup to `accounts.google.com`, which sends `COOP: same-origin`, severing the opener's `window.closed` handle (Chrome: *"Cross-Origin-Opener-Policy policy would block the window.closed call"* → GIS `popup_closed`). No site-side header fixes this, because the boundary is set by Google's popup, not us — so silent refresh failed and forced a manual re-sign-in every hour.

**Current flow:**

1. **One-time interactive sign-in** — `src/lib/googleAuth.ts` `signIn()` opens the GIS **code-client** popup (`initCodeClient`, `ux_mode: 'popup'`) and gets an auth code. Interactive popups work fine despite COOP; only the silent path was broken.
2. **`POST /api/auth/exchange`** — swaps the code (with the client secret, `redirect_uri: 'postmessage'`) for an access token + **refresh token**. The refresh token is AES-256-GCM sealed into an `HttpOnly; SameSite=Lax; Secure` cookie scoped to `/api/auth`. Only the short-lived access token + email return to the browser.
3. **`POST /api/auth/refresh`** — mints a fresh access token from the cookie. **No popup, no GIS, immune to COOP.** Dashboards call this on page load, ~1 min before token expiry, on tab focus, and on a 401. This is what makes sessions last weeks instead of an hour.
4. **`POST /api/auth/signout`** — clears the cookie and revokes the refresh token.

Backend lives in `api/auth/` (`_lib.js` = crypto/cookie/token helpers; `exchange.js`, `refresh.js`, `signout.js`). Vercel serves a top-level `api/` directory as Node serverless functions alongside the static Astro build — no Astro SSR adapter needed.

**Scopes are unified** in `googleAuth.ts` (`openid email profile spreadsheets drive.file`) so one sign-in covers every dashboard. The access token lives only in memory + a sessionStorage cache (instant paint); the durable session is the cookie.

**Required env vars** (Vercel project settings, all environments): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TOKEN_ENC_KEY` (base64url of 32 random bytes). Optional `ALLOWED_EMAILS` (comma-separated) — the **owner allowlist**: `exchange` rejects any signed-in email not on it (default `teddyalanwright@gmail.com`), discarding+revoking the stranger's token so no session is created. The OAuth consent screen must be **Published / In production** for non-expiring refresh tokens (Testing mode expires them after 7 days). Sensitive scopes (Sheets) trigger Google's "unverified app" warning on first interactive sign-in — bypass via *Advanced → proceed*; formal verification is unnecessary for single-owner use.

**COOP header** (`vercel.json` + `astro.config.mjs` dev/preview) is set to `same-origin-allow-popups` — good hygiene for the interactive sign-in popup. Do **not** add `Cross-Origin-Embedder-Policy`; it would block the GIS script and Google APIs.

**Finance** still uses the old implicit flow (`src/components/dashboards/finance/`) — migrate it to `googleAuth.ts` the same way as a follow-up. The dead GIS auth helpers in `time-tracker/sheets.ts` and `qualitative-coding/drive.ts` are unused and can be deleted.

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

Lives at [src/components/dashboards/time-tracker/](src/components/dashboards/time-tracker/). Mounted at `/dashboards/time-tracker` and listed in the `/dashboards` roster. The page is publicly reachable but personal: Sheets sync requires `PUBLIC_TIMETRACKER_SHEET_ID` plus an account that owns that sheet, so a visitor without those gets the local-only mode in their own browser. Three UI tabs: **Clock**, **Pomodoro**, **Log**.

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

Lives at [src/components/dashboards/qualitative-coding/](src/components/dashboards/qualitative-coding/). Mounted at `/dashboards/qualitative-coding`. **Public** in the roster (no `private: true` in `dashboards.json`) — anyone can load the URL, but data is per-browser (localStorage) and per-Google-account (Drive), so no one but the signed-in user sees their projects. Beyond v2's coding tree + Explore, the tool now adds an analyst **Themes** layer over annotations and a **Grading** layer (code specificity / annotation accuracy / multi-axis theme ratings) for comparing one project's coding against another (e.g. AI vs analyst).

**Layout deviation**: this is the one dashboard whose page does *not* use `BaseLayout`. [src/pages/dashboards/qualitative-coding.astro](src/pages/dashboards/qualitative-coding.astro) declares its own minimal `<html>/<body>` with a white background, loads `global.css` for Tailwind, pulls in Inter from Google Fonts, and mounts the dashboard at full viewport (`100vh × 100vw`). It also defines a global `.md-preview` CSS block scoped to the rendered Markdown (headings, lists, blockquotes, code, inline links). The site Nav/Footer are deliberately absent — this is a text-annotation tool that needs maximum vertical space and a UI language distinct from the editorial paper aesthetic. The "← Dashboards" affordance is rendered inside the dashboard's own TopBar.

**Files**:

- `QualitativeCodingDashboard.tsx` — root component. Owns `AppState` (in localStorage), the active project / document / code / theme selection, the **6-view router** (`documents` / `codebook` / `themes` / `grading` / `explore` / `about`), all CRUD handlers, the Drive sync queue + lifecycle (via `googleAuth.ts` code-flow + `driveSync.ts`), the schema-editor modal, the export menu, and the JSON import file input. Composes `TopBar` + `Sidebar` (hidden in About and Codebook views) + the active view component + modals. The `NoProjects` empty state replaces the entire UI before the first project is created. Many resizable-panel widths/heights and per-view toggles persist in `AppState`.
- `CodeTree.tsx` — recursive renderer of the code tree in the Sidebar. Per-row inline rename (double-click), an inline edit form for name + description + color, "+" to add a child, "×" to delete (cascades to descendants + dependent annotations after a `confirm`). A `defs` toggle shows code descriptions inline; descriptions also appear in the selection popover and the annotation focus panel.
- `CodebookView.tsx` — full-page code-tree manager (Sidebar hidden). Drag-drop reordering with multi-parent support (Alt-drag adds a parent without removing the old one), collapse/expand, inline editing, parent-link management, alphabetical sort, and a definitions toggle.
- `ThemesView.tsx` — analyst-level grouping layer above codes. Hierarchical theme tree + a theme-detail card: separate **Definition** and **Reasoning** Markdown editors, linked annotations toggled core/supporting, uncoded highlights, an include-codes picker (`HierarchicalCodePicker`), and the rating card (three hand-rated axes — grounding/usefulness/interpretation level). The sidebar header carries an **"import AI ↓"** button (loads an AI thematic-analysis JSON via `aiThemeImport.buildThemesFromAI` and merges themes + located quote spans into the active project) and a **"doc"** toggle that swaps the detail pane for `ThemesDocView` — every theme rendered as a depth-nested heading with definition, reasoning, supporting `[D{n}]`-tagged quotes, and the same inline rating control for read-and-score.
- `GradingView.tsx` — rubric-rating dashboard with three tabs: **Codes** (specificity 1–5), **Annotations** (accuracy 1–5, with a per-code drill-down), and **Themes** (three hand-rated axes — grounding / usefulness / interpretation level; independence and prevalence are computed downstream). Designed for grading one project's coding against another (e.g. AI's vs the analyst's).
- `ThemeMembershipEditor.tsx` — reusable inline widget showing an annotation's theme links with add/remove + core/supporting toggle. Used in `AnnotationEditModal` and Explore cards.
- `HierarchicalCodePicker.tsx` — shared searchable hierarchical multi-select for codes (keeps tree structure, flattens on search). Used in Explore filters and theme include-codes.
- `CodeEditModal.tsx` / `AnnotationEditModal.tsx` — compact edit modals. Code modal: name + description + color (`ColorPicker`) + specificity rating. Annotation modal: note + accuracy rating + accuracy notes + theme membership. Parent/reorder operations stay in `CodebookView`.
- `ColorPicker.tsx` — 12-color base palette + expandable shade grid (5 shades per base) + an "inherit" option for `null` color.
- `Resizable.tsx` — `ResizeHandle` / `RowResizeHandle` draggable dividers for the resizable panels.
- `DocumentViewer.tsx` — the meat. Title + folder-path input + per-schema-field metadata at the top. A mode toggle (`Read & code` vs `Edit text`): edit mode is a `<textarea>`; read mode renders text as segments produced by `segmentText` from `compute.ts`, optionally chunked into lines (`buildLines`). Selection is captured on `mouseUp`/`keyUp` using `document.createRange()` + `Range#toString().length` to map DOM selection back to character offsets. A non-empty selection opens a `SelectionPopover` anchored to the selection rect; it searches the flattened code tree and commits the annotation on click or Enter (and can add a range to / replace ranges on a focused multi-range annotation). A 📝 Notes button opens a 380px right-side `MarkdownEditor` bound to `Document.notes`. Four independent reading toggles: **Lines** (line numbers + sentence/chars chunking — cosmetic only), **Codes** (a code-chip margin column), **Highlight** (on-text code highlights), **Themes** (a themes margin column listing the doc's themes as clickable chips). Any column forces an aligned-rows layout (`rowLayout = lineView || codesColumn || showThemes`); Lines no longer gates the columns. The themes column shows every theme with a span in the doc (chip on its first line); clicking a chip toggles `shownThemeIds` (local, default empty) — shown themes highlight their spans on the text in each theme's own color. Below the text, `AnnotationsPanel` lists every annotation with click-to-focus.
- `ExploreView.tsx` — the cross-project annotation browser. Receives a `projects: Project[]` array (the active project plus any included via the multi-select picker), runs `exploreRows` + `coOccurringCodes` from `compute.ts`, and renders a filter sidebar (`HierarchicalCodePicker` with per-project headers; folder dropdown; metadata filters; free-text search), a stats strip (annotations / unique codes / docs / projects), a top-codes chip strip, an optional code co-occurrence matrix, and a card list (flat or grouped by-code) of every matching annotation with project chip, code path, span text, note, theme links, and metadata. Cards call `onJumpToAnnotation(projectId, docId, annotationId)` to switch project + doc, focus the annotation, and return to Documents view.
- `ProjectAboutView.tsx` — the Info view. Editable project name (large hero), editable one-line description, and a `MarkdownEditor` for `Project.about` with Write/Read tabs (Read shows the rendered Markdown via `MarkdownRendered`). A "Project at a glance" stat strip (docs / codes / annotations / metadata fields) plus a created/updated date line at the bottom.
- `MetadataSchemaEditor.tsx` — modal for editing the per-project metadata schema. Add/rename/delete fields, change type (`text` / `number` / `date` / `enum`), edit comma-separated options for enums. Field `key` is derived from the label (slugified) once and never changes after creation.
- `Markdown.tsx` — a tiny self-contained Markdown renderer + editor. `renderMarkdown(src)` handles headings (`# … ######`), paragraphs, `**bold**` / `*italic*` / `_italic_` / `` `inline code` ``, fenced code blocks, ordered/unordered lists, blockquotes, and `[label](url)` links — output is escaped (`<`, `>`, `&` → entities) before regex replacement so the markdown source can't smuggle HTML. `MarkdownEditor` is a toolbar (H1/H2/H3, B/I/`<>`, `•`/`1.`/`>`/🔗) on top of a `<textarea>` with a Write/Preview tab toggle; toolbar buttons wrap selection (`surround`) or prefix selected lines (`linePrefix`) and the link button inserts `[selection](https://)`. `MarkdownRendered` is the read-only display variant. Both consume styles from the global `.md-preview` CSS block in the page.
- `AuthBar.tsx` — the Drive sign-in pill in the TopBar. Visual states: `local only` (no env var), `Sign in to sync` (configured, no token), `signed-in` (email + colored dot — green idle / blue pulsing syncing / red error / grey offline), with a dropdown showing file count, last error, "Refresh from Drive", and Sign out.
- `types.ts` — `SchemaVersion`, `MetadataField`, `DocumentKind`, `Document` (incl. `notes?`, `folder?`, `kind?`), `Code` (incl. `specificity?: 1–5`, `specificityNotes?`), `Annotation` (multi-range `ranges[]`, incl. `accuracy?: 1–5`, `accuracyNotes?`), `Theme` (narrative split into `definition?` + `reasoning?`, with legacy `description?` migrated into `definition` on load) + `ThemeAnnotationLink` + `ThemeUncodedHighlight` + `ThemeRating` (5 axes in the type; 3 hand-rated in the UI), `Project` (incl. `about?`, `themes?`, `folders?`, `drive?`), `DriveLink`, `View` (6 values), `AppState` (many persisted toggles + panel sizes + `activeThemeId?`) plus the 12-color `PALETTE` constant.
- `storage.ts` — `loadState` / `saveState` with a single localStorage key. `coerceProject` for tolerant JSON import (defaults docs' `folder`/`notes`/`kind`/`metadata`; migrates legacy single-`parentId` codes → `parentIds[]`; migrates legacy `{start,end}` annotations → `ranges[]`; carries through `themes`, `about`, `drive`). Plus `cryptoRandomId`, `newProject`, `downloadJSON` / `downloadText`, `readFileAsText`.
- `compute.ts` — pure. Code/tree: `buildCodeTree` / `flattenTree` (DAG flattened by duplicating each code under every parent; `CodeNode` carries `parentId` + `pathKey`), `codePath` / `codePathString`, `descendantIds`, `resolveColor`, `nextPaletteColor`, `hexToHsl`/`hslToHex`/`getShades`. Annotations: `annRanges`/`annStart`/`annEnd`/`annText`, `segmentText`, `buildLines` (chunk by sentence or N chars), `annotationsForDoc`, `annotationsByCode`, `codeCounts`/`deepCodeCounts`, `meanAccuracyForCode`. Folders: `buildFolderTree`, `folderDocCount`. Explore: `exploreRows`, `exploreCodeUniverse`, `coOccurringCodes` (code co-occurrence matrix). Plus `countWords`, `docAnnotationCount`, `findDoc`.
- `exporters.ts` — pure builders: `exportProjectJSON`, `exportProjectMarkdown`, `exportDocumentMarkdown`, `codebookMarkdown`, `themesMarkdown`, `exportCorpusForAI` (the `[D1]`-tagged corpus for AI prompts), `exportThemesRatingsJSON` (compact themes-only `{ name, parent, definition, reasoning, ratings, supporting:[{text, source, role}] }` for analysis/embedding — the SPUR artifact). Markdown tables escape pipes in span text and code/theme paths.
- `aiThemeImport.ts` — `parseAIThemesJson(text)` + `buildThemesFromAI(project, raw, now)`: the inverse of `exportCorpusForAI`. `parseAIThemesJson` is a tolerant parser for LLM output (LLMs routinely emit invalid JSON when a verbatim quote contains a literal `"` — e.g. `the "experts"` — by forgetting to escape it): it strips ```json fences then tries, in order, strict parse → a stray-quote escaper (a `"` only closes a string if the next non-space char is `,` `:` `}` `]`) → `jsonrepair` (trailing commas, unquoted keys) → both combined; first success wins. `buildThemesFromAI` Takes an AI thematic-analysis JSON (`{ themes: [{ reasoning, name, definition, justification, quotes: [{ text, source, role }] }] }`) and merges it into an existing project as new `Theme`s. Each quote is resolved — `source` (`[D{n}]`) → `documents[n-1]`, verbatim `text` → character offsets via `indexOf` — into a `ThemeUncodedHighlight` (theme evidence, no code). The AI's `definition` and `reasoning` populate the theme's separate fields (justification is dropped); `role` → highlight weight. Quotes that don't locate verbatim are returned in `unmatched` (surfaced to the user, never silently dropped). Triggered by the "import AI ↓" button in the Themes view header. **Low-effort mode** (`buildThemesFromAI(project, raw, now, lowEffort)`, driven by `Project.lowEffort`): non-anchored quotes (paraphrases / no `[D#]` source) are kept as the theme's `extraQuotes` (shown as plain text, not highlighted) instead of reported, and the file's top-level `additional_text` is captured into `Project.additionalText` (surfaced + editable in the Info view).
- `drive.ts` — Drive REST helpers (the auth itself now runs through `googleAuth.ts`'s code-flow; the legacy GIS sign-in block in this file is unused). Scope `https://www.googleapis.com/auth/drive.file`. Generalised helpers: `listAppFiles(token, rootFolderId?)`, `listChildren`, `getFileContent<T>`, `createFolder`, `findOrCreateFolder`, `createFile({ name, parentId, mimeType, content, appTagged })`, `updateFile`, `renameFile`, `moveFile`, `deleteFile`. Multipart helper for create. `DriveAuthError` (401/403) triggers token drop. MIME constants in `MIME.json / md / folder`.
- `driveSync.ts` — per-project sync orchestrator (separated from `drive.ts` so the REST helpers stay pure). Owns the folder-per-project layout. Exports `syncProjectToDrive(token, project, rootFolderId?)` (returns updated `DriveLink`), `pullProjectFromDrive(token, source)` (handles both new and legacy sources), and `deleteProjectFromDrive(token, drive)` (deletes the whole folder).

**Storage**: one localStorage key, `tw-qual-coding-v1`. The persisted `AppState` is `{ version: 1, projects, activeProjectId }` plus a long tail of optional UI state (`view`, `exploreProjectIds`, `showCodeDefinitions`, `activeThemeId`, panel widths/heights, per-view collapse + display toggles, line-view settings). On import (`coerceProject`), the incoming project is reassigned a fresh `id` and its `drive` link is dropped to avoid overwriting an existing Drive file. All mutations go through `updateActiveProject(p => ...)` (immutably replaces the active project and stamps `updated_at`); each also calls `queueWrite(projectId)` to schedule a Drive write 800ms later.

**Drive sync mechanics** (v3 — folder per project):

- Layout: each project gets a Drive folder named after the project, parented to `PUBLIC_QUAL_CODING_DRIVE_FOLDER_ID` (or My Drive root). Inside:
  - `project.json` (canonical, app-tagged with `tw_qual_coding=v1`)
  - `project.md`, `codebook.md`, `themes.md` (read-only Markdown exports)
  - `corpus.md` — every Document as a `[D1]` / `[D2]` … identifier + verbatim text, for pasting into an AI prompt's `{data}` block. `D` = document (the generic data-model unit); order matches `project.documents`, so `[D{n}]` resolves to `documents[n-1]`. The identifier is the stable join key an AI thematic-analysis output echoes back as a quote's `source`.
  - `documents/` subfolder, with one `.md` per Document, nested in subfolders mirroring `Document.folder`.
- `DriveLink` is `{ folderId, projectJsonId, modifiedTime? }`. Only `project.json` carries the appProperties tag; the .md files are pure exports and not discoverable via `listAppFiles`.
- **Discovery** (`listAppFiles`): queries `appProperties has { key='tw_qual_coding' and value='v1' } and trashed=false`. Returns every `project.json` across all project folders in one call. The dashboard infers the project folder from each result's `parents[0]`.
- **Sync queue** (`pendingWrites`, `inflightWrites` refs in the root component): per-project, debounce 800ms then `runWrite`. If a write is already in-flight for that project, re-queue. `runWrite` reads the current project from localStorage (always fresh — the `saveState` useEffect flushes after each `setState`), then delegates to `syncProjectToDrive(token, project, rootFolderId)` in `driveSync.ts`.
- **`syncProjectToDrive`** is the orchestrator. It:
  1. Ensures the project folder exists (creates it if `project.drive.folderId` is missing). Renames the folder if the project name has drifted.
  2. Writes / updates `project.json` (the canonical file — also app-tagged).
  3. Writes / updates `project.md` and `codebook.md`.
  4. Ensures `documents/` exists. Computes the desired file map (`computeDocFileMap`) for every Document, with collisions deduped by `(2)`, `(3)`, etc.
  5. Walks the existing `documents/` tree (`collectFilesRecursive`), upserts every desired file, creates any missing subfolders, deletes orphaned files (docs since deleted) and orphaned folders (now-empty subfolders).
  6. Returns the updated `DriveLink`.
- **Legacy migration**: v2 wrote one flat `<slug>.<id>.qcoding.json` per project at the root of the configured folder. `syncProjectToDrive` detects this case (`!folderId && (drive.fileId || drive.projectJsonId)`) and migrates: it creates the project folder, then renames the legacy file to `project.json` and moves it in. After migration the legacy `drive.fileId` field is dropped from the project's `DriveLink`.
- **Pull lifecycle** (`pullAllFromDrive`): triggered on sign-in and on `window.focus`. Lists all app-tagged files (= all `project.json` files), fetches each, classifies as legacy-flat (parent is the root folder) or in-folder (parent is a project folder), stamps the appropriate `DriveLink` shape, and merges into local state. Local projects without `drive.folderId` are queued for an immediate write so migration happens at most once per machine.
- **401/403 handling**: `DriveAuthError` is caught at the queue/pull boundary; the token is cleared, `syncStatus` flips to `error` with the auth message, and the AuthBar re-prompts.

**Selection-offset technique**: the document is rendered as a sequence of `<span>` text nodes (annotated segments) inside a single container `<div>`. The container has no other non-text descendants. To map a `Selection`'s `startContainer/startOffset` (a text node inside one of those spans) back to a character offset in `Document.text`:

```ts
const range = document.createRange();
range.selectNodeContents(container);
range.setEnd(node, offset);
const charOffset = range.toString().length;
```

This works because `Range#toString()` returns the concatenated text content of everything in the range. No tree walker, no manual offset accumulation, no `<br>` / non-text-node edge cases (the container holds only text-bearing spans).

**Required env (Drive sync)**: `PUBLIC_GOOGLE_CLIENT_ID` (same OAuth client as Finance/Time Tracker — **must have Drive API enabled** in addition to whatever was already enabled), plus optional `PUBLIC_QUAL_CODING_DRIVE_FOLDER_ID` (a Drive folder to keep files in; if unset, files go to My Drive root).

## Build / deploy

- `npm run dev` — local at http://localhost:4321
- `npm run build` — static output to `dist/`
- Deployed on **Vercel** at **https://teddy-wright.com**. Vercel serves the static Astro build plus the top-level `api/` directory as Node serverless functions (the OAuth code-flow backend) — no Astro SSR adapter. The dashboard env vars (`GOOGLE_CLIENT_SECRET`, `TOKEN_ENC_KEY`, the `PUBLIC_*` IDs, optional `ALLOWED_EMAILS`) live in Vercel project settings. (If `/dashboards/*` ever needs gating, Cloudflare Access in front remains the planned approach.)

## Known pitfalls

- React 19 + Astro 5: ensure `client:load` (or another client directive) on interactive components inside MDX
- Content collection schema changes require a dev server restart
- MDX files importing React components require the `@astrojs/mdx` integration (configured)
- Tailwind classes inside React `.tsx` need the file to be in the `content` glob in `tailwind.config.mjs` (already covered by `**/*.{...,tsx}`)
- Equation rendering: not yet wired. Use code-style inline (`G - B + w(E - C)`) until KaTeX is added.
- Dashboards backed by `localStorage` must mount with `client:only="react"`, not `client:load`. With `client:load` Astro pre-renders the component on the server, where `window.localStorage` is undefined; the dashboard would either crash or hydrate with a one-frame "empty data" flash before localStorage loads. `client:only` skips SSR entirely.
