import { getNanoStagedConfig } from '../src/script-utils/nano-staged-config.ts';
import { getPackageManagerRunCommand } from '../src/script-utils/package-manager.ts';

/*
 * The `.astro` entry is this repo's own, not the shared config's: only this repo's ESLint config loads
 * `eslint-plugin-astro`, so a consumer given the glob would be handed files its ESLint cannot lint. Lint only,
 * with no `format` step beside it: none of the dprint plugins formats Astro.
 */
export const config = {
  ...getNanoStagedConfig(),
  '*.astro': [
    `${getPackageManagerRunCommand().join(' ')} lint:fix --`
  ]
};
