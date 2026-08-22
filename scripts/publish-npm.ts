import { prerelease } from 'semver';

import { wrapCliTask } from '../src/script-utils/cli-utils.ts';
import { publish } from '../src/script-utils/npm-publish.ts';
import { readPackageJson } from '../src/script-utils/npm.ts';

await wrapCliTask(async () => {
  const packageJson = await readPackageJson();
  const isBeta = prerelease(packageJson.version ?? '') !== null;
  await publish(isBeta);
});
