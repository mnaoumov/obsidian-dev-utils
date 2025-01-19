import { ObsidianPluginRepoPaths } from '../src/obsidian/Plugin/ObsidianPluginRepoPaths.ts';
import { join } from '../src/Path.ts';
import { wrapCliTask } from '../src/scripts/CliUtils.ts';
import {
  process,
  readFile,
  writeFile
} from '../src/scripts/NodeModules.ts';
import { publish } from '../src/scripts/NpmPublish.ts';
import { resolvePathFromRootSafe } from '../src/scripts/Root.ts';
import { updateVersion } from '../src/scripts/version.ts';

await wrapCliTask(async () => {
  const versionUpdateTypeStr = process.argv[2];
  await updateVersion(versionUpdateTypeStr, prepareGitHubRelease);
  const isBeta = versionUpdateTypeStr === 'beta';
  await publish(isBeta);
});

async function prepareGitHubRelease(newVersion: string): Promise<void> {
  const libraryCjsPath = resolvePathFromRootSafe(join(ObsidianPluginRepoPaths.Dist, ObsidianPluginRepoPaths.Lib, ObsidianPluginRepoPaths.LibraryCjs));
  const stylesCssPath = resolvePathFromRootSafe(join(ObsidianPluginRepoPaths.Dist, ObsidianPluginRepoPaths.StylesCss));
  let libraryCjsContent = await readFile(libraryCjsPath, 'utf-8');
  const stylesCssContent = await readFile(stylesCssPath, 'utf-8');
  libraryCjsContent = libraryCjsContent.replace('$(LIBRARY_VERSION)', newVersion);
  libraryCjsContent = libraryCjsContent.replace('$(LIBRARY_STYLES)', JSON.stringify(stylesCssContent).slice(1, -1));
  await writeFile(libraryCjsPath, libraryCjsContent, 'utf-8');
}
