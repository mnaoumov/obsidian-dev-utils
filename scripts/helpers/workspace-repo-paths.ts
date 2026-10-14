/**
 * @file
 *
 * Paths that only this repository's own build scripts use: the docs site, the generated barrels and the
 * test-only plugins. Kept out of the published tooling packages, which have no use for them.
 */

/**
 * Paths specific to this repository's own build.
 */
export enum WorkspaceRepoPaths {
  /**
  Astro configuration file (documentation site) at the repo root.
   */
  AstroConfigTs = 'astro.config.ts',

  /**
  Astro's generated ambient types, which declare the `astro:content` virtual module and `import.meta.env`.
  Written under the Astro root, which is the repo root because `astro.config.ts` sits there. Gitignored, and
  produced only by `astro sync` / `astro build` / `astro dev`.
   */
  AstroGeneratedTypesDts = '.astro/types.d.ts',

  /**
  Dataview types.
   */
  DataviewTypes = 'packages/obsidian-lib/src/@types/dataview/**',

  /**
  A path to the built plugin-API integration-test CONSUMER plugin within the `dist` folder. Test-only and never shipped; built separately from its provider so the two carry distinct `obsidian-dev-utils` copies.
   */
  DistPluginApiTestConsumer = 'dist/plugin-api-test-consumer',

  /**
  A path to the built plugin-API integration-test PROVIDER plugin within the `dist` folder. Test-only and never shipped; built separately from its consumer so the two carry distinct `obsidian-dev-utils` copies.
   */
  DistPluginApiTestProvider = 'dist/plugin-api-test-provider',

  /**
  Documentation site folder (Astro + Starlight API-docs sub-project).
   */
  Docs = 'docs',

  /**
  Build output folder of the documentation site.
   */
  DocsDist = 'docs/dist',

  /**
  Generated-during-build CommonJS file.
   */
  GeneratedDuringBuildCjs = 'generated-during-build.cjs',

  /**
  Generated-during-build ESM JavaScript file.
   */
  GeneratedDuringBuildMjs = 'generated-during-build.mjs',

  /**
  A path to the sources of the plugin-API integration-test CONSUMER plugin.
   */
  IntegrationTestPluginApiConsumer = 'integration-test-plugin-api/consumer',

  /**
  A path to the sources of the plugin-API integration-test PROVIDER plugin.
   */
  IntegrationTestPluginApiProvider = 'integration-test-plugin-api/provider',

  /**
  Markdownlint CLI2 configuration schema TypeScript declaration file.
   */
  MarkdownlintTypesMarkdownlintCli2ConfigSchemaDts = 'packages/typescript-dev-toolkit/src/linters/markdownlint-types/@types/markdownlint-cli2-config-schema.d.ts',

  /**
  Generated flat re-export barrel file.
   */
  MergedTs = '__merged.ts'
}
