/**
 * @file
 *
 * Stamps the release-time values into the built `generated-during-build.{cjs,mjs}`.
 *
 * `src/generated-during-build.ts` declares `$(...)` placeholders that carry no value of their own, so
 * something has to rewrite them in the compiled output with the real library version and bundled styles.
 * This runs as a build step rather than as part of the release, because the published tarball is built by
 * `.github/workflows/publish-npm.yml` on a fresh checkout — a release-time rewrite reaches the maintainer's
 * `dist/` and nothing else, which is how `94.7.0` through `96.0.0` came to ship the placeholders literally.
 */

import {
  readFile,
  writeFile
} from 'node:fs/promises';

import { join } from '../src/path.ts';
import { readPackageJson } from '../src/script-utils/npm.ts';
import { ObsidianDevUtilsRepoPaths } from '../src/script-utils/obsidian-dev-utils-repo-paths.ts';
import { resolvePathFromRootSafe } from '../src/script-utils/root.ts';

/**
 * Rewrites the placeholders in the built `generated-during-build.{cjs,mjs}` with the version from
 * `package.json` and the contents of the built stylesheet.
 *
 * Runs after `build:styles` (which produces the stylesheet it reads) and before the steps that bundle the
 * library, so the bundles inherit the stamped values instead of the placeholders.
 *
 * @returns A {@link Promise} that resolves when both files have been stamped.
 */
export async function stampGeneratedDuringBuild(): Promise<void> {
  const packageJson = await readPackageJson();
  const version = packageJson.version;
  if (!version) {
    throw new Error('`package.json` declares no version to stamp into the built library.');
  }

  const stylesCssPath = resolvePathFromRootSafe({ path: join(ObsidianDevUtilsRepoPaths.Dist, ObsidianDevUtilsRepoPaths.StylesCss) });
  const styles = await readFile(stylesCssPath, 'utf-8');

  const generatedPaths = [
    resolvePathFromRootSafe({ path: join(ObsidianDevUtilsRepoPaths.DistLib, ObsidianDevUtilsRepoPaths.Cjs, ObsidianDevUtilsRepoPaths.GeneratedDuringBuildCjs) }),
    resolvePathFromRootSafe({ path: join(ObsidianDevUtilsRepoPaths.DistLib, ObsidianDevUtilsRepoPaths.Esm, ObsidianDevUtilsRepoPaths.GeneratedDuringBuildMjs) })
  ];

  for (const generatedPath of generatedPaths) {
    let content = await readFile(generatedPath, 'utf-8');
    content = stampConstant(content, generatedPath, 'LIBRARY_VERSION', version);
    content = stampConstant(content, generatedPath, 'LIBRARY_STYLES', styles);
    await writeFile(generatedPath, content, 'utf-8');
  }
}

/**
 * Replaces the value of a top-level `const` string declaration in compiled output.
 *
 * @param content - The compiled file's contents.
 * @param path - The file the contents came from, named in the error if the declaration is missing.
 * @param name - The name of the declaration to stamp.
 * @param value - The value to stamp into it.
 * @returns The contents with the declaration rewritten.
 */
function stampConstant(content: string, path: string, name: string, value: string): string {
  // The whole statement is matched, not just the placeholder, which makes this idempotent.
  // Re-stamping an already-stamped file replaces the previous value instead of matching nothing.
  // That matters because `scripts/version.ts` re-stamps a `dist/` the build has already stamped.
  const pattern = new RegExp(String.raw`^const ${name} = (?:"(?:[^"\\]|\\[\s\S])*"|'(?:[^'\\]|\\[\s\S])*');$`, 'm');
  if (!pattern.test(content)) {
    throw new Error(`Could not find the \`${name}\` declaration to stamp in '${path}'. The published library would carry the placeholder instead of a value.`);
  }

  // The replacement goes through a function so the inserted text is taken literally.
  // As a plain string, a `$&` or `$'` in the stylesheet would be expanded by `String#replace`.
  // Ordinary CSS does contain `$'`, for example in a `[href$='...']` selector.
  return content.replace(pattern, () => `const ${name} = ${JSON.stringify(value)};`);
}
