import { getNanoStagedConfig } from '../src/script-utils/nano-staged-config.ts';
import { getPackageManagerRunCommand } from '../src/script-utils/package-manager.ts';

/*
 * The `.astro` entry is this repo's own, not the shared config's: only this repo's ESLint config loads
 * `eslint-plugin-astro`, so a consumer given the glob would be handed files its ESLint cannot lint. Lint only,
 * with no `format` step beside it: none of the dprint plugins formats Astro.
 *
 * It goes in as a WRITER rather than as a key spread over the shared config: `lint:fix` rewrites the file, and
 * only `additionalWriterTasks` takes `.astro` files out of the spellcheck-only key, which would otherwise read
 * them while ESLint rewrites them.
 */
export const config = getNanoStagedConfig({
  additionalWriterTasks: {
    '*.astro': [
      `${getPackageManagerRunCommand().join(' ')} lint:fix --`
    ]
  }
});
