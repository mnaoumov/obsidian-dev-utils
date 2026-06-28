/**
 * @file
 *
 * Type-checks the generated declaration files (`.d.cts` / `.d.mts`) to prove they are self-contained
 * — every `lib` and internal cross-reference they rely on resolves on its own, independent of the
 * consumer's `tsconfig`.
 *
 * The library does not own the types of the third-party packages its declarations import (e.g.
 * `type-fest`, `obsidian`, `markdownlint`). Cross-module-format interop diagnostics caused by those
 * imports — for example a CommonJS `.d.cts` importing an ESM-only package without a
 * `resolution-mode` attribute (`TS1541` / `TS1542` / `TS1479`) — describe the third-party package's
 * shape, not a flaw in our declarations, and are the consumer's concern. They are therefore ignored.
 * Only diagnostics about the library's own declarations are reported.
 */

import type {
  Diagnostic,
  Node,
  SourceFile
} from 'typescript';

import {
  forEachChild,
  isExportDeclaration,
  isImportDeclaration,
  isImportTypeNode,
  isLiteralTypeNode,
  isStringLiteral
} from 'typescript';

import { join } from '../path.ts';
import {
  checkProjectTypes,
  parseTsConfig,
  toCanonical
} from './check-project-types.ts';
import { ObsidianDevUtilsRepoPaths } from './obsidian-dev-utils-repo-paths.ts';
import { getRootFolder } from './root.ts';

const NODE_MODULES_SEGMENT = '/node_modules/';
const RELATIVE_SPECIFIER_PREFIX = '.';

const VALIDATE_DECLARATIONS_TS_CONFIG_FILE_NAMES = [
  ObsidianDevUtilsRepoPaths.TsConfigValidateDeclarationsJson,
  ObsidianDevUtilsRepoPaths.TsConfigValidateDeclarationsCjsJson
];

/**
 * Options for {@link validateDeclarations}.
 */
export interface ValidateDeclarationsOptions {
  /**
   * When `true`, the ignored third-party diagnostics are printed in full in addition to their count,
   * so they can be inspected. When omitted or `false`, only the count is printed.
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
 * configs, reporting only diagnostics that concern the library's own declarations and ignoring those
 * caused by importing third-party packages.
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
      shouldKeepDiagnostic: (diagnostic) => !isThirdPartyModuleImportDiagnostic(diagnostic),
      shouldKeepFile: (fileName) => shouldKeepProjectFile({ fileName, rootCanonical })
    });
    isValid &&= isConfigValid;
  }

  return isValid;
}

function findEnclosingModuleSpecifier(sourceFile: SourceFile, position: number): null | string {
  let specifier: null | string = null;
  visit(sourceFile);
  return specifier;

  function visit(node: Node): void {
    if (position < node.getStart(sourceFile) || position >= node.getEnd()) {
      return;
    }

    const nodeSpecifier = getModuleSpecifier(node);
    if (nodeSpecifier !== null) {
      specifier = nodeSpecifier;
    }

    forEachChild(node, visit);
  }
}

function getModuleSpecifier(node: Node): null | string {
  if (isImportDeclaration(node) || isExportDeclaration(node)) {
    return getStringLiteralText(node.moduleSpecifier);
  }

  if (isImportTypeNode(node)) {
    return isLiteralTypeNode(node.argument) ? getStringLiteralText(node.argument.literal) : null;
  }

  return null;
}

function getStringLiteralText(node: Node | undefined): null | string {
  return node && isStringLiteral(node) ? node.text : null;
}

function isThirdPartyModuleImportDiagnostic(diagnostic: Diagnostic): boolean {
  const file = diagnostic.file;
  if (!file || diagnostic.start === undefined) {
    return false;
  }

  const specifier = findEnclosingModuleSpecifier(file, diagnostic.start);
  return specifier !== null && !specifier.startsWith(RELATIVE_SPECIFIER_PREFIX);
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
