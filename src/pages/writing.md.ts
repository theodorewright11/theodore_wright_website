import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { blogToMd, bundleHeader, section, sortByDate } from '../lib/bundle';

export const GET: APIRoute = async () => {
  const blog = sortByDate(await getCollection('blog', ({ data }) => !data.draft));
  const head = bundleHeader('Writing', 'Every published essay on the site as one markdown file.');
  const body = [head, section('Writing', blog.map(blogToMd))].join('');
  return new Response(body, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
};
