# Architecture

## Stack

- **Astro 5.7** static site generator (server adapter optional later for `/dashboards`)
- **Tailwind 3** for styling, `@tailwindcss/typography` for prose
- **MDX** for long-form content (essays, model explanations, AI research stages)
- **React 19** for interactive components (model dashboards)
- **@astrojs/sitemap** for sitemap generation

## Folder structure

```
/
├── PRD.md, ARCHITECTURE.md, CLAUDE.md   ← read-first specs
├── stage_outputs/                       ← raw LLM stage outputs (working drafts)
│   └── <topic>/<stage>.md
├── public/
│   ├── favicon.svg
│   └── papers/                          ← published PDFs (papers, posters, working drafts)
│       └── <slug>.pdf
├── src/
│   ├── components/
│   │   ├── Nav.astro
│   │   ├── Footer.astro
│   │   ├── TierBadge.astro
│   │   ├── RefinementLog.astro
│   │   └── models/                      ← React components for interactive models
│   │       └── OptionValueDashboard.tsx
│   ├── content/
│   │   ├── blog/<slug>.mdx              ← essays
│   │   ├── research/<slug>.mdx          ← formal research entries (currently inline in research.astro)
│   │   ├── models/<slug>.mdx            ← model explanations
│   │   └── ai_research/<topic>/<stage>.mdx
│   ├── content.config.ts
│   ├── layouts/BaseLayout.astro
│   ├── pages/
│   │   ├── index.astro
│   │   ├── about.astro
│   │   ├── research.astro
│   │   ├── writing.astro
│   │   ├── writing/[slug].astro
│   │   ├── models/
│   │   │   ├── index.astro
│   │   │   └── [slug].astro
│   │   └── ai-research/
│   │       ├── index.astro
│   │       ├── [topic]/index.astro
│   │       └── [topic]/[stage].astro
│   └── styles/global.css
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

`stage_outputs/<topic>/<stage>.md` holds raw LLM outputs that feed each stage. Polished versions move into `src/content/ai_research/`.

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

Locked tokens — do not deviate without updating this file.

- **Typography**: Inter (sans), JetBrains Mono (mono), loaded from Google Fonts in `global.css`
- **Container**: `max-w-3xl mx-auto px-6` (≈ 768px reading column)
- **Vertical rhythm**: `pt-16 pb-16` on inner pages, `pt-20` on home, `mt-20` for footer
- **Color**: single accent ramp `primary` (indigo, defined in `tailwind.config.mjs`); everything else is gray scale
- **Active link**: `text-primary-600`; inactive: `text-gray-500 hover:text-gray-900`
- **Card pattern**: `border-l-2 border-primary-200 pl-4` (or `pl-5`) — eyebrow / title / description / meta
  - Active items use `border-primary-200`
  - Archival/upcoming items use `border-gray-200`
- **Eyebrow**: `text-xs font-medium uppercase tracking-wider`, primary-600 for active, gray-500 for archival
- **Section heading (eyebrow style)**: `text-sm font-semibold text-gray-400 uppercase tracking-wider mb-6`
- **Prose**: `prose prose-gray max-w-none` for MDX rendered content
- **Selection**: `bg-primary-100 text-primary-900` (set in global.css)

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
