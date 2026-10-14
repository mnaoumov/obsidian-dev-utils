import { wrapCliTask } from '@mnaoumov/typescript-dev-toolkit/cli-utils';
import { execFromRoot } from '@mnaoumov/typescript-dev-toolkit/root';

await wrapCliTask(async () => {
  await execFromRoot(['node', 'scripts/run.mjs', 'scripts/docs-gen/generate-api-docs.ts']);
  await execFromRoot(['node', 'scripts/run.mjs', 'scripts/docs-gen/generate-og-images.ts']);
  await execFromRoot(['astro', 'build']);
  await execFromRoot(['node', 'scripts/run.mjs', 'scripts/docs-link-check.ts']);
});
