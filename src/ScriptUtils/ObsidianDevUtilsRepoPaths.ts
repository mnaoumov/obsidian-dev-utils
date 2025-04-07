/**
 * @packageDocumentation
 *
 * This module defines an enumeration of common file paths and patterns used in the Obsidian development utilities repository.
 * These paths are used throughout the build process and other utilities, ensuring consistency and reducing the likelihood
 * of errors due to hardcoded strings.
 */

/**
 * Enumeration of common file paths and patterns used in the Obsidian development utilities repository.
 */
export enum ObsidianDevUtilsRepoPaths {
  /** Any file or directory. */
  Any = '*',

  /** CommonJS file. */
  AnyCjs = '*.cjs',

  /** CommonJS TypeScript declaration file. */
  AnyDcts = '*.d.cts',

  /** ESM TypeScript declaration file. */
  AnyDmts = '*.d.mts',

  /** TypeScript declaration file. */
  AnyDts = '*.d.ts',

  /** ESM JavaScript file. */
  AnyMjs = '*.mjs',

  /** Any path recursively. */
  AnyPath = '**',

  /** Any TypeScript file. */
  AnyTs = '*.ts',

  /** CommonJS directory. */
  Cjs = 'cjs',

  /** CommonJS file extension. */
  CjsExtension = '.cjs',

  /** Current directory. */
  CurrentDir = '.',

  /** Dataview types. */
  DataviewTypes = 'src/obsidian/@types/Dataview/**',

  /** CommonJS TypeScript declaration file extension. */
  DctsExtension = '.d.cts',

  /** Distribution directory. */
  Dist = 'dist',

  /** The path to the `lib` directory within the {@link Dist} directory. */
  DistLib = 'dist/lib',

  /** Transpiled TypeScript declaration file extension. */
  DjsExtension = '.d.js',

  /** ESM TypeScript declaration file extension. */
  DmtsExtension = '.d.mts',

  /** Dprint configuration file. */
  DprintJson = 'dprint.json',

  /** TypeScript declaration file extension. */
  DtsExtension = '.d.ts',

  /** ESM JavaScript directory. */
  Esm = 'esm',

  /** CommonJS JavaScript index file. */
  IndexCjs = 'index.cjs',

  /** CommonJS TypeScript declaration file index file. */
  IndexDcts = 'index.d.cts',

  /** ESM TypeScript declaration file index file. */
  IndexDmts = 'index.d.mts',

  /** ESM JavaScript index file. */
  IndexMjs = 'index.mjs',

  /** TypeScript index file. */
  IndexTs = 'index.ts',

  /** JavaScript file extension. */
  JsExtension = '.js',

  /** Library CommonJS file. */
  LibraryCjs = 'Library.cjs',

  /** Library ESM JavaScript file. */
  LibraryMjs = 'Library.mjs',

  /** ESM JavaScript file extension. */
  MjsExtension = '.mjs',

  /** Node modules directory. */
  NodeModules = 'node_modules',

  /** Package JSON file. */
  PackageJson = 'package.json',

  /** Root directory. */
  RootDir = '/',

  /** Scripts directory. */
  Scripts = 'scripts',

  /** Source directory. */
  Src = 'src',

  /** Static directory. */
  Static = 'static',

  /** Styles directory. */
  Styles = 'styles',

  /** Styles CSS file. */
  StylesCss = 'styles.css',

  /** TypeScript configuration file. */
  TsConfigJson = 'tsconfig.json',

  /** TypeScript file extension. */
  TsExtension = '.ts',

  /** Types directory. */
  Types = '@types'
}
