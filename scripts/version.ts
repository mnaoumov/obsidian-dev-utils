import {
  readFile,
  writeFile
} from 'node:fs/promises';
import process from 'node:process';

import { join } from '../src/path.ts';
import { wrapCliTask } from '../src/script-utils/cli-utils.ts';
import { publish } from '../src/script-utils/npm-publish.ts';
import { ObsidianDevUtilsRepoPaths } from '../src/script-utils/obsidian-dev-utils-repo-paths.ts';
import {
  execFromRoot,
  resolvePathFromRootSafe
} from '../src/script-utils/root.ts';
import {
  parseVersionArgs,
  updateVersion
} from '../src/script-utils/version.ts';

const [, , ...args] = process.argv;

await wrapCliTask(async () => {
  await execFromRoot(['npm', 'run', 'build:templates']);
  const { options, versionUpdateType } = parseVersionArgs(args);
  await updateVersion(versionUpdateType, {
    ...options,
    prepareGitHubRelease
  });
  if (!options.shouldRelease) {
    return;
  }

  const isPreRelease = Boolean(versionUpdateType?.startsWith('pre')) || Boolean(versionUpdateType?.includes('-'));
  await publish(isPreRelease);
});

async function prepareGitHubRelease(newVersion: string): Promise<void> {
  const stylesCssPath = resolvePathFromRootSafe({ path: join(ObsidianDevUtilsRepoPaths.Dist, ObsidianDevUtilsRepoPaths.StylesCss) });
  const stylesCssContent = await readFile(stylesCssPath, 'utf-8');
  const stylesCssContentJson = JSON.stringify(stylesCssContent);

  const generatedCjsPath = resolvePathFromRootSafe({ path: join(ObsidianDevUtilsRepoPaths.DistLib, ObsidianDevUtilsRepoPaths.Cjs, ObsidianDevUtilsRepoPaths.GeneratedDuringBuildCjs) });
  const generatedMjsPath = resolvePathFromRootSafe({ path: join(ObsidianDevUtilsRepoPaths.DistLib, ObsidianDevUtilsRepoPaths.Esm, ObsidianDevUtilsRepoPaths.GeneratedDuringBuildMjs) });

  for (const generatedPath of [generatedCjsPath, generatedMjsPath]) {
    let generatedContent = await readFile(generatedPath, 'utf-8');
    generatedContent = generatedContent.replace('$(LIBRARY_VERSION)', newVersion);
    generatedContent = generatedContent.replace('"$(LIBRARY_STYLES)"', stylesCssContentJson);
    await writeFile(generatedPath, generatedContent, 'utf-8');
  }
}
