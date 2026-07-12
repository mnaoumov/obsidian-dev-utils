/**
 * @file
 *
 * This module defines an enumeration of common file paths and patterns used in the Obsidian development utilities repository.
 * These paths are used throughout the build process and other utilities, ensuring consistency and reducing the likelihood
 * of errors due to hardcoded strings.
 */

/**
 * Enumeration of common file paths and patterns used in the Obsidian development utilities repository.
 */
export enum ObsidianDevUtilsRepoPaths {
  /** Any file or folder. */
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

  /** CommonJS folder. */
  Cjs = 'cjs',

  /** CommonJS file extension. */
  CjsExtension = '.cjs',

  /** Current folder. */
  CurrentFolder = '.',

  /** Dataview types. */
  DataviewTypes = 'src/obsidian/@types/dataview/**',

  /** CommonJS TypeScript declaration file extension. */
  DctsExtension = '.d.cts',

  /** Distribution folder. */
  Dist = 'dist',

  /** A path to the `lib` folder within the {@link Dist} folder. */
  DistLib = 'dist/lib',

  /** A path to the `templates` folder within the {@link Dist} folder, holding the consumer-facing templates. */
  DistTemplates = 'dist/templates',

  /** Transpiled TypeScript declaration file extension. */
  DjsExtension = '.d.js',

  /** ESM TypeScript declaration file extension. */
  DmtsExtension = '.d.mts',

  /** Dprint configuration file. */
  DprintJson = 'dprint.json',

  /** TypeScript declaration file extension. */
  DtsExtension = '.d.ts',

  /** ESM TypeScript ESLint configuration file. */
  EslintConfigMts = 'eslint.config.mts',

  /** ESM JavaScript folder. */
  Esm = 'esm',

  /** Generated-during-build CommonJS file. */
  GeneratedDuringBuildCjs = 'generated-during-build.cjs',

  /** Generated-during-build ESM JavaScript file. */
  GeneratedDuringBuildMjs = 'generated-during-build.mjs',

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

  /** ESM Markdownlint CLI2 configuration file. */
  MarkdownlintCli2ConfigMjs = '.markdownlint-cli2.mjs',

  /** Markdownlint CLI2 configuration schema TypeScript declaration file. */
  MarkdownlintTypesMarkdownlintCli2ConfigSchemaDts = 'src/script-utils/linters/markdownlint-types/@types/markdownlint-cli2-config-schema.d.ts',

  /** Generated flat re-export barrel file. */
  MergedTs = '__merged.ts',

  /** ESM JavaScript file extension. */
  MjsExtension = '.mjs',

  /** Node modules folder. */
  NodeModules = 'node_modules',

  /** Package JSON file. */
  PackageJson = 'package.json',

  /** Root folder. */
  RootFolder = '/',

  /** Scripts folder. */
  Scripts = 'scripts',

  /** ScriptUtils folder. */
  ScriptUtils = 'script-utils',

  /** Source folder. */
  Src = 'src',

  /** Styles folder. */
  Styles = 'styles',

  /** Styles CSS file. */
  StylesCss = 'styles.css',

  /** Templates folder. */
  Templates = 'templates',

  /** Test helpers folder. */
  TestHelpers = 'test-helpers',

  /** TypeScript configuration file. */
  TsConfigJson = 'tsconfig.json',

  /** TypeScript configuration file that validates the generated CommonJS declarations. */
  TsConfigValidateDeclarationsCjsJson = 'tsconfig.validate-declarations-cjs.json',

  /** TypeScript configuration file that validates the generated ESM declarations. */
  TsConfigValidateDeclarationsJson = 'tsconfig.validate-declarations.json',

  /** TypeScript file extension. */
  TsExtension = '.ts',

  /** Types folder. */
  Types = '@types'
}
