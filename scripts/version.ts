import { wrapCliTask } from '../src/scripts/CliUtils.ts';
import { updateVersion } from '../src/scripts/version.ts';
import { process } from '../src/scripts/NodeModules.ts';
import { execFromRoot } from '../src/scripts/Root.ts';

await wrapCliTask(async () => {
  const versionUpdateTypeStr = process.argv[2];
  await updateVersion(versionUpdateTypeStr);
  const tag = versionUpdateTypeStr === 'beta' ? 'beta' : 'latest';
  await execFromRoot(['npm', 'publish', '--tag', tag]);
});
