/**
 * @file
 *
 * This module provides utility functions to handle the build process for static assets and cleaning
 * the build output folder. It includes functions to copy static files to the distribution folder
 * and to remove the existing build output.
 */

import type {
  PackageJson,
  TsConfigJson
} from 'type-fest';

import {
  cp,
  glob,
  rm
} from 'node:fs/promises';

import { toArray } from '../async.ts';
import { getLibDebugger } from '../debug.ts';
import { join } from '../path.ts';
import { trimStart } from '../string.ts';
import {
  checkProjectTypes,
  parseTsConfig,
  toCanonical
} from './check-project-types.ts';
import { readdirPosix } from './fs.ts';
import { readJson } from './json.ts';
import {
  npmRunOptional,
  NpmRunOptionalResult
} from './npm-run.ts';
import { readPackageJson } from './npm.ts';
import { ObsidianDevUtilsRepoPaths } from './obsidian-dev-utils-repo-paths.ts';
import { resolveToolCommand } from './package-manager.ts';
import {
  execFromRoot,
  getRootFolder,
  resolvePathFromRootSafe
} from './root.ts';

/**
 * Removes the distribution folder and its contents.
 *
 * This function deletes the entire distribution folder to ensure a clean build environment.
 *
 * @returns A {@link Promise} that resolves when the folder has been removed.
 */
export async function buildClean(): Promise<void> {
  await rm(ObsidianDevUtilsRepoPaths.Dist, { force: true, recursive: true });
}

/**
 * Compiles the code.
 *
 * @returns A {@link Promise} that resolves when the code compiles successfully.
 */
export async function buildCompile(): Promise<void> {
  if (await npmRunOptional('build:compile:svelte') === NpmRunOptionalResult.Skipped) {
    await buildCompileSvelte();
  }
  if (await npmRunOptional('build:compile:typescript') === NpmRunOptionalResult.Skipped) {
    await buildCompileTypeScript();
  }
}

/**
 * Compiles the Svelte code.
 *
 * The project's Svelte files are found by globbing the Svelte extensions directly. Globbing the tsconfig
 * `include` patterns and filtering that list would never match: `include` lists TypeScript globs
 * (`./src/**\/*.ts`, …), so no `.svelte` path can ever appear in it and the check would always be skipped.
 *
 * @returns A {@link Promise} that resolves when the code compiles successfully.
 * @throws If the project has Svelte files but does not declare `svelte-check`.
 */
export async function buildCompileSvelte(): Promise<void> {
  const tsConfigPath = resolvePathFromRootSafe({ path: ObsidianDevUtilsRepoPaths.TsConfigJson });
  const tsConfig = await readJson<TsConfigJson>(tsConfigPath);
  const svelteFiles = await toArray(glob(SVELTE_FILE_PATTERNS, {
    cwd: resolvePathFromRootSafe({ path: ObsidianDevUtilsRepoPaths.CurrentFolder }),
    exclude: [...SVELTE_FILE_EXCLUDE_PATTERNS, ...tsConfig.exclude ?? []]
  }));

  const [firstSvelteFile] = svelteFiles;

  if (firstSvelteFile === undefined) {
    getLibDebugger('build:buildCompileSvelte')('No Svelte files found in the project, skipping Svelte compilation');
    return;
  }

  const packageJson = await readPackageJson();

  if (!checkSvelteCheckDeclared(packageJson)) {
    throw new Error(
      `Found Svelte file(s) in the project (e.g. ${firstSvelteFile}), but \`${SVELTE_CHECK_PACKAGE_NAME}\` is not declared in package.json.`
        + ` Add \`${SVELTE_CHECK_PACKAGE_NAME}\` as a devDependency to type-check the Svelte code.`
    );
  }

  await execFromRoot([...resolveToolCommand({ tool: SVELTE_CHECK_PACKAGE_NAME }), '--tsconfig', ObsidianDevUtilsRepoPaths.TsConfigJson]);
}

/**
 * Compiles the TypeScript code.
 *
 * The general `tsc` pass runs with `skipLibCheck: true` (configured in `tsconfig.json`) so it does
 * not fail on broken upstream `.d.ts` files we do not control. Afterwards, {@link areProjectTypesValid}
 * re-runs the type-check in-memory with `skipLibCheck: false`, reporting only diagnostics from the
 * files we own, so the declarations we author are still fully validated.
 *
 * @returns A {@link Promise} that resolves when the code compiles successfully.
 * @throws If the project's own declarations fail validation.
 */
export async function buildCompileTypeScript(): Promise<void> {
  await execFromRoot([...resolveToolCommand({ tool: 'tsc' }), '--build', '--force']);

  if (!areProjectTypesValid()) {
    throw new Error('TypeScript declaration validation failed.');
  }
}

