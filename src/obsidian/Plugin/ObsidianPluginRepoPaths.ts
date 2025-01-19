/**
 * @packageDocumentation ObsidianPluginRepoPaths
 * This file defines an enumeration for common file and directory paths used in Obsidian plugin development.
 */

/**
 * Enumeration of commonly used file and directory paths in Obsidian plugin development.
 */
export enum ObsidianPluginRepoPaths {
  /** Represents any path recursively. */
  AnyPath = '**',

  /** Represents any TypeScript file. */
  AnyTs = '*.ts',

  /** Represents the changelog file. */
  ChangelogMd = 'CHANGELOG.md',

  /** Represents the distribution directory. */
  Dist = 'dist',

  /** Represents the build directory within the distribution directory. */
  DistBuild = 'dist/build',

  /** Represents the development directory within the distribution directory. */
  DistDev = 'dist/dev',

  /** Represents the hot reload file. */
  HotReload = '.hotreload',

  /** Represents the lib directory. */
  Lib = 'lib',

  /** Represents the Library.cjs file. */
  LibraryCjs = 'Library.cjs',

  /** Represents the main JavaScript file. */
  MainJs = 'main.js',

  /** Represents the main TypeScript file. */
  MainTs = 'main.ts',

  /** Represents the manifest file. */
  ManifestJson = 'manifest.json',

  /** Represents the package.json file. */
  PackageJson = 'package.json',

  /** Represents the package-lock.json file. */
  PackageLockJson = 'package-lock.json',

  /** Represents the source directory. */
  Src = 'src',

  /** Represents the styles.css file. */
  StylesCss = 'styles.css',

  /** Represents the TypeScript configuration file. */
  TsConfigJson = 'tsconfig.json',

  /** Represents the versions.json file. */
  VersionsJson = 'versions.json'
}
