/**
 * @file
 *
 * `no-restricted-imports` path entry that forces the classic TypeScript compiler API to be imported
 * from the `typescript-6` alias rather than the bare `typescript` specifier.
 *
 * This library's tooling uses the classic compiler API (`sys`, `createProgram`, `SyntaxKind`, ...),
 * which the native `tsgo` port published as `typescript@7` does not expose on its main entry. A
 * consumer that forces `typescript` to v7 (e.g. via an `overrides` entry cascading into this
 * library's nested copy) would otherwise crash this code at runtime with errors such as reading
 * `useCaseSensitiveFileNames` on an `undefined` `sys`. Importing from the distinctly named
 * `typescript-6` alias — which a `typescript` override cannot match — keeps the classic API available
 * regardless of the consumer's `typescript` version.
 *
 * Exported as a standalone constant so the pattern can be unit-tested independently of the larger
 * declarative config, and so the owning project can apply it scoped to its own files.
 */

/**
 * A single `no-restricted-imports` path entry pairing a banned import specifier with a human-readable
 * message explaining why it is banned.
 */
export interface NoRestrictedImportPathEntry {
  /**
   * Human-readable message shown when an import matches {@link NoRestrictedImportPathEntry.name}.
   */
  message: string;

  /**
   * The exact import specifier to ban.
   */
  name: string;
}

/**
 * `no-restricted-imports` path entries banning the bare `typescript` specifier in favor of the
 * `typescript-6` alias.
 *
 * Intended to be applied (via a file-scoped ESLint config) to this library's own source so the
 * classic compiler API keeps resolving to a real TypeScript 6, even when a consumer forces the bare
 * `typescript` dependency to the `tsgo` port (`typescript@7`).
 */
export const typeScriptClassicApiNoRestrictedImportPaths: readonly NoRestrictedImportPathEntry[] = [
  {
    message: 'Import the classic TypeScript compiler API from the `typescript-6` alias, not the bare `typescript` specifier. `typescript@7` (the `tsgo` port) omits the classic API (`sys`, `createProgram`, ...) on its main entry, so a consumer that forces `typescript` to v7 would crash this code. The `typescript-6` alias cannot be matched by a `typescript` override, so it stays on the classic API.',
    name: 'typescript'
  }
];
