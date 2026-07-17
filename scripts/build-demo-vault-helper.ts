import { wrapCliTask } from '../src/script-utils/cli-utils.ts';
import { buildDemoVaultHelper } from './helpers/build-demo-vault-helper.ts';

await wrapCliTask(async () => {
  await buildDemoVaultHelper();
});
