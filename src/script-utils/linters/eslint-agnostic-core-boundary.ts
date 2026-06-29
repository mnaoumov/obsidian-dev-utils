/**
 * @file
 *
 * `no-restricted-imports` pattern entries that enforce the agnostic-core boundary: the
 * Obsidian-runtime-agnostic top-level `src/*.ts` modules must not import the Obsidian layer
 * (`src/obsidian/**`).
 *
 * Exported as a standalone constant so the pattern can be unit-tested independently of the larger
 * declarative config, and so the owning project can apply it scoped to its top-level source files.
 */

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
 * `no-restricted-imports` pattern entries banning relative imports into the `obsidian` layer.
 *
 * Intended to be applied (via a file-scoped ESLint config) to the agnostic top-level `src/*.ts`
 * modules, excluding the generated barrel and test files.
 */
export const agnosticCoreBoundaryNoRestrictedImportPatterns: readonly NoRestrictedImportPatternEntry[] = [
  {
    group: [
      './obsidian',
      './obsidian/*',
      './obsidian/**'
    ],
    message: 'Obsidian-runtime-agnostic top-level `src/*.ts` modules must not import the Obsidian layer (`src/obsidian/**`). Move Obsidian-coupled code into `src/obsidian/`, or inject what you need explicitly.'
  }
];
