/**
 * @file
 *
 * `no-restricted-imports` pattern entries that enforce the dependency arrows between the packages of a workspace:
 * which packages a package's code may import, by naming the ones it may not.
 *
 * Exported as standalone builders so the patterns can be unit-tested independently of the larger declarative
 * config, and so the owning project can apply them scoped to each package's source files.
 *
 * Workspace `package.json` dependencies enforce the same boundary in the end, because an import of an undeclared
 * package fails to resolve once the package is installed on its own. Inside the workspace every package is
 * resolvable from every other, so without this rule a wrong arrow would surface only after publishing.
 */

/**
 * Parameters for {@link getPackageBoundaryNoRestrictedImportPatterns}.
 */
export interface GetPackageBoundaryNoRestrictedImportPatternsParams {
  /**
   * The packages the package's code must not import, by package name.
   */
  readonly forbiddenPackageNames: readonly string[];

  /**
   * The name of the package the patterns apply to, named in the message.
   */
  readonly packageName: string;
}

/**
 * A single `no-restricted-imports` pattern entry pairing a group of banned import specifiers with a
 * human-readable message explaining why they are banned.
 */
export interface NoRestrictedImportPatternEntry {
  /**
   * The glob group of import specifiers to ban.
   */
  group: string[];

  /**
   * Human-readable message shown when an import matches the group.
   */
  message: string;
}

/**
 * Builds the `no-restricted-imports` pattern entries banning a package's code from importing the given packages,
 * through their root or any subpath.
 *
 * @param params - The {@link GetPackageBoundaryNoRestrictedImportPatternsParams}.
 * @returns One pattern entry per forbidden package; none when nothing is forbidden.
 */
export function getPackageBoundaryNoRestrictedImportPatterns(params: GetPackageBoundaryNoRestrictedImportPatternsParams): NoRestrictedImportPatternEntry[] {
  return params.forbiddenPackageNames.map((forbiddenPackageName) => ({
    group: [forbiddenPackageName, `${forbiddenPackageName}/*`, `${forbiddenPackageName}/**`],
    message: `\`${params.packageName}\` must not import \`${forbiddenPackageName}\`: the dependency arrows between the workspace packages point the other way.`
  }));
}
