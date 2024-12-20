import { wrapCliTask } from '../src/scripts/CliUtils.ts';
import { updateVersion } from '../src/scripts/version.ts';
import { process } from '../src/scripts/NodeModules.ts';
import { execFromRoot } from '../src/scripts/Root.ts';
import { config } from 'dotenv';

interface NpmConfig {
  NPM_TOKEN: string;
}

await wrapCliTask(async () => {
  const versionUpdateTypeStr = process.argv[2];
  await updateVersion(versionUpdateTypeStr);

  const dotenvConfigOutput = config();
  const npmConfig = (dotenvConfigOutput.parsed ?? {}) as Partial<NpmConfig>
  await execFromRoot(['npm', 'config', 'set', '//registry.npmjs.org/:_authToken', npmConfig.NPM_TOKEN ?? '']);

  const tag = versionUpdateTypeStr === 'beta' ? 'beta' : 'latest';
  await execFromRoot(['npm', 'publish', '--tag', tag]);
});
