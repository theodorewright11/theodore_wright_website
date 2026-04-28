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
| `/research` | Formal academic research, grouped by status (In Progress / Finished / Upcoming / Contributions) |
| `/ai-research` | Outputs of the LLM Iterate pipeline (5-stage refinement of topics) |
| `/models` | Polished interactive quantitative models (sliders, real-time computation) |
| `/dashboards` | Interactive dashboards (public demo + private tier per dashboard) |
| `/writing` | Essays, with tier labels showing how AI-assisted each piece is |
| `/updates` | Weekly (or daily/monthly) notes on what's moving |

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

- **Why continuing is easier than starting** *(option value)* — existence asymmetry from holding an option on future states
- **Why vivid pain feels worse than equal pain** *(suffering salience)* — perceived harm = actual harm × salience distortion
- **How trust builds over time** *(trust tracker)* — months × contexts × consistency
- **Parenting under uncertainty** *(parental decision-making)* — confidence/stakes/reversibility/disclosure framework
- **How surroundings shape your output** *(social environment output efficiency)* — how social scaffolding modulates available cognitive output

Tags on model frontmatter exist in the schema but are no longer rendered — model identity is carried by the title and description.

## AI's Research (LLM Iterate)

A pipeline that turns a topic into a progressively refined artifact across 5 stages:

1. **Lit Review** — landscape analysis, key papers, gaps
2. **Topology** — dependency graph (D3 visualization once implemented)
3. **Model** — formalization, equations, interactive dashboard
4. **Data** — empirical pipeline + findings
5. **Build** — useful artifact (tool / component / site addition)

Each stage:

- Lives at `/ai-research/<topic>/<stage>`
- Has a refinement log (REFINEMENT / WHY / CHANGES) showing iteration history
- Feeds the next stage as input

Raw working drafts live in `stage_outputs/<topic>/<stage>.md` (kebab-case topic slug, stage filename one of `lit-review`, `topology`, `model`, `data`, `build`). Polished versions move into `src/content/ai_research/<topic>/<stage>.mdx`.

A topic's stage-3 model can be **promoted** to `/models` when polished — copy the formalization to a new `src/content/models/<slug>.mdx` entry.

### Topic registry

Active topics — folders exist in `src/content/ai_research/` and `stage_outputs/`:

| Topic slug | Title | Furthest stage |
|---|---|---|
| `social-output-efficiency` | Social Environment Output Efficiency | scaffold only |
| `human-psych-variation` | Psychology of Individual Differences | topology (pass 2) |

Planned topics (full list in `prompts.md`): philosophy → personal decisions; philosophy → organizations; philosophy of mind / ethics / epistemology; evolution-modernity mismatch; navigating an AI world; emotions architecture; meaning & spirituality; bedrock generating functions; AI decompression; information fidelity; trust architecture; parent-child transmission; technology utilization architecture; prediction & calibration; AI cognitive profile. Each spins up its own folder pair when started.

## Dashboards

Each dashboard ships in two tiers:

| Tier | URL | Data | Audience |
|---|---|---|---|
| **Public demo** | `/dashboards/<name>` | Visitor's own data in `localStorage`, with CSV import/export | Anyone — uses the model on their own data, no auth |
| **Private** | `/dashboards/<name>/me` (gated) | Teddy's own data (private Google Sheet or gated JSON) | Teddy only, via Cloudflare Access |

**Default behavior**: a visitor lands on the public demo. They get the same UI Teddy uses, but the data starts empty / synthetic and lives only in their browser. They can export to CSV to persist; re-import on next visit. No backend, no account, no privacy concerns.

**Private tier** exists only for dashboards where Teddy's actual data is the point (life metrics, ongoing trackers). Cloudflare Access in front, build-time data fetch from a private source.

Initial dashboard candidates: decision-tracker, finance, emotional-wellbeing, social-environment-output (promoted from the AI Research pipeline).

## Papers and PDFs

PDFs live in `public/papers/<slug>.pdf`. Once dropped in that folder, they're served at `/papers/<slug>.pdf` automatically — no build step.

Research entries reference their paper via `paperUrl: '/papers/<slug>.pdf'` in frontmatter. The detail page surfaces an "Open paper →" link.

Word documents (.docx) should be converted to PDF before upload (Word: File → Save As → PDF). Hosting `.docx` directly causes browsers to download rather than display.

## Site chrome

