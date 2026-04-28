import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import bio from '../data/bio.json';
import now from '../data/now.json';

const fmt = (date: Date) => date.toISOString().slice(0, 10);

const sortByDate = <T extends { data: { date: Date } }>(arr: T[]) =>
  arr.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

const stripImports = (body: string) =>
  body.replace(/^\s*import\s+[^;]+from\s+['"][^'"]+['"]\s*;?\s*$/gm, '').trim();

const section = (heading: string, items: string[]) =>
  items.length ? `\n\n# ${heading}\n\n${items.join('\n\n---\n\n')}` : '';

export const GET: APIRoute = async () => {
  const blog = sortByDate(await getCollection('blog', ({ data }) => !data.draft));
  const research = sortByDate(await getCollection('research'));
  const models = sortByDate(await getCollection('models'));
  const updates = sortByDate(await getCollection('updates', ({ data }) => !data.draft));
  const aiResearch = sortByDate(await getCollection('ai_research'));

  const head = [
    `# ${bio.name} — content bundle`,
    '',
    `Generated ${fmt(new Date())} from theodorewright.dev. ` +
      `One markdown file containing every published essay, research entry, model writeup, ` +
      `update, and AI-research stage on the site. Drop into any chat model to summarize, ` +
      `query, or critique.`,
    '',
    `**About:** ${bio.blurb}`,
    '',
    `**Site status (as of ${now.updated}):** ${now.line}`,
    '',
    `**Contact:** ${bio.email} · ${bio.substack} · ${bio.github}`,
  ].join('\n');

  const writingItems = blog.map(p => [
    `## ${p.data.title}`,
    `*${fmt(p.data.date)} · tier: ${p.data.tier}*`,
    '',
    p.data.description,
    '',
    stripImports(p.body),
  ].join('\n'));

  const researchItems = research.map(r => [
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
  ].filter(Boolean).join('\n'));

  const modelItems = models.map(m => [
    `## ${m.data.title}`,
    `*${fmt(m.data.date)} · ${m.data.status}*`,
    '',
    m.data.description,
    '',
    stripImports(m.body),
  ].join('\n'));

  const updateItems = updates.map(u => [
    `## ${u.data.title}`,
    `*${fmt(u.data.date)} · ${u.data.period}*`,
    '',
    u.data.description ?? '',
    '',
    stripImports(u.body),
  ].join('\n'));

  const aiItems = aiResearch.map(a => {
    const [topic, stage] = a.slug.split('/');
    return [
      `## ${a.data.title}`,
      `*topic: ${topic} · stage: ${stage} · pass ${a.data.refinementPass} · ${a.data.status}*`,
      '',
      a.data.description,
      '',
      stripImports(a.body),
    ].join('\n');
  });

  const body = [
    head,
    section('Writing', writingItems),
    section('Research', researchItems),
    section('Models', modelItems),
    section('Updates', updateItems),
    section("AI's Research (LLM Iterate pipeline)", aiItems),
  ].join('');

  return new Response(body, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
