import { buildCompileTypeScript } from '../src/script-utils/build.ts';
import { wrapCliTask } from '../src/script-utils/cli-utils.ts';

await wrapCliTask(async () => {
  await buildCompileTypeScript();
});
