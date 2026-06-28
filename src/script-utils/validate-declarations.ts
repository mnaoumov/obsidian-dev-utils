/**
 * @file
 *
 * Type-checks the generated declaration files (`.d.cts` / `.d.mts`) to prove they are self-contained
 * — every `lib` and internal cross-reference they rely on resolves on its own, independent of the
 * consumer's `tsconfig`.
 *
 * Only diagnostics whose source file is one we own (under the project root, outside `node_modules`)
 * are reported. Diagnostics inside `node_modules` — broken upstream `.d.ts` files we do not control —
 * are ignored. Cross-module-format interop diagnostics in our own declarations (for example a
 * CommonJS `.d.cts` importing an ESM-only package, `TS1541` / `TS1542` / `TS1479`) are NOT ignored:
 * they describe declarations we emit, so the generator must produce valid output (e.g. add the
 * required `resolution-mode` attribute) rather than the validator hiding the problem.
 */

import { join } from '../path.ts';
import {
  checkProjectTypes,
  parseTsConfig,
  toCanonical
} from './check-project-types.ts';
import { ObsidianDevUtilsRepoPaths } from './obsidian-dev-utils-repo-paths.ts';
import { getRootFolder } from './root.ts';

const NODE_MODULES_SEGMENT = '/node_modules/';

const VALIDATE_DECLARATIONS_TS_CONFIG_FILE_NAMES = [
  ObsidianDevUtilsRepoPaths.TsConfigValidateDeclarationsJson,
  ObsidianDevUtilsRepoPaths.TsConfigValidateDeclarationsCjsJson
];

/**
 * Options for {@link validateDeclarations}.
 */
export interface ValidateDeclarationsOptions {
  /**
   * When `true`, the ignored `node_modules` diagnostics are printed in full in addition to their
   * count, so they can be inspected. When omitted or `false`, only the count is printed.
   *
   * @default `false`
   */
  readonly isVerbose?: boolean;
}

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
 * Validates the generated declaration files against the `tsconfig.validate-declarations*.json`
 * configs, reporting every diagnostic that concerns the library's own declarations and ignoring only
 * those whose source file lives in `node_modules`.
 *
 * @param options - The options controlling validation output.
 * @returns `true` when the library's own declarations have no type errors, `false` otherwise.
 * @throws If the root folder cannot be found.
 */
export function validateDeclarations(options: ValidateDeclarationsOptions = {}): boolean {
  const root = getRootFolder();

  if (!root) {
    throw new Error('Could not find root folder');
  }

  const rootCanonical = toCanonical(root);

  let isValid = true;

  for (const tsConfigFileName of VALIDATE_DECLARATIONS_TS_CONFIG_FILE_NAMES) {
    const { fileNames, options: compilerOptions } = parseTsConfig(join(root, tsConfigFileName));
    const isConfigValid = checkProjectTypes({
      isVerbose: options.isVerbose ?? false,
      options: compilerOptions,
      rootNames: fileNames,
      shouldKeepFile: (fileName) => shouldKeepProjectFile({ fileName, rootCanonical })
    });
    isValid &&= isConfigValid;
  }

  return isValid;
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
