/**
 * @file
 *
 * Generates Astro's ambient types when they are missing, so a type-aware lint of the documentation
 * sources can resolve what they import.
 *
 * `docs/src/content.config.ts` imports `defineCollection` from `astro:content`, and
 * `docs/src/route-data.ts` reads `import.meta.env`. Both are virtual: nothing on disk declares them until
 * Astro writes `.astro/types.d.ts`, which `docs/tsconfig.json` includes. That directory is gitignored and
 * is produced only by `astro sync` / `astro build` / `astro dev`, so on a fresh clone it does not exist
 * and every use of `defineCollection` is `error`-typed — `npm run lint` then fails with six
 * `no-unsafe-*` / `restrict-template-expressions` errors in two files nobody has touched. `npm run gate`
 * and `npm run version`'s preflight both call `lint`, so the entire release path is unreachable from a
 * clean checkout until something has run Astro once.
 *
 * Nobody noticed because no CI workflow ran `lint` (`lint.yml` now does), and the maintainer's
 * own checkout carried a stale `docs/.astro/` from an earlier layout that the old, wrongly-rooted
 * `include` happened to find.
 *
 * The sync is skipped when the types are already there. `lint:fix` is a pre-commit step, and paying
 * Astro's startup on every commit would buy nothing for these rules: what they need is the
 * `astro:content` / `astro/client` module declarations, which do not change with the collection
 * contents.
 */

import { existsSync } from 'node:fs';

import { ObsidianDevUtilsRepoPaths } from '../../src/script-utils/obsidian-dev-utils-repo-paths.ts';
import {
  execFromRoot,
  resolvePathFromRootSafe
} from '../../src/script-utils/root.ts';

/**
 * Runs `astro sync` when Astro's generated ambient types are absent.
 *
 * @returns A {@link Promise} that resolves once the types are known to exist.
 */
export async function syncAstroTypesIfMissing(): Promise<void> {
  const typesPath = resolvePathFromRootSafe({ path: ObsidianDevUtilsRepoPaths.AstroGeneratedTypesDts });
  if (existsSync(typesPath)) {
    return;
  }

  await execFromRoot(['astro', 'sync']);
}
