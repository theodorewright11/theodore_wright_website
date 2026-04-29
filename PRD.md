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

- **Why continuing is easier than starting** *(option value)* — existence asymmetry from holding an option on future states
- **Why vivid pain feels worse than equal pain** *(suffering salience)* — perceived harm = actual harm × salience distortion
- **Parenting under uncertainty** *(parental decision-making)* — confidence/stakes/reversibility/disclosure framework

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

Raw working drafts live in `stage_outputs/<topic>/<stage>.md` (kebab-case topic slug, stage filename one of `lit-review`, `topology`, `model`, `data`, `build`, `writeup`). Polished versions move into `src/content/ai_research/<topic>/<stage>.mdx`.

The topic-level `overview.mdx` is **not written during the pipeline** — it is produced (or revised) only after all six stages are complete, since the writeup itself supersedes the overview as the canonical synthesis.

A topic's stage-3 model can be **promoted** to `/models` when polished — copy the formalization to a new `src/content/models/<slug>.mdx` entry.

### Topic registry

Active topics — folders exist in `src/content/ai_research/` and `stage_outputs/`:

| Topic slug | Title | Furthest stage |
|---|---|---|
| `human-psych-variation` | Psychology of Individual Differences | writeup (pass 1) |

Planned topics (full list in `prompts.md`): philosophy → personal decisions; philosophy → organizations; philosophy of mind / ethics / epistemology; evolution-modernity mismatch; navigating an AI world; emotions architecture; meaning & spirituality; bedrock generating functions; AI decompression; information fidelity; trust architecture; parent-child transmission; technology utilization architecture; prediction & calibration; AI cognitive profile. Each spins up its own folder pair when started.

## Dashboards

Each dashboard ships in two tiers:

| Tier | URL | Data | Audience |
|---|---|---|---|
| **Public demo** | `/dashboards/<name>` | Visitor's own data in `localStorage`, with CSV import/export | Anyone — uses the model on their own data, no auth |
| **Private** | `/dashboards/<name>/me` (gated) | Teddy's own data (private Google Sheet or gated JSON) | Teddy only, via Cloudflare Access |

**Default behavior**: a visitor lands on the public demo. They get the same UI Teddy uses, but the data starts empty / synthetic and lives only in their browser. They can export to CSV to persist; re-import on next visit. No backend, no account, no privacy concerns.

**Private tier** exists only for dashboards where Teddy's actual data is the point (life metrics, ongoing trackers). Cloudflare Access in front, build-time data fetch from a private source.

