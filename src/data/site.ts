// ─────────────────────────────────────────────────────────────────────────────
// SITE COPY — every editable string that isn't attached to a specific piece of
// content lives here. Edit this file, save, done.
//
// NOT here (this text belongs with the thing it describes):
//   • Essays, research entries, models, AI stages → frontmatter in the .mdx file
//     under src/content/<collection>/
//   • Dashboard names + one-line descriptions   → src/data/dashboards.json
//   • Planned AI-research topics                → src/data/ai_research_planned.json
// ─────────────────────────────────────────────────────────────────────────────

export const siteName = 'Teddy Wright';

/** Default <meta description> for pages that don't set their own. */
export const siteDescription = 'Teddy Wright — CS & AI researcher, writer, builder.';

// ── Who you are ──────────────────────────────────────────────────────────────
// `credentials` shows under your name on the home page AND as the /research
// intro. `blurb` shows on the home page AND as the /writing intro.
export const bio = {
  name: 'Teddy Wright',
  credentials:
    'Computer Science (AI emphasis) major and Economics minor at the University of Utah, expected Apr 2028. Pursuing a career in AI governance research.',
  blurb:
    "Writings here span evolutionary biology, game theory, philosophy, the extremity to which modern society is different than what we evolved in, and whatever else I feel connects to the strange place the earth is and how we all appeared with consciousness here and have to deal with it. I'm also very interested in how AI is shaping the information landscape, how we form beliefs and make decisions, why education needs a heavy overhaul now that AI exists, how to characterize the behavior of LLMs and define them better, and detailed measurement of how work across tasks is shifting as AI takes over what it holds comparative advantage in — writing, art, coding.",
  location: 'Salt Lake City, UT',
  email: 'theodorewrightwork@gmail.com',
  substack: 'https://substack.com/@theodorealan',
  github: 'https://github.com/theodorewright11?tab=repositories',
  linkedin: 'https://www.linkedin.com/in/teddywright/',
};

// ── Top nav ──────────────────────────────────────────────────────────────────
// Renaming a label here is safe. Changing an `href` means renaming the matching
// file in src/pages/ too.
export const nav = [
  { href: '/research', label: 'Research', match: ['/research'] },
  { href: '/writing', label: 'Writing', match: ['/writing'] },
  { href: '/other', label: 'Other', match: ['/other', '/dashboards', '/models', '/ai-research'] },
];

// ── Sub-nav shown on /other and its three sections ───────────────────────────
export const sectionNav = [
  { href: '/other', label: 'Overview', exact: true },
  { href: '/dashboards', label: 'Dashboards' },
  { href: '/models', label: 'Models' },
  { href: '/ai-research', label: 'AI’s Research' },
];

// ── The three blocks under "Other" ───────────────────────────────────────────
// Used twice: the right-hand column on the home page, and the section
// headers on /other. One edit changes both.
export const otherSections = [
  {
    href: '/dashboards',
    label: 'Dashboards',
    desc: 'Tools for different use cases — tracking spending, logging time, coding qualitative data.',
  },
  {
    href: '/models',
    label: 'Models',
    desc: 'Breakdowns of something into its parts, and how those parts interact.',
  },
  {
    href: '/ai-research',
    label: 'AI’s Research',
    desc: 'Topics researched by an LLM in six stages: lit review, topology, model, data, build, writeup.',
  },
];

// ── Page headings and intro paragraphs ───────────────────────────────────────
// `title` is the big heading; `blurb` is the paragraph under it.
export const pages = {
  research: {
    title: 'Research',
    blurb: bio.credentials, // deliberately the same line as the home page
    groups: {
      publications: 'Publications',
      inProgress: 'In progress / planned',
    },
  },
  writing: {
    title: 'Writing',
    blurb: bio.blurb, // deliberately the same paragraph as the home page
    substackNote: 'Also on', // followed by a link reading "Substack"
  },
  other: {
    title: 'Other',
    blurb: 'Dashboards, interactive models, and research run by an LLM.',
  },
  dashboards: {
    title: 'Dashboards',
    blurb:
      'Tools I built for myself and left open. Everything runs in your own browser — your data never touches my server, and you only ever see your own.',
    upcomingGroup: 'In progress / planned',
  },
  models: {
    title: 'Models',
    blurb:
      'Interactive models that break phenomena down into quantified, isolated logic. Useful for getting a grasp on complex things in the world.',
  },
  aiResearch: {
    title: 'AI’s Research',
    blurb:
      'A pipeline where I set AI loose on topics I choose. Five main stages — lit review, topology, model, data, build. Every stage produces a writeup plus a possible artifact, and every finished topic ends in a final writeup and artifact(s) (tool, dashboard, explainer, etc.) that any person can use.',
    groups: { finished: 'Finished', inProgress: 'In Progress', planned: 'Planned' },
  },
};

// ── Footer ───────────────────────────────────────────────────────────────────
export const footer = {
  downloadLabel: 'Download',
  downloads: [
    { href: '/research.md', label: 'My research ↓' },
    { href: '/writing.md', label: 'My writing ↓' },
    { href: '/bundle-ai-research.md', label: "AI's research ↓" },
    { href: '/bundle-all.md', label: 'All ↓' },
  ],
  contacts: [
    { href: bio.linkedin, label: 'LinkedIn', external: true },
    { href: bio.github, label: 'GitHub', external: true },
    { href: bio.substack, label: 'Substack', external: true },
    { href: `mailto:${bio.email}`, label: 'Email', external: false },
  ],
  themes: [
    { value: 'paper', label: 'Theme: Paper' },
    { value: 'white', label: 'Theme: White' },
    { value: 'dark', label: 'Theme: Dark' },
    { value: 'monokai', label: 'Theme: Monokai' },
    { value: 'monokai-light', label: 'Theme: Monokai Light' },
  ],
};
