/**
 * @file
 *
 * Values substituted into the built library during release.
 *
 * The `$(...)` placeholders below are inert source text; the release step (`scripts/version.ts`)
 * rewrites them in the compiled `generated-during-build.{cjs,mjs}` output with the real library
 * version and bundled styles. They carry no Obsidian import or API, so this module stays
 * Obsidian-runtime-agnostic.
 */

/**
 * A version of the `obsidian-dev-utils` library.
 */
export const LIBRARY_VERSION = '$(LIBRARY_VERSION)';

/**
 * A styles of the `obsidian-dev-utils` library.
 */
export const LIBRARY_STYLES = '$(LIBRARY_STYLES)';
