import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { aiStageToMd, bundleHeader, section } from '../../lib/bundle';

const stageOrder = ['lit-review', 'topology', 'model', 'data', 'build', 'writeup'] as const;
const stageRank: Record<string, number> = Object.fromEntries(
  stageOrder.map((s, i) => [s, i])
);

export const getStaticPaths: GetStaticPaths = async () => {
  const all = await getCollection('ai_research');
  const topics = new Set(all.map(e => e.slug.split('/')[0]).filter(Boolean));
  return Array.from(topics).map(topic => ({ params: { topic } }));
};

export const GET: APIRoute = async ({ params }) => {
  const topic = params.topic!;
  const all = await getCollection('ai_research');
  const entries = all
    .filter(e => e.slug.startsWith(`${topic}/`))
    .sort((a, b) => {
      const sa = a.slug.split('/')[1];
      const sb = b.slug.split('/')[1];
      return (stageRank[sa] ?? 99) - (stageRank[sb] ?? 99);
    });

  const overview = entries.find(e => e.slug.endsWith('/overview'));
  const stages = entries.filter(e => !e.slug.endsWith('/overview'));
  const title = overview?.data.title ?? topic;

  const head = bundleHeader(
    `AI's Research — ${title}`,
    `Every stage of the "${title}" topic, in pipeline order.`
  );

  const body = [head, section('Stages', stages.map(aiStageToMd))].join('');
  return new Response(body, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
};