- **Nav** at the top of every page (brand + section links).
- **Footer** at the bottom of every page (replaces the old top-of-page NOW strip). Shows the site's last-updated date (driven by `src/data/now.json`), a download link to the full-content markdown bundle (`/content-bundle.md`), and contact links.
- **Content bundle**: `/content-bundle.md` is a build-time-generated single markdown file containing every published essay, research entry, model writeup, update, and AI-research stage on the site. Surfaced in the footer so a visitor (or AI assistant) can grab the entire site as one document.

## Out of scope (for now)

- Comments
- Multi-user auth
- CMS / admin UI (content is authored as MDX in repo)
- Search
- Math rendering (KaTeX/MathJax) — can be added later if equations get heavy; for now use code-style monospace

## Decisions log

- **2026-04-27**: Section originally named `/iterate` renamed to `/ai-research` ("AI's Research") to make AI-authorship explicit to visitors.
- **2026-04-27**: Three writing tiers chosen (mine / collab / ai-led) with display labels Me / Me + AI / AI.
- **2026-04-28**: Home and About merged into a single `/` page; `/about` redirects to `/`.
- **2026-04-28**: Research page reorganized — grouped by status. `published` displayed as "Finished" (not "Published") because the user finds "Finished" more accurate for the kind of work logged here.
- **2026-04-28**: `Featured` eyebrow label removed from `/models` index — the flag still controls sort order but is not visually surfaced.
- **2026-04-28**: `/updates` added — weekly/daily/monthly notes, content collection `updates`.
- **2026-04-28**: `/dashboards` added as a top-level tab (currently a "Planned" list; first dashboard not yet built).
- **2026-04-28**: Stage_outputs file naming standardized — `stage_outputs/<topic>/<stage>.md` with kebab-case topic slugs and exact stage names (`lit-review`, `topology`, `model`, `data`, `build`). The `human-psych-variation` lit review was migrated from a flat versioned filename into this convention. Topic registry added above so future topics drop in cleanly.
- **2026-04-28**: Adopted V4 "Quiet Paper + Editorial Front" design (Fraunces + Source Serif 4 + JetBrains Mono on a warm paper background, sienna accent). Home is an editorial three-column index with a masthead; inner pages are calm single-column reading. NOW strip pinned to the top of every page surfaces the current status line. The previous Inter + indigo + left-rule-card design system is retired. See `ARCHITECTURE.md` for tokens.
- **2026-04-28**: Singletons (bio, now, dashboard roster) live in `src/data/*.json` rather than as content collections — they're tiny, edited by hand, and don't need MDX bodies.
- **2026-04-28**: Models index now lists drafts as well as published entries (drafts at `opacity-70` with a "Draft" pill); previously drafts were hidden. Stub MDX files added for the four unpublished models in the roster.
- **2026-04-28**: AI's Research topic page is now a single page with stage tabs (Overview + each existing stage); the standalone `/ai-research/<topic>/<stage>` URL still works as a deep-link / shareable permalink.
- **2026-04-28**: Site chrome reshaped — top-of-page NOW strip retired; replaced by a global Footer that shows the last-updated date, contact links, and a download link to `/content-bundle.md` (a single markdown file with every published piece of content on the site, intended for AI summarization).
- **2026-04-28**: Home masthead simplified — `Vol. I · Salt Lake City` eyebrow and `Salt Lake City` colophon line removed; section labels on the home grid promoted from muted 10px mono to Fraunces 18px ink with a prominent `see all →` accent link; featured-essay "Continue reading" and research paper links bumped up to 13px semibold.
- **2026-04-28**: Model titles rewritten in plain language ("Option Value" → "Why continuing is easier than starting", etc.) and academic tag chips dropped from `/models` index and detail pages.
- **2026-04-28**: Writing tier `collab` label changed from `me + ai` to `me x ai` (TierChip).
- **2026-04-28**: `/research` paper links promoted from inline mono text to bordered call-to-action buttons ("Read the paper →") on both the index and detail pages, and surfaced on the home page Research column when a research entry has a `paperUrl` or `externalUrl`.
- **2026-04-28**: Index pages unified — `/research`, `/models`, and `/ai-research` all now use a shared `GroupHeader` component to break content into status sections (Research: In Progress / Finished / Upcoming / Contributions; Models: Live / Drafts; AI's Research: In Progress / Planned). The decorative `§ N` numeral on Research group headers is dropped.
- **2026-04-28**: Favicon swapped from a sans-serif blue "T" to a paper-background sienna italic "tw" mark consistent with the V4 design tokens.
