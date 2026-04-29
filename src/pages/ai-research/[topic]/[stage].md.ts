import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { aiStageToMd } from '../../../lib/bundle';

export const getStaticPaths: GetStaticPaths = async () => {
  const all = await getCollection('ai_research');
  return all
    .filter(e => !e.slug.endsWith('/overview'))
    .map(entry => {
      const [topic, stage] = entry.slug.split('/');
      return { params: { topic, stage }, props: { entry } };
    });
};

export const GET: APIRoute = async ({ props }) => {
  const entry = (props as any).entry;
  return new Response(aiStageToMd(entry), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
