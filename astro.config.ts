import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import {
  existsSync,
  readFileSync
} from 'node:fs';
import { resolve } from 'node:path';

import { remarkRelativeLinks } from './scripts/docs-gen/helpers/remark-plugins/remark-relative-links.ts';

// The documentation site is a self-contained Astro + Starlight project. Its source lives under `docs/src`
// (`srcDir`) so it never collides with the library's own `src/` and `dist/`. The API reference is
// generated from the library's TSDoc by the custom generator (`scripts/docs-gen`, ts-morph) into
// `docs/src/content/docs/api`, with a matching `docs/src/generated-sidebar.json` consumed below.
const BASE = '/obsidian-dev-utils';

export default defineConfig({
  base: BASE,
  outDir: './docs/dist',
  publicDir: './docs/public',
  site: 'https://mnaoumov.dev',
  srcDir: './docs/src',
  trailingSlash: 'always',
  integrations: [
    starlight({
      components: {
        SiteTitle: './docs/src/components/SiteTitle.astro'
      },
      customCss: [
        './docs/src/styles/global.css'
      ],
      editLink: {
        baseUrl: 'https://github.com/mnaoumov/obsidian-dev-utils/tree/main/docs/src/content/docs/'
      },
      favicon: '/favicon.svg',
      routeMiddleware: './docs/src/route-data.ts',
      sidebar: [
        {
          items: [{ autogenerate: { directory: 'guides' } }],
          label: 'Guides'
        },
        ...getApiSidebar()
      ],
      social: [
        { href: 'https://github.com/mnaoumov/obsidian-dev-utils', icon: 'github', label: 'GitHub' }
      ],
      title: 'Obsidian Dev Utils'
    })
  ],
  markdown: {
    remarkPlugins: [remarkRelativeLinks(BASE)]
  }
});

function getApiSidebar() {
  const sidebarPath = resolve(import.meta.dirname, 'docs/src/generated-sidebar.json');
  if (!existsSync(sidebarPath)) {
    console.warn('[astro.config] generated-sidebar.json not found. Run the generator first (npm run docs:build).');
    return [];
  }
  return JSON.parse(readFileSync(sidebarPath, 'utf-8'));
}
