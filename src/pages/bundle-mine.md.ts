import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import {
  blogToMd, researchToMd, modelToMd, updateToMd,
  bundleHeader, section, sortByDate,
} from '../lib/bundle';

export const GET: APIRoute = async () => {
  const blog = sortByDate(await getCollection('blog', ({ data }) => !data.draft));
  const research = sortByDate(await getCollection('research'));
  const models = sortByDate(await getCollection('models'));
  const updates = sortByDate(await getCollection('updates', ({ data }) => !data.draft));

  const head = bundleHeader(
    'my content bundle',
    'My own writing, research, models, and updates — every essay, paper, model writeup, ' +
      'and weekly note on the site as one markdown file. ' +
      'AI-Research pipeline output is a separate bundle (see /bundle-ai-research.md).'
  );

  const body = [
    head,
    section('Writing', blog.map(blogToMd)),
    section('My Research', research.map(researchToMd)),
    section('Models', models.map(modelToMd)),
    section('Updates', updates.map(updateToMd)),
  ].join('');

  return new Response(body, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
