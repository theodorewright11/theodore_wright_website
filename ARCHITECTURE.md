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
│   │   ├── Footer.astro                 ← global footer (updated date + content bundle download + contact)
│   │   ├── SectionLabel.astro           ← Fraunces 18px label + accent "see all →" link, hairline rule below
│   │   ├── GroupHeader.astro            ← shared status-group header used on /research, /models, /ai-research
│   │   ├── TierChip.astro               ← me / me x ai / ai chip (writing tiers)
│   │   ├── RefinementLog.astro
│   │   ├── models/                      ← React components for interactive models
│   │   │   └── OptionValueDashboard.tsx
│   │   └── ai-research/                 ← React components for AI-research stage visualizations
│   │       ├── PsychVariationGraph.tsx  ← topology graph (force-directed via d3-force)
│   │       └── PsychVariationModel.tsx  ← model dashboard (variance decomposition + multivariate sex-difference tabs)
│   ├── content/
│   │   ├── blog/<slug>.mdx              ← essays
│   │   ├── research/<slug>.mdx          ← formal research entries
│   │   ├── models/<slug>.mdx            ← model explanations (drafts included)
│   │   ├── updates/<slug>.mdx
│   │   └── ai_research/<topic>/<stage>.mdx
│   ├── content.config.ts
│   ├── data/                            ← singletons (not collections — small, edited-by-hand)
│   │   ├── bio.json                     ← name, blurb, location, contact links
│   │   ├── now.json                     ← `updated` date drives the global Footer (NowStrip retired)
│   │   └── dashboards.json              ← roster of planned dashboards
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
│   │   ├── content-bundle.md.ts         ← static endpoint emitting /content-bundle.md (all content as one markdown file)
│   │   └── ai-research/
│   │       ├── index.astro
│   │       ├── [topic]/index.astro      ← topic page with stage tabs (Overview + per-stage)
│   │       └── [topic]/[stage].astro    ← deep-link standalone stage page
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

`stage_outputs/<topic>/<stage>.md` holds raw LLM outputs that feed each stage. Topic slugs are kebab-case; stage filenames are exactly one of `lit-review`, `topology`, `model`, `data`, `build` (no version suffixes — git provides history). Polished versions move into `src/content/ai_research/<topic>/<stage>.mdx`.

Stage-specific interactive components (D3 graphs for topology, dashboards for model/data) live at `src/components/ai-research/<ComponentName>.tsx` and are mounted in the stage's MDX with `client:load` (wrap in `not-prose` so Tailwind Typography doesn't override styles).

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

Rendered at the bottom of each stage page by `<RefinementLog>`.

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

### Content bundle

`src/pages/content-bundle.md.ts` is a static endpoint that prerenders to `dist/content-bundle.md` at build time. It pulls every collection (`blog`, `research`, `models`, `updates`, `ai_research`), strips MDX `import` lines, and emits one big markdown file. Linked from the Footer with `download` so a visitor — or an LLM the visitor pastes it into — can grab the whole site in one file. No frontmatter or component embeds in the output; just title/date/status header and the body.

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
