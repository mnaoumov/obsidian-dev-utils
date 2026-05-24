import { wrapCliTask } from '../src/script-utils/cli-utils.ts';
import { execFromRoot } from '../src/script-utils/root.ts';

await wrapCliTask(async () => {
  await execFromRoot('tsc --project ./tsconfig.validate-declarations.json');
  await execFromRoot('tsc --project ./tsconfig.validate-declarations-cjs.json');
});
