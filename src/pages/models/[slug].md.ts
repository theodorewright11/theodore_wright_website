import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { modelToMd } from '../../lib/bundle';

export const getStaticPaths: GetStaticPaths = async () => {
  const models = await getCollection('models');
  return models.map(entry => ({ params: { slug: entry.slug }, props: { entry } }));
};

export const GET: APIRoute = async ({ props }) => {
  const entry = (props as any).entry;
  return new Response(modelToMd(entry), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
