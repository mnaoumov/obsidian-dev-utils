import { wrapCliTask } from '../src/script-utils/cli-utils.ts';
import { ObsidianDevUtilsRepoPaths } from '../src/script-utils/obsidian-dev-utils-repo-paths.ts';
import { buildIntegrationTestPlugin } from './helpers/build-integration-test-plugin.ts';

await wrapCliTask(async () => {
  await buildIntegrationTestPlugin({
    outDir: ObsidianDevUtilsRepoPaths.DistIntegrationTestPlugin,
    shouldGenerateSourceMap: false
  });
});
