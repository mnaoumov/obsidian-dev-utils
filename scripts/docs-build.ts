import { wrapCliTask } from '../src/script-utils/cli-utils.ts';
import { execFromRoot } from '../src/script-utils/root.ts';

await wrapCliTask(async () => {
  await execFromRoot(['jiti', 'scripts/docs-gen/generate-api-docs.ts']);
  await execFromRoot(['jiti', 'scripts/docs-gen/generate-og-images.ts']);
  await execFromRoot(['astro', 'build']);
});
