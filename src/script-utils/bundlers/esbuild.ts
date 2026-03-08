/**
 * @packageDocumentation
 *
 * Public API for the esbuild bundler. Re-exports the main build functions.
 */

export {
  banner,
  build,
  BuildMode,
  buildObsidianPlugin,
  dev,
  invokeEsbuild
} from './esbuild-impl/obsidian-plugin-builder.ts';

export type { BuildObsidianPluginParams } from './esbuild-impl/obsidian-plugin-builder.ts';
