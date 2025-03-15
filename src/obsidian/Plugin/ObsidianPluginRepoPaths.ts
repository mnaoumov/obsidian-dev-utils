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

  /** Represents the current directory. */
  CurrentDir = '.',

  /** Represents the distribution directory. */
  Dist = 'dist',

  /** Represents the build directory within the distribution directory. */
  DistBuild = 'dist/build',

  /** Represents the development directory within the distribution directory. */
  DistDev = 'dist/dev',

  /** Represents the ESLint configuration file. */
  EslintConfigCjs = 'eslint.config.cjs',

  /** Represents the ESLint configuration file. */
  EslintConfigCts = 'eslint.config.cts',

  /** Represents the ESLint configuration file. */
  EslintConfigJs = 'eslint.config.js',

  /** Represents the ESLint configuration file. */
  EslintConfigMjs = 'eslint.config.mjs',

  /** Represents the ESLint configuration file. */
  EslintConfigMts = 'eslint.config.mts',

  /** Represents the ESLint configuration file. */
  EslintConfigTs = 'eslint.config.ts',

  /** Represents the hot reload file. */
  HotReload = '.hotreload',

  /** Represents the lib directory. */
  Lib = 'lib',

  /** Represents the main CSS file. */
  MainCss = 'main.css',

  /** Represents the main JavaScript file. */
  MainJs = 'main.js',

  /** Represents the main TypeScript file. */
  MainTs = 'main.ts',

  /** Represents the manifest file for beta releases. */
  ManifestBetaJson = 'manifest-beta.json',

  /** Represents the manifest file. */
  ManifestJson = 'manifest.json',

  /** Represents the npm-shrinkwrap.json file. */
  NpmShrinkwrapJson = 'npm-shrinkwrap.json',

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
