import { wrapCliTask } from '../src/script-utils/cli-utils.ts';
import { execFromRoot } from '../src/script-utils/root.ts';

await wrapCliTask(async () => {
  // `ASTRO_DEV_BACKGROUND` forces Astro's foreground dev server. Astro otherwise switches to a background launcher (hardcoded 30s startup timeout) under an agent / non-interactive environment, and the TypeDoc-based API generation on startup exceeds that.
  await execFromRoot(['astro', 'dev'], {
    env: {
      ASTRO_DEV_BACKGROUND: '1'
    },
    isInteractive: true
  });
});
