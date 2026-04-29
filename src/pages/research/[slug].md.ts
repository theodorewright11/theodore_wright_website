import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { researchToMd } from '../../lib/bundle';

export const getStaticPaths: GetStaticPaths = async () => {
  const research = await getCollection('research');
  return research.map(entry => ({ params: { slug: entry.slug }, props: { entry } }));
};

export const GET: APIRoute = async ({ props }) => {
  const entry = (props as any).entry;
  return new Response(researchToMd(entry), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
