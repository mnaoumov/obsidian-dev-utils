import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import starlightTypeDoc, { typeDocSidebarGroup } from 'starlight-typedoc';

// The documentation site is a self-contained Astro + Starlight project. Its source lives under `docs/`
// (`srcDir`) so it never collides with the library's own `src/` and `dist/`. The API reference is
// generated from the library's TSDoc by `starlight-typedoc` (TypeDoc + `typedoc-plugin-markdown`) during
// the Astro build. See `scripts/docs-build.ts` / the `docs:*` npm scripts.
export default defineConfig({
  base: '/obsidian-dev-utils',
  outDir: './docs/dist',
  publicDir: './docs/public',
  site: 'https://mnaoumov.dev',
  srcDir: './docs',
  trailingSlash: 'always',
  integrations: [
    starlight({
      editLink: {
        baseUrl: 'https://github.com/mnaoumov/obsidian-dev-utils/tree/main/docs/'
      },
      plugins: [
        starlightTypeDoc({
          entryPoints: ['./src'],
          sidebar: {
            collapsed: true,
            label: 'API reference'
          },
          tsconfig: './tsconfig.json',
          typeDoc: {
            // Document every public source module (one per file) so the site mirrors the many `./*`
            // subpath exports.
            entryPointStrategy: 'expand',
            exclude: [
              '**/*.test.ts',
              '**/index.ts',
              '**/__merged.ts',
              '**/setup.ts',
              '**/*-setup.ts',
              '**/@types/**',
              '**/styles/**',
              '**/test-helpers/**',
              '**/*.d.ts'
            ],
            excludeInternal: true,
            // Protected members are part of the extendable API (documented with TSDoc for subclassers),
            // so include them even though starlight-typedoc excludes them by default.
            excludeProtected: false,
            // Re-attach the `@file` module overviews that TypeDoc would otherwise drop.
            plugin: ['./docs/typedoc-file-overview.ts'],
            // A real readme keeps `starlight-typedoc` from deleting every module overview page (it drops all
            // `README.md` pages when `readme` is `'none'`).
            readme: './docs/api-readme.md'
          }
        })
      ],
      sidebar: [
        {
          items: [{ autogenerate: { directory: 'guides' } }],
          label: 'Guides'
        },
        typeDocSidebarGroup
      ],
      social: [
        {
          href: 'https://github.com/mnaoumov/obsidian-dev-utils',
          icon: 'github',
          label: 'GitHub'
        }
      ],
      title: 'Obsidian Dev Utils'
    })
  ]
});
