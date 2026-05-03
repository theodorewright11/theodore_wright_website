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
│   │   ├── dashboards/index.astro
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

## Build / deploy

- `npm run dev` — local at http://localhost:4321
- `npm run build` — static output to `dist/`
- Deploy target: TBD (Cloudflare Pages recommended for Access integration)

## Known pitfalls

- React 19 + Astro 5: ensure `client:load` (or another client directive) on interactive components inside MDX
- Content collection schema changes require a dev server restart
- MDX files importing React components require the `@astrojs/mdx` integration (configured)
- Tailwind classes inside React `.tsx` need the file to be in the `content` glob in `tailwind.config.mjs` (already covered by `**/*.{...,tsx}`)
- Equation rendering: not yet wired. Use code-style inline (`G - B + w(E - C)`) until KaTeX is added.
