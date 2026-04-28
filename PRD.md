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
| `collab` | **Me + AI** | Teddy directs and injects substance, AI refines/synthesizes |
| `ai-led` | **AI** | Primarily AI-generated, Teddy curated/edited only |

Tier shows on the post card and at the top of the post. Default is `mine`.

## Models

A model has:

- A canonical name and slug
- An explanatory MDX page (intuition, equations, key insights)
- An optional interactive React component (sliders, real-time computation)
- A `featured` flag controlling whether it gets emphasized on `/models`

Initial roster (drafts/published over time):

- **Option Value** — existence asymmetry from holding an option on future states
- **Suffering Salience** — perceived harm = actual harm × salience distortion
- **Trust Tracker** — months × contexts × consistency
- **Parental Decision-Making Under Uncertainty** — confidence/stakes/reversibility/disclosure framework
- **Social Environment Output Efficiency** — how social scaffolding modulates available cognitive output

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

Raw working drafts live in `stage_outputs/<topic>/<stage>.md`. Polished versions move into `src/content/ai_research/<topic>/<stage>.mdx`.

A topic's stage-3 model can be **promoted** to `/models` when polished — copy the formalization to a new `src/content/models/<slug>.mdx` entry.

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
