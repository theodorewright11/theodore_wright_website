import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { aiStageToMd, bundleHeader, section, sortByDate } from '../lib/bundle';

export const GET: APIRoute = async () => {
  const ai = sortByDate(await getCollection('ai_research'));
  const head = bundleHeader(
    "AI's Research",
    'Every stage of every AI-Research topic as one markdown file.'
  );
  const body = [head, section("AI's Research stages", ai.map(aiStageToMd))].join('');
  return new Response(body, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
};
