import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import {
  blogToMd, researchToMd, modelToMd, updateToMd, aiStageToMd,
  bundleHeader, section, sortByDate,
} from '../lib/bundle';

export const GET: APIRoute = async () => {
  const blog = sortByDate(await getCollection('blog', ({ data }) => !data.draft));
  const research = sortByDate(await getCollection('research'));
  const models = sortByDate(await getCollection('models'));
  const updates = sortByDate(await getCollection('updates', ({ data }) => !data.draft));
  const aiResearch = sortByDate(await getCollection('ai_research'));

  const head = bundleHeader(
    'full content bundle',
    'Everything on the site as one markdown file: my own writing, research, models, ' +
      'and updates, plus every stage of every AI-Research topic. For just my own work ' +
      'see /bundle-mine.md; for just the AI-Research pipeline output see /bundle-ai-research.md.'
  );

  const body = [
    head,
    section('Writing', blog.map(blogToMd)),
    section('My Research', research.map(researchToMd)),
    section('Models', models.map(modelToMd)),
    section('Updates', updates.map(updateToMd)),
    section("AI's Research stages", aiResearch.map(aiStageToMd)),
  ].join('');

  return new Response(body, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
