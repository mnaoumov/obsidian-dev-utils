/**
 * @file
 *
 * Public API for the esbuild bundler. Re-exports the main build functions.
 */

/* v8 ignore start -- Re-export module; coverage is tracked in the implementation files. */

export {
  banner,
  build,
  BuildMode,
  buildObsidianPlugin,
  dev,
  invokeEsbuild
} from './esbuild-impl/obsidian-plugin-builder.ts';

/**
 * Re-exported types for the esbuild bundler.
 */
export type {
  BuildObsidianPluginParams,
  BuildParams
} from './esbuild-impl/obsidian-plugin-builder.ts';

/* v8 ignore stop */
