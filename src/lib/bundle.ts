import type { CollectionEntry } from 'astro:content';
import bio from '../data/bio.json';
import now from '../data/now.json';

export const fmt = (date: Date) => date.toISOString().slice(0, 10);

export const stripImports = (body: string) =>
  body.replace(/^\s*import\s+[^;]+from\s+['"][^'"]+['"]\s*;?\s*$/gm, '').trim();

export const sortByDate = <T extends { data: { date: Date } }>(arr: T[]) =>
  arr.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

export const bundleHeader = (sectionTitle: string, descriptor: string) => [
  `# ${bio.name} — ${sectionTitle}`,
  '',
  `Generated ${fmt(new Date())} from theodorewright.dev. ${descriptor}`,
  '',
  `**About:** ${bio.blurb}`,
  '',
  `**Site status (as of ${now.updated}):** ${now.line}`,
  '',
  `**Contact:** ${bio.email} · ${bio.substack} · ${bio.github}`,
].join('\n');

export const section = (heading: string, items: string[]) =>
  items.length ? `\n\n# ${heading}\n\n${items.join('\n\n---\n\n')}` : '';

export const blogToMd = (p: CollectionEntry<'blog'>) => [
  `## ${p.data.title}`,
  `*${fmt(p.data.date)} · tier: ${p.data.tier}*`,
  '',
  p.data.description,
  '',
  stripImports(p.body),
].join('\n');

export const researchToMd = (r: CollectionEntry<'research'>) => [
  `## ${r.data.title}`,
  `*${fmt(r.data.date)} · ${r.data.status}` +
    (r.data.collaborators?.length ? ` · with ${r.data.collaborators.join(', ')}` : '') +
    (r.data.venue ? ` · ${r.data.venue}` : '') + '*',
  r.data.paperUrl ? `Paper: https://theodorewright.dev${r.data.paperUrl}` : '',
  r.data.externalUrl ? `External: ${r.data.externalUrl}` : '',
  '',
  r.data.description,
  '',
  stripImports(r.body),
].filter(Boolean).join('\n');

export const modelToMd = (m: CollectionEntry<'models'>) => [
  `## ${m.data.title}`,
  `*${fmt(m.data.date)} · ${m.data.status}*`,
  '',
  m.data.description,
  '',
  stripImports(m.body),
].join('\n');

export const updateToMd = (u: CollectionEntry<'updates'>) => [
  `## ${u.data.title}`,
  `*${fmt(u.data.date)} · ${u.data.period}*`,
  '',
  u.data.description ?? '',
  '',
  stripImports(u.body),
].join('\n');

export const aiStageToMd = (a: CollectionEntry<'ai_research'>) => {
  const [topic, stage] = a.slug.split('/');
  return [
    `## ${a.data.title}`,
    `*topic: ${topic} · stage: ${stage} · pass ${a.data.refinementPass} · ${a.data.status}*`,
    '',
    a.data.description,
    '',
    stripImports(a.body),
  ].join('\n');
};

export const singlePageMd = (title: string, body: string, meta: string) => [
  `# ${title}`,
  '',
  `*${meta}*`,
  '',
  body,
  '',
  '---',
  '',
  `From theodorewright.dev — ${bio.email}`,
].join('\n');
