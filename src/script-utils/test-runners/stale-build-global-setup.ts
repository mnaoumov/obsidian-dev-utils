/**
 * @file
 *
 * Vitest global setup that refuses to start an integration project whose plugin build is stale.
 *
 * The integration harness enables the plugin from its BUILD, `dist/build/main.js`, and a plugin's
 * `test:integration*` scripts call vitest directly, so nothing on that path builds first. A session that
 * edits `src/` and then runs one integration project tests the last build, however old it is, and the
 * suite reports the old code as a behavior difference, not as a stale artifact. One such run cost a CDP
 * probe into Obsidian's own link resolution, a wrong cache-race theory, and a harness change that was
 * made and then reverted before anyone noticed that the build was three days old. `npm run gate` avoided
 * the problem only because it happens to build before it runs `test:integration`.
 *
 * The setup refuses to start rather than building. A build inside a global setup would run once per
 * project in a multi-project aggregate, and it would slow down a deliberate re-run of an unchanged build.
 * A refusal is cheap, and it says what to run.
 *
 * Test files are not build inputs. Editing an integration case and re-running it is exactly the loop that
 * must not force a rebuild, so `*.test.ts` files and `src/test-helpers/` are ignored. A dependency bump
 * is not detected either: only files in the repo are compared, not `node_modules`.
 */

import type { TestProject } from 'vitest/node';

import {
  existsSync,
  readdirSync,
  statSync
} from 'node:fs';
import {
  join,
  relative,
  sep
} from 'node:path';

import { ObsidianPluginRepoPaths } from '../../obsidian/plugin/obsidian-plugin-repo-paths.ts';
import { toPosixPath } from '../../path.ts';

/**
 * Parameters for {@link findStaleBuild}.
 */
export interface FindStaleBuildParams {
  /**
   * The root folder of the plugin repo.
   */
  readonly rootFolder: string;
}

/**
 * The build does not exist at all.
 */
export interface MissingBuild {
  /**
   * The discriminant.
   */
  readonly kind: 'missing';
}

/**
 * The build exists but is older than one of its inputs.
 */
export interface OutdatedBuild {
  /**
   * The modification time of `dist/build/main.js`.
   */
  readonly buildModifiedAt: Date;

  /**
   * The discriminant.
   */
  readonly kind: 'outdated';

  /**
   * The modification time of {@link OutdatedBuild.newestInputPath}.
   */
  readonly newestInputModifiedAt: Date;

  /**
   * The newest build input, relative to the root folder.
   */
  readonly newestInputPath: string;
}

/**
 * Why the build cannot be tested, as returned by {@link findStaleBuild}.
 */
export type StaleBuild = MissingBuild | OutdatedBuild;

const BUILD_PATH = `${ObsidianPluginRepoPaths.DistBuild}/${ObsidianPluginRepoPaths.MainJs}`;
const ROOT_BUILD_INPUTS = [ObsidianPluginRepoPaths.ManifestJson, ObsidianPluginRepoPaths.StylesCss];
const TEST_FILE_SUFFIX = ObsidianPluginRepoPaths.AnyTestTs.slice(1);

/**
 * Checks whether `dist/build/main.js` is missing, or older than one of the files it is built from.
 *
 * @param params - The parameters.
 * @returns `null` when the build is current; otherwise a description of the problem.
 */
export function findStaleBuild(params: FindStaleBuildParams): null | StaleBuild {
  const buildPath = join(params.rootFolder, BUILD_PATH);
  if (!existsSync(buildPath)) {
    return { kind: 'missing' };
  }

  const buildModifiedAt = statSync(buildPath).mtime;
  let newestInputPath: null | string = null;
  let newestInputModifiedAt = buildModifiedAt;

  for (const inputPath of getBuildInputPaths(params.rootFolder)) {
    const modifiedAt = statSync(inputPath).mtime;
    if (modifiedAt <= newestInputModifiedAt) {
      continue;
    }

    newestInputPath = inputPath;
    newestInputModifiedAt = modifiedAt;
  }

  if (newestInputPath === null) {
    return null;
  }

  return {
    buildModifiedAt,
    kind: 'outdated',
    newestInputModifiedAt,
    newestInputPath: toPosixPath(relative(params.rootFolder, newestInputPath))
  };
}

/**
 * Formats a {@link StaleBuild} as the message the setup throws.
 *
 * @param staleBuild - The stale build.
 * @returns The message.
 */
export function formatStaleBuildMessage(staleBuild: StaleBuild): string {
  return staleBuild.kind === 'missing'
    ? `${BUILD_PATH} does not exist, so there is no plugin for the integration tests to load. Run \`npm run build\` first.`
    : `${BUILD_PATH} is older than ${staleBuild.newestInputPath} (built ${staleBuild.buildModifiedAt.toISOString()}, `
      + `changed ${staleBuild.newestInputModifiedAt.toISOString()}), so the integration tests would run the previous build `
      + 'instead of the current source. Run `npm run build` first.';
}

/**
 * Vitest global setup: throws when the plugin build is missing or stale.
 *
 * @param project - The Vitest test project.
 */
export function setup(project: TestProject): void {
  const staleBuild = findStaleBuild({ rootFolder: project.config.root });
  if (staleBuild !== null) {
    throw new Error(formatStaleBuildMessage(staleBuild));
  }
}

function getBuildInputPaths(rootFolder: string): string[] {
  const paths = ROOT_BUILD_INPUTS.map((rootInput) => join(rootFolder, rootInput)).filter((path) => existsSync(path));

  const srcFolder = join(rootFolder, ObsidianPluginRepoPaths.Src);
  if (!existsSync(srcFolder)) {
    return paths;
  }

  const testHelpersFolderPrefix = join(rootFolder, ObsidianPluginRepoPaths.Mocks) + sep;
  for (const entry of readdirSync(srcFolder, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || entry.name.endsWith(TEST_FILE_SUFFIX)) {
      continue;
    }

    const path = join(entry.parentPath, entry.name);
    if (!path.startsWith(testHelpersFolderPrefix)) {
      paths.push(path);
    }
  }

  return paths;
}
