import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { blogToMd } from '../../lib/bundle';

export const getStaticPaths: GetStaticPaths = async () => {
  const blog = await getCollection('blog', ({ data }) => !data.draft);
  return blog.map(entry => ({ params: { slug: entry.slug }, props: { entry } }));
};

export const GET: APIRoute = async ({ props }) => {
  const entry = (props as any).entry;
  return new Response(blogToMd(entry), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
