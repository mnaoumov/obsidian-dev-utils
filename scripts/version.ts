import { wrapCliTask } from '../src/scripts/CliUtils.ts';
import { process } from '../src/scripts/NodeModules.ts';
import { publish } from '../src/scripts/NpmPublish.ts';
import { updateVersion } from '../src/scripts/version.ts';

await wrapCliTask(async () => {
  const versionUpdateTypeStr = process.argv[2];
  await updateVersion(versionUpdateTypeStr);
  const isBeta = versionUpdateTypeStr === 'beta';
  await publish(isBeta);
});
