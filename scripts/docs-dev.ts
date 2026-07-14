import { wrapCliTask } from '../src/script-utils/cli-utils.ts';
import { execFromRoot } from '../src/script-utils/root.ts';

await wrapCliTask(async () => {
  await execFromRoot(['jiti', 'scripts/docs-gen/generate-api-docs.ts']);
  // `ASTRO_DEV_BACKGROUND` forces Astro's foreground dev server. Astro otherwise switches to a background launcher (hardcoded 30s startup timeout) under an agent / non-interactive environment.
  await execFromRoot(['astro', 'dev'], {
    env: {
      ASTRO_DEV_BACKGROUND: '1'
    },
    isInteractive: true
  });
});
