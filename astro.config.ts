import { satteri } from '@astrojs/markdown-satteri';
// eslint-disable-next-line import-x/no-rename-default -- The default export name `createPlugin` does not say which plugin.
import sitemap from '@astrojs/sitemap';
// eslint-disable-next-line import-x/no-rename-default -- The default export name `StarlightIntegration` is too verbose.
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

import { satteriGitHubAlerts } from './scripts/docs-gen/helpers/satteri-plugins/satteri-github-alerts.ts';
import { satteriRelativeLinks } from './scripts/docs-gen/helpers/satteri-plugins/satteri-relative-links.ts';

// The documentation site is a self-contained Astro + Starlight project. Its source lives under `docs/src`
// (`srcDir`) so it never collides with the library's own `src/` and `dist/`. `obsidian-dev-utils` is retired in
// favour of the five `@mnaoumov/*` packages, each with a site of its own, so this one is a landing page pointing at
// them plus one "this page has moved" page per page the old site served (`docs/src/pages/[...old].astro`, built from
// `docs/old-site-redirects.json`).
const BASE = '/obsidian-dev-utils';
const SITE = 'https://mnaoumov.dev';

export default defineConfig({
  base: BASE,
  integrations: [
    // Starlight adds this integration itself unless one is already present. It is added here only to filter it: the
    // landing page is the one page worth indexing, and listing the 3522 `noindex` moved pages would contradict them.
    sitemap({
      filter: (page): boolean => page === `${SITE}${BASE}/`
    }),
    starlight({
      components: {
        SiteTitle: './docs/src/components/SiteTitle.astro'
      },
      customCss: [
        './docs/src/styles/global.css'
      ],
      editLink: {
        baseUrl: 'https://github.com/mnaoumov/obsidian-dev-utils/edit/main/'
      },
      favicon: '/favicon.svg',
      // Two pages, and the second is the 404 fallback: a "next page" link from the landing page would point at it.
      pagination: false,

      social: [
        { href: 'https://github.com/mnaoumov/obsidian-dev-utils', icon: 'github', label: 'GitHub' }
      ],
      title: 'Obsidian Dev Utils'
    })
  ],
  markdown: {
    // Astro 7.3 made Sätteri the default Markdown processor; `markdown.remarkPlugins` now runs only on the
    // `unified` processor from `@astrojs/markdown-remark`, which Astro no longer installs. Naming the
    // Sätteri processor here keeps the pipeline on it, carrying the link rewrite as one of its mdast plugins.
    // The GitHub-alert conversion rides here too, ahead of the asides plugin Starlight appends after these:
    // `starlight-github-alerts` cannot find that plugin on Starlight 0.42 and silently skipped every page.
    processor: satteri({ mdastPlugins: [satteriGitHubAlerts(), satteriRelativeLinks(BASE)] })
  },
  // eslint-disable-next-line unicorn/name-replacements -- `outDir` is an Astro config key.
  outDir: './docs/dist',
  // eslint-disable-next-line unicorn/name-replacements -- `publicDir` is an Astro config key.
  publicDir: './docs/public',
  site: SITE,
  // eslint-disable-next-line unicorn/name-replacements -- `srcDir` is an Astro config key.
  srcDir: './docs/src',
  trailingSlash: 'always'
});
