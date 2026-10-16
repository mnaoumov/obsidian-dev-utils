import { satteri } from '@astrojs/markdown-satteri';
// eslint-disable-next-line import-x/no-rename-default -- The default export name `StarlightIntegration` is too verbose.
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { satteriGitHubAlerts } from './scripts/docs-gen/helpers/satteri-plugins/satteri-github-alerts.ts';
import { satteriRelativeLinks } from './scripts/docs-gen/helpers/satteri-plugins/satteri-relative-links.ts';

// The documentation site is a self-contained Astro + Starlight project. Its source lives under `docs/src`
// (`srcDir`) so it never collides with the library's own `src/` and `dist/`. `obsidian-dev-utils` is retired in
// favour of the five `@mnaoumov/*` packages, each with a site of its own, so this one is a landing page pointing at
// them plus one redirect per page the old site served (`docs/old-site-redirects.json`).
const BASE = '/obsidian-dev-utils';

export default defineConfig({
  base: BASE,
  integrations: [
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
  redirects: getOldSiteRedirects(),
  site: 'https://mnaoumov.dev',
  // eslint-disable-next-line unicorn/name-replacements -- `srcDir` is an Astro config key.
  srcDir: './docs/src',
  trailingSlash: 'always'
});

/**
 * Reads the redirect map for every page the retired site served: an old path, relative to the base, to the page
 * that replaced it on one of the five package sites. The old pages no longer exist anywhere, so the map is frozen
 * data rather than something a build could derive; Astro emits a meta-refresh page for each entry, which is all
 * GitHub Pages can serve.
 *
 * @returns The redirects, keyed by old path.
 */
function getOldSiteRedirects(): Record<string, string> {
  const redirectsPath = resolve(import.meta.dirname, 'docs/old-site-redirects.json');
  return JSON.parse(readFileSync(redirectsPath, 'utf-8')) as Record<string, string>;
}
