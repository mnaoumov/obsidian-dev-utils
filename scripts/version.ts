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
  const VERSION_UPDATE_TYPE_ARG_INDEX = 2;
  const versionUpdateTypeStr = process.argv[VERSION_UPDATE_TYPE_ARG_INDEX];
  await updateVersion(versionUpdateTypeStr, prepareGitHubRelease);
  const isBeta = versionUpdateTypeStr?.includes('beta');
  await publish(isBeta);
});

async function prepareGitHubRelease(newVersion: string): Promise<void> {
  const stylesCssPath = resolvePathFromRootSafe(join(ObsidianPluginRepoPaths.Dist, ObsidianPluginRepoPaths.StylesCss));
  const stylesCssContent = await readFile(stylesCssPath, 'utf-8');
  const stylesCssContentJson = JSON.stringify(stylesCssContent);

  const libraryCjsPath = resolvePathFromRootSafe(join(ObsidianPluginRepoPaths.Dist, ObsidianPluginRepoPaths.Lib, ObsidianPluginRepoPaths.LibraryCjs));
  const libraryMjsPath = resolvePathFromRootSafe(join(ObsidianPluginRepoPaths.Dist, ObsidianPluginRepoPaths.Lib, ObsidianPluginRepoPaths.LibraryMjs));

  for (const libraryPath of [libraryCjsPath, libraryMjsPath]) {
    let libraryContent = await readFile(libraryPath, 'utf-8');
    libraryContent = libraryContent.replace('$(LIBRARY_VERSION)', newVersion);
    libraryContent = libraryContent.replace('"$(LIBRARY_STYLES)"', stylesCssContentJson);
    await writeFile(libraryPath, libraryContent, 'utf-8');
  }
}
