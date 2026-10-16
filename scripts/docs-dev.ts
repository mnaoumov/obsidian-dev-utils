import { wrapCliTask } from '@mnaoumov/typescript-dev-toolkit/cli-utils';
import { execFromRoot } from '@mnaoumov/typescript-dev-toolkit/root';

await wrapCliTask(async () => {
  // `ASTRO_DEV_BACKGROUND` forces Astro's foreground dev server. Astro otherwise switches to a background launcher (hardcoded 30s startup timeout) under an agent / non-interactive environment.
  await execFromRoot(['astro', 'dev'], {
    env: {
      ASTRO_DEV_BACKGROUND: '1'
    },
    isInteractive: true
  });
});
