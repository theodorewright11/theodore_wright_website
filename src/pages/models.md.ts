import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { modelToMd, bundleHeader, section, sortByDate } from '../lib/bundle';

export const GET: APIRoute = async () => {
  const models = sortByDate(await getCollection('models'));
  const head = bundleHeader('Models', 'Every model writeup on the site as one markdown file.');
  const body = [head, section('Models', models.map(modelToMd))].join('');
  return new Response(body, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
};
