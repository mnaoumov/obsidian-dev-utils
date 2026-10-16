import { wrapCliTask } from '@mnaoumov/typescript-dev-toolkit/cli-utils';
import { execFromRoot } from '@mnaoumov/typescript-dev-toolkit/root';

await wrapCliTask(async () => {
  await execFromRoot(['astro', 'build']);
  await execFromRoot(['node', 'scripts/run.mjs', 'scripts/docs-link-check.ts']);
});