Initial dashboard candidates: decision-helper, finance, emotional-wellbeing.

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
- **Per-page downloads**: every content page has a uniform `download as .md` button at the top. Endpoints: `/writing.md`, `/writing/<slug>.md`, `/research.md`, `/research/<slug>.md`, `/models.md`, `/models/<slug>.md`, `/ai-research.md`, `/ai-research/<topic>.md` (whole topic in stage order), `/ai-research/<topic>/<stage>.md`. Shared rendering helpers live in `src/lib/bundle.ts`.

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
- **2026-04-28**: `human-psych-variation` model stage (pass 1) shipped — generating function `P = A_d + A_i + A_LD + C + E_m + E_s + I + μ(t)`, three closed-form pieces (Crow–Felsenstein AM inflation, Wilson saturation, genetic-nurture additive split), multivariate sex-difference Mahalanobis-D module, and a two-tab interactive dashboard at `src/components/ai-research/PsychVariationModel.tsx`.
- **2026-04-28**: `human-psych-variation` model stage (pass 2) — error check + adversarial/steelman + crux identification + compression. Fixed the method-gradient table (`V(A_i)` lands in C under correctly specified ACE, not in twin h²); flagged Crow–Felsenstein as a fixed-point and updated the dashboard to solve the equilibrium numerically; relabeled the misleading "16PF Del Giudice" preset to "16PF observed" with a note about the disattenuation gap; added §6.5 Adversarial+Steelman (4 objections) and §11 Cruxes (5 load-bearing claims).
- **2026-04-28**: `human-psych-variation` model stage (pass 3) — readability + redundancy prune + connections + scope check. Promoted §6.5 to §7 and renumbered downstream; added "How to read this stage" prelude after the dashboard for plain-language entry; added a scalar-trait scope note tying back to topology assumption A3 (g exists); compressed §4; generalized the multivariate-D module note (algebra applies to any two-group comparison, not just sex); dropped the hand-wavy Bedrock-Generating-Functions connection; expanded glossary from 8 to 19 entries.
- **2026-04-28**: `human-psych-variation` model stage (pass 4) — error check + calibration audit. Caught a real conceptual bug from pass 2: dashboard variance budget overflowed (twin h² output 1.19 at default load) because Wilson h²(t) was being treated as a random-mating quantity that got *inflated* by the AM factor; in fact Wilson is the AM-equilibrium quantity and AM should *partition* it. Fixed the budget; switched Wilson to logistic to match the empirical sigmoidal age curve; added c²_∞ asymptote; refactored V(A_i) = ratio_i²·V(A_d). All sanity-check anchors now hold.
- **2026-04-28**: `human-psych-variation` model stage (pass 5) — final math-pedantry audit. Three small fixes: §3.3 was overstating the 2·Cov(A_d, A_i) cross-term by treating the AM-coupling parameter k as ≈ 1 when it is empirically 0.1–0.5; §12 Crux C2 still referenced "Crow–Felsenstein fixed point" though pass-4 had moved the dashboard to a one-shot partition; §7 Objection 2 response replaced ambiguous "within 30–50% of" with trait-specific SNP-h²-as-fraction-of-twin-h² numbers (height ~85%, cognition ~50–70%, EA ~30–40%). After pass 5 the model formalization is at the level of polish where further refinement would be diminishing returns; stage is ready for handoff to data pipeline (Stage 4).
- **2026-04-28**: `human-psych-variation` data stage (pass 1) shipped — curated CSV-based empirical pipeline that confronts the model's six predictions with published consortium estimates. Inputs in `stage_outputs/human-psych-variation/data/` (heritability_estimates.csv, wilson_curve_cognition.csv, sex_differences_panel.csv, pgs_portability.csv, sources.csv); analysis in `pipeline.py`; published as `src/content/ai_research/human-psych-variation/data.mdx` with a six-tab interactive findings panel at `src/components/ai-research/PsychVariationData.tsx`. Five predictions hold cleanly (AM partition, Wilson curve, equicorrelated D vs disattenuated, PGS portability replication of Ding 2023 r=-0.95, xAM inflation Border 2022 R²=0.74); H1 method gradient is "mixed" because cross-paper estimates from different cohorts/methods don't satisfy strict ordering, while within-paper Howe 2022 holds. Numbers are web-verified against primary-source URLs (Polderman 2015, Howe 2022, Okbay 2022, Kong 2018, Border 2022, Horwitz 2023, Wainschtein 2022/2025, Ding 2023, Del Giudice 2012, Yengo 2022, Bouchard 2013).
- **2026-04-28**: `human-psych-variation` build stage (pass 1) shipped — reader's tool that translates the model formalization (seven variance components) and data pipeline (eight prediction tests) into a plain-language artifact for someone who wants to understand how and why people differ. Five views in `src/components/ai-research/PsychVariationExplorer.tsx`: trait lookup (10 traits across cognition / personality / psychiatric / attitudes / physical, each with three plain-language buckets — Direct genes / Family setup / Environment + chance — plus key environmental levers, two trap callouts, one take-away, primary sources), the four motivated-reasoning traps materialized from topology Variant D (D1 blank-slate, D2 hereditarian, D3 gender-similarities, D4 pop-evpsych — each with what they cite correctly + what they ignore + integrated reading), the asymmetric environmental-effects forest plot (severe insults cost 10–30 IQ pts; enrichment yields 1–5 pts; this is the single most action-relevant insight in the topic), three "heritability ≠ destiny" misreadings with worked examples, and seven take-aways calibrated to mainstream behavior-genetics consensus in 2026. Variance bucket numbers per trait are computed from the Stage-4 CSV (h²_observed, V(A_LD)/h² share from H2 partition, V(A_i) = (β_i/β_d)²·V(A_d) per pass-5 of the model). No new chart libs, only existing tailwind+SVG palette. Build artifact lives at `/ai-research/human-psych-variation/build`; the model dashboard and data findings panel remain as the technical/parametric layer.
- **2026-04-29**: Front-page trim. (1) `/updates` is now a "coming soon" placeholder — the page no longer lists entries and the home column shows a single coming-soon line. The existing weekly note still exists at `/updates/2026-04-week-17` as a deep link but is dropped from listings. (2) Models roster trimmed from 5 to 3 — kept option value, suffering salience, parental decision-making; removed `trust-tracker` and `social-output-efficiency` (the latter's AI Research scaffold was also removed). (3) Dashboards trimmed from 4 to 3: decision-tracker renamed to `decision-helper` with a plain-language description ("helps make complex decisions better by breaking them down qualitatively"), emotional-wellbeing description simplified ("helps you recognize and take action on your emotional needs"), social-environment removed. (4) Project Iceberg now surfaces `MIT` (its `venue`) on the home Research column. (5) Home masthead: `Wright` is no longer italic-light — it now matches `Teddy`'s display semibold. (6) Bio rewritten to a first-person blurb covering CS+Econ undergrad, Dec 2027 expected graduation, PhD targets (HCI / information science / computational social science), and the breadth of writing topics.
- **2026-04-29**: Second pass on copy + downloads. (1) Section descriptions rewritten throughout: AI's Research now reads as "a pipeline where I set AI loose on topics I choose"; Models as "interactive models that break phenomena down into quantified, isolated logic"; Dashboards as "usable interactive dashboards to help navigate modern life with its complexities"; Writing mirrors the home-page voice; Updates frames the page as a research-progress log for both Teddy and curious visitors. (2) Bio split into a `credentials` line (CS+Econ at Utah, Dec 2027, PhD targets) rendered as italic muted subtitle under the masthead name and a `blurb` (the cheeky "I have a problem where I think about way too many things" line) on the right. (3) `/updates` and `/ai-research` no longer mention "tabs"; the AI's Research planned list is now populated from `prompts.md` (17 topics, hardcoded list in `src/pages/ai-research/index.astro` until any of them get a folder). (4) `/models` and `/dashboards` now use the same Planned / In Progress / Finished grouping as `/ai-research` (mapped from the existing `published`/`draft` enum on models; `dashboards.json` gained an explicit `status` field). (5) The single `/content-bundle.md` was split into two: `/bundle-mine.md` (writing + research + models + updates) and `/bundle-ai-research.md` (every AI-Research stage). The footer now shows two download buttons (`mine ↓` and `ai's research ↓`). (6) Every content page (index + detail) gained a uniform `download as .md` button at the top, served by per-page markdown endpoints (`/writing.md`, `/writing/<slug>.md`, `/research.md`, `/research/<slug>.md`, `/models.md`, `/models/<slug>.md`, `/ai-research.md`, `/ai-research/<topic>.md`, `/ai-research/<topic>/<stage>.md`). Shared rendering helpers live in `src/lib/bundle.ts`. (7) `/research` renamed to "My Research" everywhere it's user-facing (Nav, page heading, back-links, page titles, home section label); URL stays `/research`. (8) Bottom "Set in Fraunces & Source Serif" colophon removed from the home page.
- **2026-04-28**: `human-psych-variation` data stage (pass 6) — gap scan. On a final reread, one substantive coverage gap surfaced: the model formalization explicitly names V(I) (G×E + G×G + G×age interaction terms) in its generating function, with the falsifiable claim "V(I) is small at PGS-by-environment scale; large only at extreme environmental insults." All five prior passes tested A_d, A_i, A_LD, E_m — but never V(I). Added gxe_interactions.csv with web-verified Tucker-Drob & Bates 2016 numbers (US a'=0.074, SE 0.020, p<.0005; non-US a'=−0.027, SE 0.022, n.s.; pooled a'=0.029, SE 0.019, n.s.; 43 effect sizes / 24,926 pairs / 14 studies / ~50k individuals); plus Turkheimer 2003 anchor (h²=0.10 low-SES → 0.72 high-SES) and Spengler 2018 German null replication. Added H8 prediction + 8th tab to React component (Scarr-Rowe forest plot of a' coefficients with 95% CI bands above Turkheimer's h²-by-SES bars). Verdict "supported_conditional" — the cross-national heterogeneity is the empirical confirmation of the threshold-conditional V(I) reading. After 6 passes the data stage tests every model-named variance component except E_s (residual stochastic noise, untestable by construction) and μ(t) (population-mean trajectory, partly captured by H3's Wilson curve).
- **2026-04-28**: `human-psych-variation` data stage (pass 5) — cross-stage error check + housekeeping + cell labeling. Pass 4's psychiatric-m correction created an internal inconsistency between stages 3 and 4: the model dashboard's psychopathology m_default was still 0.20 while the data stage now reports SCZ/ADHD/autism at 0.45 and BIP/MDD at 0.15–0.18. Bumped model dashboard psychopathology m_default from 0.20 → 0.30 with an inline comment about the AM heterogeneity (users testing AM-strong should slide to 0.45, AM-weak to 0.15). Synced the data.md working draft to current data.mdx state (was two passes behind). Improved opaque "assumed" CSV cell labels into assumption-type-explicit names ("assumed_no_WF_GWAS_at_scale" for psychiatric β_i/β_d; "extrapolated_from_EA_WF_and_EA_IQ_rg" for IQ within-family h² with the arithmetic shown in notes). After 5 passes the data stage is at diminishing returns; remaining "open" items (cell-by-cell audit of 18×20 CSV, individual-level Ding 2023 replication, full Border γ̂ verification across alternative AM dynamics models) require capabilities outside a content-site pipeline.
- **2026-04-28**: `human-psych-variation` data stage (pass 4) — error check + crux follow-through + readability. Pass 3 named D1 (cell-level extraction correctness) as the most consequential pipeline crux but didn't audit. Spot-checking the four psychiatric m values cited as "Nordsletten_2016_imputed" surfaced a real correction: web-verified Nordsletten 2016 reports tetrachoric spousal correlations >0.40 for schizophrenia, ADHD, and autism (and 0.14–0.19 for affective disorders), but my CSV had m=0.30 for all the AM-strong disorders. Updated heritability_estimates.csv: SCZ/ADHD/autism m 0.30→0.45, bipolar 0.20→0.18, MDD unchanged. The H2 partition shares lift correspondingly: SCZ V(A_LD)/h² 24%→36%, ADHD 22%→33%, autism 24%→36% — the substantively new reading is that ~1/3 of additive genetic variance for severe psychiatric conditions is structural AM-LD rather than independent direct biological signal. Also rewrote the H1 panel visualization as SVG-per-row (4 colored circles at the actual h² values along a 0–1 axis, with a grey range bar showing cross-paper noise width and a sienna/muted marker at the trait label indicating whether predicted ordering holds) — replaces the unreadable 6%-opacity bars and 1px ticks of passes 1–3.
- **2026-04-28**: `human-psych-variation` data stage (pass 3) — error check + compression + readability + crux identification. Three real issues from pass 2 fixed: (a) H5 was circular (curated 13 portability rows from approximations of Ding 2023's pattern, then "replicated" Ding's r=−0.95 with my own r=−0.98). Refactored pgs_portability.csv to use named per-ancestry literature anchors (Martin 2019: 37%/50%/78% accuracy reduction in SAS/EAS/AFR vs EUR; Okbay 2022 EA, Yengo 2022 height, Trubetskoy 2022 SCZ at per-trait/per-ancestry granularity) and reframed prose as "internally consistent literature trend, consistent with Ding 2023" not "replication." (b) TLDR rewritten for educated-lay readability — 3 paragraphs instead of 4, opens with plain-language framing instead of "the model formalization (Stage 3)…", added a glossary subsection right after the TLDR that defines h², m, twin/SNP/WGS/within-family, PGS, Mahalanobis D, V(E_m). (c) Added §10 Pipeline cruxes — 5 load-bearing assumptions of the data pipeline (D1 cell-level extraction correctness, D2 twin h² as h²_obs, D3 equicorrelated Σ qualitative validity, D4 within-paper requirement for clean H1, D5 per-ancestry/Ding concordance) with what would flip each. Mirrors model stage §12 structure.
- **2026-04-28**: `human-psych-variation` data stage (pass 2) — gap scan + error check + adversarial + connections + scope check. Caught three real holes from pass 1. (a) Gap: the model formalization names V(E_m) (measured non-shared environment) explicitly, but the pipeline had zero concrete environmental-effect numbers. Added `environmental_effects.csv` with 10 exposures (lead, schooling, iodine, FAS, PM2.5, deprivation, malnutrition, breastfeeding, adoption SES, parenting-within-normal) with effect sizes, CIs, and source citations. Added H7 prediction + 7th tab to React component. The asymmetry finding (severe insults cost 10–30 IQ pts; enrichment above normal yields ≤5 pts) is now the cleanest single-paragraph answer to "do environments matter and how." (b) Error: H1 verdict counted rows with only 1 estimator as "holds," producing the misleading "0/6" headline; new logic excludes untestable rows and reports 9/15 hold (with the 6 failures all in 3-estimator rows where SNP h² < within-family h² — informative pattern, not a model bug). γ̂ wording in H6 sharpened: γ̂≈1 is *consistent with* xAM accounting for the full correlation, not proof. (c) Promoted curated CSVs to `public/data/human-psych-variation/` — tracked in git, downloadable at /data/human-psych-variation/&lt;file&gt;.csv on the live site, available for Stage 5 to consume. (d) Added §6 Adversarial + steelman section with four objections (variance bookkeeping vs. new analysis, small CSV scale, Border 2022 contestation, hand-coded portability data — each with steelman + honest response). Added §8 Connections section linking pipeline anchors to the model dashboard's defaults, the planned parent-to-child transmission topic, and the planned evolution-modernity-mismatch topic.
