/**
 * @file
 *
 * Astro content-collection configuration for documentation pages.
 */

import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
// eslint-disable-next-line import-x/no-unresolved -- Astro generates this virtual module during its content build.
import { defineCollection } from 'astro:content';

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema()
  })
};
