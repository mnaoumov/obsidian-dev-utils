/**
 * @file
 *
 * Type-checks the consumer-facing templates under `templates/`.
 *
 * The templates import the library by its published specifier (`obsidian-dev-utils/...`), which does not
 * resolve inside this repo — there is no `node_modules/obsidian-dev-utils` here. That is why they sit
 * outside `tsconfig.json`'s `include` and outside every ESLint `files` pattern, and it is how the 96.0.1
 * `parseVersionArgs` breakage shipped: a rename landed in the library source but not in the template beside
 * it, and nothing type-checked the template to notice.
 *
 * `tsconfig.templates.json` closes that gap with a `paths` shim mapping the published specifier onto the
 * emitted `dist/lib/esm/**\/*.d.mts` declarations — the exact surface a consumer resolves. Those
 * declarations are self-contained (proven by `build:validate-declarations`), so the templates program
 * carries nothing else and the check stays fast and leak-free.
 */

import { wrapCliTask } from '../src/script-utils/cli-utils.ts';
import { execFromRoot } from '../src/script-utils/root.ts';

await wrapCliTask(async () => {
  await execFromRoot('tsc --project ./tsconfig.templates.json');
});
