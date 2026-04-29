import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { researchToMd, bundleHeader, section, sortByDate } from '../lib/bundle';

export const GET: APIRoute = async () => {
  const research = sortByDate(await getCollection('research'));
  const head = bundleHeader('My Research', 'Every research entry on the site as one markdown file.');
  const body = [head, section('My Research', research.map(researchToMd))].join('');
  return new Response(body, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
};
