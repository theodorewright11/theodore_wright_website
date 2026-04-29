# Claude Code instructions for this project

## Read first

Before starting any task, read:

1. `PRD.md` — what the site does, what's in scope
2. `ARCHITECTURE.md` — how the system is built, where things go

If the task is ambiguous about which page, collection, or component pattern to use, **ask before implementing**. Don't guess.

## Update after every change

After any change that affects:

- Site sections, pages, content tiers, models registry, or scope → update `PRD.md`
- Folder structure, schemas, routing, design tokens, or component patterns → update `ARCHITECTURE.md`

Do this in the same commit. Specs that lag the code are worse than no specs.

## Commit and push after every meaningful change

When a logical unit of work completes (a feature, a bug fix, a content addition, a refactor):

1. Run `npm run build` to confirm it compiles.
2. `git add` the touched files (specific paths — don't `git add -A`).
3. Commit with a one-line message describing the change in active voice.
4. `git push` to the remote.

A "logical unit of work" is whatever the user asked for, not every file edit. Don't commit half-done work. Don't skip pre-commit hooks. If the user explicitly asks not to push (or to wait), don't push.

Never run destructive git commands (`reset --hard`, `push --force`, `branch -D`) without the user explicitly asking.

## Code quality rules

- **TypeScript** for all React components. No `any` without justification.
- **Defensive at boundaries only**. Don't validate inputs from internal code. Validate at file/network/user boundaries.
- **No premature abstraction**. Three similar lines is fine. Extract on the fourth.
- **Comments**: only when the *why* is non-obvious. No comments restating what the code does.
- **Match the design system**. Use existing tokens (`max-w-3xl`, `primary-*` colors, Inter, left-rule cards) — don't invent new ones without updating `ARCHITECTURE.md`.
- **Tests**: not yet required for this site (it's a content site). When interactive model components get complex, add Vitest unit tests.

## LLM Iterate refinement loop

When working in an `ai-research` topic, every refinement pass appends an entry to `refinementLog` in that stage's frontmatter:

```yaml
refinementLog:
  - pass: 3
    date: '2026-04-27'
    passes: ['gap scan', 'compression']
    why: 'noticed missing connections to free energy literature; intro was bloated'
    changes:
      - 'Added FEP section (~200 words)'
      - 'Compressed intro from 6 paragraphs to 3'
      - 'Pulled out duplicate definition of "salience"'
```

After each pass, output to the chat:

```
- REFINEMENT: [which passes you ran]
- WHY: [1-2 sentences on what you saw that needed it]
- CHANGES: [bullet list of what moved]
```

Increment `refinementPass` on each pass.

## Stage outputs convention

Raw outputs from each LLM iterate session live in `stage_outputs/<topic>/<stage>.md`. These are working drafts. When ready to publish:

1. Move polished content to `src/content/ai_research/<topic>/<stage>.mdx`
2. Add proper frontmatter (title, description, date, status, refinementPass, refinementLog)
3. Bump `refinementPass` and append to `refinementLog`

## When to ask vs proceed

**Proceed without asking when:**

- The task fits an existing pattern (new model page, new essay, new AI research stage)
- The change is reversible and small
- PRD/ARCHITECTURE clearly say where it goes

**Ask first when:**

- A new section/page type is being introduced (new top-level URL)
- The design system would need to expand (new color, new font, new card pattern)
- Auth or hosting setup is involved
- A change touches multiple existing pages
- The task is ambiguous about what artifact to produce

## Routine ops

- **New essay**: `src/content/blog/<slug>.mdx` with frontmatter `tier: 'mine' | 'collab' | 'ai-led'`
- **New model**: `src/content/models/<slug>.mdx` + (if interactive) `src/components/models/<Name>Dashboard.tsx`. Promote interesting AI-research models here when polished.
- **New AI research topic**: create `src/content/ai_research/<topic>/` and `stage_outputs/<topic>/`, add a minimal placeholder `overview.mdx` (do **not** write substantive overview content during the pipeline — the writeup stage is the canonical synthesis once the pipeline is complete), then 6 stage files as work progresses (lit-review, topology, model, data, build, writeup)
- **Promote a stage-3 model to /models**: copy the formalization to a new `src/content/models/<slug>.mdx`, set `featured: true` if it should show on `/models` index prominently

## Don't

- Don't create README.md, docs/, or other ad-hoc doc files. Use PRD.md and ARCHITECTURE.md.
- Don't introduce new top-level routes without updating PRD.
- Don't fork the design system. If something doesn't fit, raise it.
- Don't commit generated `dist/` or `node_modules/`.
