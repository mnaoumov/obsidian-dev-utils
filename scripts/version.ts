import {
  readFile,
  writeFile
} from 'node:fs/promises';
import process from 'node:process';

import { join } from '../src/path.ts';
import { wrapCliTask } from '../src/script-utils/cli-utils.ts';
import { ObsidianDevUtilsRepoPaths } from '../src/script-utils/obsidian-dev-utils-repo-paths.ts';
import {
  execFromRoot,
  resolvePathFromRootSafe
} from '../src/script-utils/root.ts';
import {
  parseVersionArguments,
  updateVersion
} from '../src/script-utils/version.ts';

const [, , ...$arguments] = process.argv;

await wrapCliTask(async () => {
  await execFromRoot(['npm', 'run', 'build:templates']);
  const { options, versionUpdateType } = parseVersionArguments($arguments);
  // The NPM publish is deliberately NOT run from here.
  // It happens in `.github/workflows/publish-npm.yml`, triggered by the GitHub release this creates.
  // That way it authenticates as a trusted publisher (OIDC), with no long-lived NPM token on this machine.
  await updateVersion(versionUpdateType, {
    ...options,
    prepareGitHubRelease
  });
});

async function prepareGitHubRelease(newVersion: string): Promise<void> {
  const stylesCssPath = resolvePathFromRootSafe({ path: join(ObsidianDevUtilsRepoPaths.Dist, ObsidianDevUtilsRepoPaths.StylesCss) });
  const stylesCssContent = await readFile(stylesCssPath, 'utf-8');
  const stylesCssContentJson = JSON.stringify(stylesCssContent);

  const generatedCjsPath = resolvePathFromRootSafe({ path: join(ObsidianDevUtilsRepoPaths.DistLib, ObsidianDevUtilsRepoPaths.Cjs, ObsidianDevUtilsRepoPaths.GeneratedDuringBuildCjs) });
  const generatedMjsPath = resolvePathFromRootSafe({ path: join(ObsidianDevUtilsRepoPaths.DistLib, ObsidianDevUtilsRepoPaths.Esm, ObsidianDevUtilsRepoPaths.GeneratedDuringBuildMjs) });

  for (const generatedPath of [generatedCjsPath, generatedMjsPath]) {
    let generatedContent = await readFile(generatedPath, 'utf-8');
    // The replacements go through a function so the inserted text is taken literally. As a plain string,
    // A `$&` or `$'` anywhere in the stylesheet would be expanded by `String#replace` -- and `$'` occurs in
    // Ordinary CSS, for example in a `[href$='...']` selector.
    generatedContent = generatedContent.replace('$(LIBRARY_VERSION)', () => newVersion);
    generatedContent = generatedContent.replace('"$(LIBRARY_STYLES)"', () => stylesCssContentJson);
    await writeFile(generatedPath, generatedContent, 'utf-8');
  }
}