/**
 * Copies all template files from the templates folder to the `templates` folder within the
 * distribution folder.
 *
 * This function recursively reads the contents of the templates folder and copies each file to the
 * corresponding path under {@link ObsidianDevUtilsRepoPaths.DistTemplates}, so consumers can copy the
 * templates from `node_modules/obsidian-dev-utils/dist/templates`. A trailing `.template` on a source
 * file name is stripped in the destination (e.g. `eslint.config.mts.template` is copied as
 * `eslint.config.mts`), so an active config template can live in the repo under a name that the
 * corresponding tool does not auto-discover.
 *
 * @returns A {@link Promise} that resolves when all files have been copied.
 */
export async function buildTemplates(): Promise<void> {
  for (const dirent of await readdirPosix(ObsidianDevUtilsRepoPaths.Templates, { recursive: true, withFileTypes: true })) {
    if (!dirent.isFile()) {
      continue;
    }

    const path = trimStart({
      $string: join(dirent.parentPath, dirent.name),
      prefix: `${ObsidianDevUtilsRepoPaths.Templates}/`
    });
    const destinationPath = path.endsWith(TEMPLATE_FILE_SUFFIX) ? path.slice(0, -TEMPLATE_FILE_SUFFIX.length) : path;
    await cp(join(ObsidianDevUtilsRepoPaths.Templates, path), join(ObsidianDevUtilsRepoPaths.DistTemplates, destinationPath));
  }
}

const TEMPLATE_FILE_SUFFIX = '.template';

const NODE_MODULES_SEGMENT = '/node_modules/';

const SVELTE_CHECK_PACKAGE_NAME = 'svelte-check';

const SVELTE_FILE_PATTERNS = [
  `${ObsidianDevUtilsRepoPaths.AnyPath}/*.svelte`,
  `${ObsidianDevUtilsRepoPaths.AnyPath}/*.svelte.js`,
  `${ObsidianDevUtilsRepoPaths.AnyPath}/*.svelte.ts`
];

/**
 * `node_modules` must be listed explicitly: a tsconfig that sets `exclude` at all **replaces** TypeScript's
 * default `node_modules` exclusion, so it cannot be relied on to keep dependencies out of the glob.
 */
const SVELTE_FILE_EXCLUDE_PATTERNS = [
  `${ObsidianDevUtilsRepoPaths.AnyPath}/${ObsidianDevUtilsRepoPaths.NodeModules}/${ObsidianDevUtilsRepoPaths.AnyPath}`,
  `${ObsidianDevUtilsRepoPaths.AnyPath}/${ObsidianDevUtilsRepoPaths.Dist}/${ObsidianDevUtilsRepoPaths.AnyPath}`
];

/**
 * Parameters for {@link shouldKeepProjectFile}.
 */
interface ShouldKeepProjectFileParams {
  /**
   * Absolute path of the file under consideration.
   */
  readonly fileName: string;

  /**
   * Absolute (canonical) path of the project root.
   */
  readonly rootCanonical: string;
}

/**
 * Re-runs the project type-check in-memory with `skipLibCheck: false`, reporting only diagnostics
 * whose source file belongs to the project (under the root folder, outside `node_modules`).
 *
 * @returns `true` when the project's own files have no type errors, `false` otherwise.
 * @throws If the root folder cannot be found.
 */
function areProjectTypesValid(): boolean {
  const root = getRootFolder();

  if (!root) {
    throw new Error('Could not find root folder');
  }

  const rootCanonical = toCanonical(root);
  const { fileNames, options } = parseTsConfig(join(root, ObsidianDevUtilsRepoPaths.TsConfigJson));

  return checkProjectTypes({
    options,
    rootNames: fileNames,
    shouldKeepFile: (fileName) => shouldKeepProjectFile({ fileName, rootCanonical })
  });
}

/**
 * Determines whether the project declares `svelte-check`.
 *
 * The declaration is read from `package.json` rather than probed in `node_modules/.bin`, because
 * {@link resolveToolCommand} deliberately falls back to the package manager's exec form for tools that have
 * no bin shim — the only way a locally installed tool resolves under yarn PnP. Treating a missing shim as a
 * missing tool would therefore break PnP projects.
 *
 * @param packageJson - The project's parsed `package.json`.
 * @returns `true` when `svelte-check` is declared as a regular, dev, or peer dependency.
 */
function checkSvelteCheckDeclared(packageJson: PackageJson): boolean {
  return [packageJson.dependencies, packageJson.devDependencies, packageJson.peerDependencies]
    .some((dependencies) => dependencies?.[SVELTE_CHECK_PACKAGE_NAME] !== undefined);
}

/**
 * Determines whether a file belongs to the project (under the root folder, outside `node_modules`).
 *
 * @param params - The parameters for the check.
 * @returns `true` when the file belongs to the project.
 */
function shouldKeepProjectFile(params: ShouldKeepProjectFileParams): boolean {
  const { fileName, rootCanonical } = params;
  return fileName.startsWith(`${rootCanonical}/`) && !fileName.includes(NODE_MODULES_SEGMENT);
}
