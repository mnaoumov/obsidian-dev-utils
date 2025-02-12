/**
 * @packageDocumentation ObsidianDevUtilsRepoPaths
 * This module defines an enumeration of common file paths and patterns used in the Obsidian development utilities repository.
 * These paths are used throughout the build process and other utilities, ensuring consistency and reducing the likelihood
 * of errors due to hardcoded strings.
 */

export enum ObsidianDevUtilsRepoPaths {
  /** Matches any file or directory (`*`). */
  Any = '*',

  /** Matches any `.cjs` file (`*.cjs`). */
  AnyCjs = '*.cjs',

  /** Matches any TypeScript declaration file (`*.d.ts`). */
  AnyDts = '*.d.ts',

  /** Matches any `.js` file (`*.js`). */
  AnyJs = '*.js',

  /** Matches any `.mjs` file (`*.mjs`). */
  AnyMjs = '*.mjs',

  /** Matches any path recursively (`**`). */
  AnyPath = '**',

  /** Matches any TypeScript file (`*.ts`). */
  AnyTs = '*.ts',

  /** The path to the `CHANGELOG.md` file. */
  ChangelogMd = 'CHANGELOG.md',

  /** The `.cjs` file extension. */
  CjsExtension = '.cjs',

  /** The path to the `src/obsidian/@types/Dataview` files. */
  DataviewTypes = 'src/obsidian/@types/Dataview/**',

  /** The `.d.cts` file extension. */
  DctsExtension = '.d.cts',

  /** The path to the distribution (`dist`) directory. */
  Dist = 'dist',

  /** The path to the `lib` directory within the `dist` directory. */
  DistLib = 'dist/lib',

  /** The path to the `_dependencies.cjs` file within the `lib` directory in the `dist` directory. */
  DistLibDependenciesCjs = './dist/lib/_dependencies.cjs',

  /** The `.d.js` file extension. */
  DjsExtension = '.d.js',

  /** The `.d.mts` file extension. */
  DmtsExtension = '.d.mts',

  /** The path to the `dprint.json` file. */
  DprintJson = 'dprint.json',

  /** The `.d.ts` file extension. */
  DtsExtension = '.d.ts',

  /** The path to the `index.cjs` file. */
  IndexCjs = 'index.cjs',

  /** The path to the `index.d.cts` file. */
  IndexDcts = 'index.d.cts',

  /** The path to the `index.d.ts` file. */
  IndexDts = 'index.d.ts',

  /** The path to the `index.mjs` file. */
  IndexMjs = 'index.mjs',

  /** The path to the `index.ts` file. */
  IndexTs = 'index.ts',

  /** The `.js` file extension. */
  JsExtension = '.js',

  /** The path to the `LICENSE` file. */
  License = 'LICENSE',

  /** The `.mjs` file extension. */
  MjsExtension = '.mjs',

  /**
   * The path to the `node_modules` directory.
   */
  NodeModules = 'node_modules',

  /** The path to the `package.json` file. */
  PackageJson = 'package.json',

  /** The path to the `README.md` file. */
  ReadmeMd = 'README.md',

  /** The path to the `scripts` directory. */
  Scripts = 'scripts',

  /** The path to the `src` directory. */
  Src = 'src',

  /** The path to the `_dependencies.ts` file within the `src` directory. */
  SrcDependenciesTs = './src/_dependencies.ts',

  /** The path to the `src` directory. */
  SrcObsidianTypesDataview = 'src/obsidian/@types/Dataview',

  /** The path to the `static` directory. */
  Static = 'static',

  /** The path to the `styles` directory. */
  Styles = 'styles',

  /** The path to the `styles.css` file. */
  StylesCss = 'styles.css',

  /** The path to the `tsconfig.json` file. */
  TsConfigJson = 'tsconfig.json',

  /** The `.ts` file extension. */
  TsExtension = '.ts',

  /** The path to the `@types` directory, typically used for TypeScript type declarations. */
  Types = '@types'
}
