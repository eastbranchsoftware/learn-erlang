import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const lessons = defineCollection({
  loader: glob({ pattern: '**/[^_]*.mdx', base: './src/content/lessons' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    postNumber: z.number(),
    publishDate: z.date(),
    tags: z.array(z.string()),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
    prerequisites: z.array(z.number()).optional(),
  }),
});

export const collections = { lessons };
