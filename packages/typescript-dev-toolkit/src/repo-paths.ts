/**
 * @file
 *
 * Common file paths and patterns the TypeScript project tooling uses, so the tooling never spells them as
 * hardcoded strings.
 */

/**
 * Common file paths and patterns used by the TypeScript project tooling.
 */
export enum RepoPaths {
  /**
  Any file or folder.
   */
  Any = '*',

  /**
  CommonJS file.
   */
  AnyCjs = '*.cjs',

  /**
  CommonJS TypeScript declaration file.
   */
  AnyDcts = '*.d.cts',

  /**
  ESM TypeScript declaration file.
   */
  AnyDmts = '*.d.mts',

  /**
  TypeScript declaration file.
   */
  AnyDts = '*.d.ts',

  /**
  ESM JavaScript file.
   */
  AnyMjs = '*.mjs',

  /**
  Any path recursively.
   */
  AnyPath = '**',

  /**
  Any test TypeScript file.
   */
  AnyTestTs = '*.test.ts',

  /**
  Any TypeScript file.
   */
  AnyTs = '*.ts',

  /**
  Windows batch file extension.
   */
  BatExtension = '.bat',

  /**
  Folder holding the executable shims of locally-installed packages.
   */
  Bin = '.bin',

  /**
  Bun lockfile.
   */
  BunLock = 'bun.lock',

  /**
  Binary bun lockfile, written by bun before v1.2.
   */
  BunLockb = 'bun.lockb',

  /**
  Changelog file.
   */
  ChangelogMd = 'CHANGELOG.md',

  /**
  CommonJS folder.
   */
  Cjs = 'cjs',

  /**
  CommonJS file extension.
   */
  CjsExtension = '.cjs',

  /**
  Claude Code's worktree folder. `git worktree add` puts a second, complete checkout of the repository
  here, INSIDE the repository, which is the only reason a repo ever contains a copy of itself. Never
  source, so every linter that walks the tree has to skip it.
   */
  ClaudeWorktrees = '.claude/worktrees',

  /**
  Windows command script extension.
   */
  CommandExtension = '.cmd',

  /**
  Current folder.
   */
  CurrentFolder = '.',

  /**
  CommonJS TypeScript declaration file extension.
   */
  DctsExtension = '.d.cts',

  /**
  Distribution folder.
   */
  Dist = 'dist',

  /**
  A path to the `lib` folder within the {@link Dist} folder.
   */
  DistLib = 'dist/lib',

  /**
  A path to the `templates` folder within the {@link Dist} folder, holding the consumer-facing templates.
   */
  DistTemplates = 'dist/templates',

  /**
  Transpiled TypeScript declaration file extension.
   */
  DjsExtension = '.d.js',

  /**
  ESM TypeScript declaration file extension.
   */
  DmtsExtension = '.d.mts',

  /**
  Obsidian configuration folder within a vault.
   */
  // eslint-disable-next-line obsidianmd/hardcoded-config-path -- This is the default config folder name baked into a shipped demo-vault skeleton, not a lookup against a live vault.
  DotObsidian = '.obsidian',

  /**
  Dprint configuration file.
   */
  DprintJson = 'dprint.json',

  /**
  TypeScript declaration file extension.
   */
  DtsExtension = '.d.ts',

  /**
  CommonJS ESLint configuration file.
   */
  EslintConfigCjs = 'eslint.config.cjs',

  /**
  CommonJS TypeScript ESLint configuration file.
   */
  EslintConfigCts = 'eslint.config.cts',

  /**
  JavaScript ESLint configuration file.
   */
  EslintConfigJs = 'eslint.config.js',

  /**
  ESM JavaScript ESLint configuration file.
   */
  EslintConfigMjs = 'eslint.config.mjs',

  /**
  ESM TypeScript ESLint configuration file.
   */
  EslintConfigMts = 'eslint.config.mts',

  /**
  TypeScript ESLint configuration file.
   */
  EslintConfigTs = 'eslint.config.ts',

