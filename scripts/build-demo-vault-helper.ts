import { wrapCliTask } from '@mnaoumov/typescript-dev-toolkit/cli-utils';

import { buildDemoVaultHelper } from './helpers/build-demo-vault-helper.ts';

await wrapCliTask(async () => {
  await buildDemoVaultHelper();
});
