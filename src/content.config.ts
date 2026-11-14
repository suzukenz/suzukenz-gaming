import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const games = defineCollection({
  loader: glob({
    pattern: '*.md',
    base: './src/content/games',
    generateId: ({ entry }) => slug.parse(entry.replace(/\.md$/, '')),
  }),
  schema: z.object({
    title: z.string().min(1),
  }),
});

const guides = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: './src/content/guides',
    generateId: ({ entry }) => entry.replace(/\.md$/, ''),
  }),
  schema: z
    .object({
      title: z.string().min(1),
      description: z.string().min(1),
      game: reference('games'),
      slug,
      publishedAt: z.coerce.date(),
      updatedAt: z.coerce.date().optional(),
      gameVersion: z.string().min(1).optional(),
    })
    .refine(
      ({ publishedAt, updatedAt }) => !updatedAt || updatedAt >= publishedAt,
      { message: '更新日は公開日以降にしてください。', path: ['updatedAt'] },
    ),
});

export const collections = { games, guides };
