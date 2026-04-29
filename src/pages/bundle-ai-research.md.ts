import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { aiStageToMd, bundleHeader, section, sortByDate } from '../lib/bundle';

export const GET: APIRoute = async () => {
  const aiResearch = sortByDate(await getCollection('ai_research'));

  const head = bundleHeader(
    "AI's Research bundle (LLM Iterate pipeline)",
    'Every stage of every AI-Research topic on the site as one markdown file — ' +
      'the full output of the LLM Iterate pipeline (lit review → topology → model → data → build → writeup). ' +
      'For my own writing, research, and models, see /bundle-mine.md.'
  );

  const body = [
    head,
    section("AI's Research stages", aiResearch.map(aiStageToMd)),
  ].join('');

  return new Response(body, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
