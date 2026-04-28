import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    draft: z.boolean().default(false),
    tags: z.array(z.string()).default([]),
    tier: z.enum(['mine', 'collab', 'ai-led']).default('mine'),
  }),
});

const research = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    status: z.enum(['in-progress', 'published', 'upcoming', 'contribution']).default('in-progress'),
    collaborators: z.array(z.string()).default([]),
    venue: z.string().optional(),
    paperUrl: z.string().optional(),       // local PDF in /public/papers/
    externalUrl: z.string().url().optional(), // outside link (e.g., MIT report)
    featured: z.boolean().default(false),
  }),
});

const models = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    status: z.enum(['draft', 'published']).default('draft'),
    featured: z.boolean().default(false),
    component: z.string().optional(),
    tags: z.array(z.string()).default([]),
  }),
});

const refinementEntry = z.object({
  pass: z.number(),
  date: z.string(),
  passes: z.array(z.string()),
  why: z.string(),
  changes: z.array(z.string()),
});

const ai_research = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    status: z.enum(['not-started', 'in-progress', 'complete']).default('in-progress'),
    refinementPass: z.number().default(0),
    refinementLog: z.array(refinementEntry).default([]),
  }),
});

const updates = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    date: z.coerce.date(),
    period: z.enum(['daily', 'weekly', 'monthly']).default('weekly'),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog, research, models, ai_research, updates };