  /**
  ESM JavaScript folder.
   */
  Esm = 'esm',

  /**
  Windows executable extension.
   */
  ExeExtension = '.exe',

  /**
  CommonJS JavaScript index file.
   */
  IndexCjs = 'index.cjs',

  /**
  CommonJS TypeScript declaration file index file.
   */
  IndexDcts = 'index.d.cts',

  /**
  ESM TypeScript declaration file index file.
   */
  IndexDmts = 'index.d.mts',

  /**
  ESM JavaScript index file.
   */
  IndexMjs = 'index.mjs',

  /**
  TypeScript index file.
   */
  IndexTs = 'index.ts',

  /**
  JavaScript file extension.
   */
  JsExtension = '.js',

  /**
  CommonJS Markdownlint CLI2 configuration file.
   */
  MarkdownlintCli2ConfigCjs = '.markdownlint-cli2.cjs',

  /**
  JSONC Markdownlint CLI2 configuration file.
   */
  MarkdownlintCli2ConfigJsonc = '.markdownlint-cli2.jsonc',

  /**
  ESM Markdownlint CLI2 configuration file.
   */
  MarkdownlintCli2ConfigMjs = '.markdownlint-cli2.mjs',

  /**
  YAML Markdownlint CLI2 configuration file.
   */
  MarkdownlintCli2ConfigYaml = '.markdownlint-cli2.yaml',

  /**
  CommonJS Markdownlint configuration file.
   */
  MarkdownlintConfigCjs = '.markdownlint.cjs',

  /**
  JSON Markdownlint configuration file.
   */
  MarkdownlintConfigJson = '.markdownlint.json',

  /**
  JSONC Markdownlint configuration file.
   */
  MarkdownlintConfigJsonc = '.markdownlint.jsonc',

  /**
  ESM Markdownlint configuration file.
   */
  MarkdownlintConfigMjs = '.markdownlint.mjs',

  /**
  YAML Markdownlint configuration file.
   */
  MarkdownlintConfigYaml = '.markdownlint.yaml',

  /**
  YAML Markdownlint configuration file.
   */
  MarkdownlintConfigYml = '.markdownlint.yml',

  /**
  ESM JavaScript file extension.
   */
  MjsExtension = '.mjs',

  /**
  Node modules folder.
   */
  NodeModules = 'node_modules',

  /**
  NPM shrinkwrap file.
   */
  NpmShrinkwrapJson = 'npm-shrinkwrap.json',

  /**
  Package JSON file.
   */
  PackageJson = 'package.json',

  /**
  NPM lockfile.
   */
  PackageLockJson = 'package-lock.json',

  /**
  Pnpm lockfile.
   */
  PnpmLockYaml = 'pnpm-lock.yaml',

  /**
  Root folder.
   */
  RootFolder = '/',

  /**
  Scripts folder.
   */
  Scripts = 'scripts',

  /**
  Source folder.
   */
  Src = 'src',

  /**
  Styles folder.
   */
  Styles = 'styles',

  /**
  Styles CSS file.
   */
  StylesCss = 'styles.css',

  /**
  Templates folder.
   */
  Templates = 'templates',

  /**
  Test helpers folder.
   */
  TestHelpers = 'test-helpers',

  /**
  TypeScript configuration file.
   */
  TsConfigJson = 'tsconfig.json',

  /**
  TypeScript configuration file that validates the generated CommonJS declarations.
   */
  TsConfigValidateDeclarationsCjsJson = 'tsconfig.validate-declarations-cjs.json',

  /**
  TypeScript configuration file that validates the generated ESM declarations.
   */
  TsConfigValidateDeclarationsJson = 'tsconfig.validate-declarations.json',

  /**
  TypeScript file extension.
   */
  TsExtension = '.ts',

  /**
  Types folder.
   */
  Types = '@types',

  /**
  Yarn lockfile.
   */
  YarnLock = 'yarn.lock'
}
