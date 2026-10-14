import { ObsidianPluginRepoPaths } from '@mnaoumov/obsidian-dev-toolkit/obsidian-plugin-repo-paths';
import { wrapCliTask } from '@mnaoumov/typescript-dev-toolkit/cli-utils';

import { buildIntegrationTestPlugin } from './helpers/build-integration-test-plugin.ts';

await wrapCliTask(async () => {
  await buildIntegrationTestPlugin({
    outDirectory: ObsidianPluginRepoPaths.DistIntegrationTestPlugin,
    shouldGenerateSourceMap: false
  });
});
