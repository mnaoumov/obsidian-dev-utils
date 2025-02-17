import { join } from '../src/Path.ts';
import { wrapCliTask } from '../src/ScriptUtils/CliUtils.ts';
import {
  process,
  readFile,
  writeFile
} from '../src/ScriptUtils/NodeModules.ts';
import { publish } from '../src/ScriptUtils/NpmPublish.ts';
import { ObsidianDevUtilsRepoPaths } from '../src/ScriptUtils/ObsidianDevUtilsRepoPaths.ts';
import {
  execFromRoot,
  resolvePathFromRootSafe
} from '../src/ScriptUtils/Root.ts';
import { updateVersion } from '../src/ScriptUtils/version.ts';

await wrapCliTask(async () => {
  await execFromRoot(['npm', 'run', 'build:static']);
  const VERSION_UPDATE_TYPE_ARG_INDEX = 2;
  const versionUpdateTypeStr = process.argv[VERSION_UPDATE_TYPE_ARG_INDEX];
  await updateVersion(versionUpdateTypeStr, prepareGitHubRelease);
  const isBeta = versionUpdateTypeStr?.includes('beta');
  await publish(isBeta);
});

async function prepareGitHubRelease(newVersion: string): Promise<void> {
  const stylesCssPath = resolvePathFromRootSafe(join(ObsidianDevUtilsRepoPaths.Dist, ObsidianDevUtilsRepoPaths.StylesCss));
  const stylesCssContent = await readFile(stylesCssPath, 'utf-8');
  const stylesCssContentJson = JSON.stringify(stylesCssContent);

  const libraryCjsPath = resolvePathFromRootSafe(join(ObsidianDevUtilsRepoPaths.DistLib, ObsidianDevUtilsRepoPaths.Cjs, ObsidianDevUtilsRepoPaths.LibraryCjs));
  const libraryMjsPath = resolvePathFromRootSafe(join(ObsidianDevUtilsRepoPaths.DistLib, ObsidianDevUtilsRepoPaths.Esm, ObsidianDevUtilsRepoPaths.LibraryMjs));

  for (const libraryPath of [libraryCjsPath, libraryMjsPath]) {
    let libraryContent = await readFile(libraryPath, 'utf-8');
    libraryContent = libraryContent.replace('$(LIBRARY_VERSION)', newVersion);
    libraryContent = libraryContent.replace('"$(LIBRARY_STYLES)"', stylesCssContentJson);
    await writeFile(libraryPath, libraryContent, 'utf-8');
  }
}
