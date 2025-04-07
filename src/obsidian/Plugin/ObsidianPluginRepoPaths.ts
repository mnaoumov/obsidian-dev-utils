/**
 * @packageDocumentation
 *
 * This file defines an enumeration for common file and folder paths used in Obsidian plugin development.
 */

/**
 * Enumeration of commonly used file and folder paths in Obsidian plugin development.
 */
export enum ObsidianPluginRepoPaths {
  /** CommonJS file. */
  AnyCjs = '*.cjs',

  /** JavaScript file. */
  AnyJs = '*.js',

  /** ESM JavaScript file. */
  AnyMjs = '*.mjs',

  /** Any path recursively. */
  AnyPath = '**',

  /** TypeScript file. */
  AnyTs = '*.ts',

  /** ReactJS TypeScript file. */
  AnyTsx = '*.tsx',

  /** Changelog file. */
  ChangelogMd = 'CHANGELOG.md',

  /** Current folder. */
  CurrentFolder = '.',

  /** Distribution folder. */
  Dist = 'dist',

  /** Build folder within the {@link Dist} folder. */
  DistBuild = 'dist/build',

  /** Development folder within the {@link Dist} folder. */
  DistDev = 'dist/dev',

  /** CommonJS ESLint configuration file. */
  EslintConfigCjs = 'eslint.config.cjs',

  /** CommonJS TypeScript ESLint configuration file. */
  EslintConfigCts = 'eslint.config.cts',

  /** JavaScript ESLint configuration file. */
  EslintConfigJs = 'eslint.config.js',

  /** ESM JavaScript ESLint configuration file. */
  EslintConfigMjs = 'eslint.config.mjs',

  /** ESM TypeScript ESLint configuration file. */
  EslintConfigMts = 'eslint.config.mts',

  /** TypeScript ESLint configuration file. */
  EslintConfigTs = 'eslint.config.ts',

  /** Hot reload file. */
  HotReload = '.hotreload',

  /** Main CSS file. */
  MainCss = 'main.css',

  /** Main JavaScript file. */
  MainJs = 'main.js',

  /** Main TypeScript file. */
  MainTs = 'main.ts',

  /** Manifest file for beta releases. */
  ManifestBetaJson = 'manifest-beta.json',

  /** Manifest file. */
  ManifestJson = 'manifest.json',

  /** NPM shrinkwrap file. */
  NpmShrinkwrapJson = 'npm-shrinkwrap.json',

  /** Package JSON file. */
  PackageJson = 'package.json',

  /** Package-lock JSON file. */
  PackageLockJson = 'package-lock.json',

  /** Scripts folder. */
  Scripts = 'scripts',

  /** Source folder. */
  Src = 'src',

  /** Styles CSS file. */
  StylesCss = 'styles.css',

  /** TypeScript configuration file. */
  TsConfigJson = 'tsconfig.json',

  /** Versions JSON file. */
  VersionsJson = 'versions.json'
}
