/**
 * @file
 *
 * The shared ESLint configuration for Obsidian plugins.
 *
 * It is the generic configuration of `@mnaoumov/typescript-dev-toolkit` plus the Obsidian layers alone:
 * `eslint-plugin-obsidianmd`'s recommended rules, the root `manifest.json` and `LICENSE`, the Node-builtins exemptions
 * of desktop-only modules and tests, the integration-test rules and the Obsidian in-house rules.
 */

/* v8 ignore start -- Declarative ESLint rule/plugin configuration; correctness is verified by running ESLint, not unit tests. */

import type { DefineEslintConfigsOptions } from '@mnaoumov/typescript-dev-toolkit/linters/eslint-config';
import type { Linter } from 'eslint';

import {
  createDefaultEslintConfigContext,
  EslintConfigContext,
  getEslintCoreConfigs,
  getGlobalIgnoreConfigs,
  getTypeScriptEslintConfigs
} from '@mnaoumov/typescript-dev-toolkit/linters/eslint-config';
import { join } from '@mnaoumov/typescript-lib/path';
// eslint-disable-next-line import-x/no-rename-default -- The default export name `plugin` is too confusing.
import obsidianmd from 'eslint-plugin-obsidianmd';
import { PlainTextParser } from 'eslint-plugin-obsidianmd/dist/lib/plainTextParser.js';
import { defineConfig } from 'eslint/config';

import { ObsidianPluginRepoPaths } from '../obsidian-plugin-repo-paths.ts';
import { jsonPlugin } from './eslint-rules/manifest-helpers.ts';
import { obsidianDevUtilsPlugin } from './eslint-rules/obsidian-dev-utils-plugin.ts';
import { stripOwnedRuleCustomMessageEntries } from './obsidianmd-rule-custom-message.ts';

// eslint-disable-next-line unicorn/prefer-export-from -- Re-exported so a plugin's `scripts/eslint-config.ts` keeps importing both from here.
export type { DefineEslintConfigsOptions };
// eslint-disable-next-line unicorn/prefer-export-from -- Re-exported so a plugin's `scripts/eslint-config.ts` keeps importing both from here.
export { EslintConfigContext };

/*
 * The minimum Obsidian installer that still receives app updates and works is 1.1.9, which ships Electron
 * 21.3.3 and runs Node 16.16.0. Shipped source must therefore avoid Node/ES runtime builtins unavailable in
 * that version. Tests and scripts are dev-only and exempt.
 *
 * Source of truth: `obsidian-integration-testing/metadata.json` — the newest release carrying the field
 * (1.13.1) declares `minRunnableInstallerVersion: "1.1.9"`, and that installer's `runtimeVersions` gives the
 * Electron and Node versions above. Re-derive from there rather than editing this number by hand.
 */
const MINIMUM_NODE_VERSION = '>=16.16.0';

/**
 * Build ESLint configurations.
 *
 * This function builds the ESLint configurations of an Obsidian plugin: the generic configuration of
 * `@mnaoumov/typescript-dev-toolkit` plus the Obsidian layers.
 *
 * @param options - The parameters for defining ESLint configurations.
 * @returns The ESLint configurations.
 */
export function defineEslintConfigs(options: DefineEslintConfigsOptions = {}): Linter.Config[] {
  const context = createDefaultEslintConfigContext();

  if (options.editContext) {
    options.editContext(context);
  }

  const customConfigs = options.customConfigs?.(context) ?? [];

  return defineConfig(
    ...getGlobalIgnoreConfigs(),
    // Obsidianmd configs run first so our stricter rules override their relaxed defaults
    ...getObsidianLintConfigs(context),
    ...getTypeScriptEslintConfigs({ context, inHousePlugin: obsidianDevUtilsPlugin, minimumNodeVersion: MINIMUM_NODE_VERSION }),
    ...getObsidianOverrideConfigs(context),
    ...getNodeBuiltinsConfigs(context),
    ...getIntegrationTestConfigs(context),
    ...getManifestConfigs(),
    ...getLicenseConfigs(),
    ...customConfigs
  );
}
function getIntegrationTestConfigs(context: EslintConfigContext): Linter.Config[] {
  return defineConfig([
    {
      /*
       * An integration test that drives the UI with `dispatchEvent(new KeyboardEvent(...))` produces an
       * UNTRUSTED event, and Obsidian and CodeMirror gate on `isTrusted` — so the test can exercise
       * nothing while still passing. Only integration tests are covered: a unit test has no real input
       * pipeline to reach, so dispatching is the only thing it can do.
       *
       * Android files used to be exempt BY FILENAME, on the grounds that the trusted helpers were built on
       * `window.electron` and so could not be reached from a phone at all. That exemption is gone: the
       * harness gained a mobile trusted-input path, and `clickElement`, `clickMouse`, `pressKey` and
       * `typeIntoEditor` all work there. Only the hover helpers still throw, because `:hover` has no touch
       * equivalent — a file reaching for those has to branch on `Platform.isDesktopApp`, which is the same
       * thing a `*.cross-platform.*` file has always had to do.
       */
      files: context.sourceFolders.map((sourceFolder) => join(sourceFolder, ObsidianPluginRepoPaths.AnyPath, ObsidianPluginRepoPaths.AnyIntegrationTestTs)),
      rules: {
        'obsidian-dev-utils/no-untrusted-input-events': 'error'
      }
    }
  ]);
}

/*
 * The Community directory requires a root `LICENSE`, and `obsidianmd/validate-license` is the only check
 * on what it says: the copyright holder must not still be the sample plugin's, and the year must be
 * current. Both need `PlainTextParser`, which the plugin does not export, so it is reached through its
 * build output -- the package declares no `exports` map and ships a declaration beside the module, so the
 * deep path resolves, but it is the one import here that a patch release upstream could break.
 *
 * The rule compares the year against `new Date().getFullYear()` at lint time, so a repo goes red at the
 * turn of the year until its LICENSE is bumped. `.github/workflows/update-license-year.yml` does that on
 * 1 January; a repo adopting this config needs the same workflow, or the year check will fail its CI.
 */
function getLicenseConfigs(): Linter.Config[] {
  return defineConfig([
    {
      files: [ObsidianPluginRepoPaths.License],
      languageOptions: {
        parser: PlainTextParser
      },
      plugins: {
        obsidianmd
      },
      rules: {
        'obsidianmd/validate-license': 'error'
      }
    }
  ]);
}

/*
 * The root `manifest.json` is what the Community directory's automated review actually reads, and until
 * this config existed no linter read it at all: `obsidianmd/validate-manifest` registers a `Program`
 * visitor and expects an ESTree `ObjectExpression`, while every JSON parser that ships produces something
 * else -- `@eslint/json` produces Momoa (`Document`), `jsonc-eslint-parser` produces
 * `JSONObjectExpression` -- so the rule silently matches nothing no matter which files it is scoped to.
 * The in-house rules below visit the Momoa AST instead.
 *
 * `manifest.json` is strict JSON, so an `eslint-disable` comment in it is a parse error AND would stop
 * Obsidian loading the plugin. That makes the config the only place a check can be waived, which is why
 * these are four rules rather than one: a repo with a grandfathered `id` can turn off `manifest-id` alone
 * and keep the rest.
 */
function getManifestConfigs(): Linter.Config[] {
  return defineConfig([
    {
      files: [ObsidianPluginRepoPaths.ManifestJson],
      language: 'json/json',
      plugins: {
        'json': jsonPlugin,
        'obsidian-dev-utils': obsidianDevUtilsPlugin
      },
      rules: {
        'obsidian-dev-utils/manifest-description': 'error',
        'obsidian-dev-utils/manifest-id': 'error',
        'obsidian-dev-utils/manifest-name': 'error',
        'obsidian-dev-utils/manifest-schema': 'error'
      }
    }
  ]);
}

/*
 * Every file set that is exempt from the Node-builtins bans, in one place.
 *
 * Two rules ban Node builtins, and they are NOT interchangeable. `import-x/no-nodejs-modules` is ours, it is
 * an error, and its waivers are tolerated by the community-directory review runner. `obsidianmd/no-nodejs-modules`
 * arrives via `obsidianmd.configs.recommended` (see `getObsidianLintConfigs`) and is strictly weaker on static
 * imports — its own source says "Static import declarations can never be guarded at runtime", so it reports every
 * `ImportDeclaration` of a builtin unconditionally and only `import()` / `require()` get guard-awareness. It is
 * also one the consumer CANNOT WAIVE: the directory runner sets
 * `eslint-comments/no-restricted-disable: ['error', 'obsidianmd/*', ...]`, whitelisting only
 * `obsidianmd/ui/sentence-case`, so an inline disable of it trades a warning for an error in a review. That is why
 * every exemption below has to live here in the shared config rather than as a comment at the call site.
 *
 * One further exemption deliberately lives elsewhere: `getImportXConfigs` turns off only `import-x/no-nodejs-modules`
 * for `context.scriptFiles`. It needs no `obsidianmd` twin, because `getObsidianLintConfigs` scopes the obsidianmd
 * rules to `context.sourceFiles`, so they never reach scripts in the first place.
 */
function getNodeBuiltinsConfigs(context: EslintConfigContext): Linter.Config[] {
  return defineConfig([
    {
      // Integration tests run in a Node environment and legitimately read files / paths, so the Node-builtins bans do not apply to them.
      files: context.sourceFolders.map((sourceFolder) => join(sourceFolder, ObsidianPluginRepoPaths.AnyPath, ObsidianPluginRepoPaths.AnyIntegrationTestTs)),
      rules: {
        'import-x/no-nodejs-modules': 'off',
        'obsidianmd/no-nodejs-modules': 'off'
      }
    },
    {
      /*
       * A `desktop-` prefixed module is desktop-only by convention: it is reached only through a
       * `Platform.isDesktopApp`-gated dynamic `import()` in its caller, so its static Node imports never
       * load on mobile. Neither rule can see that gate, because it sits one file up — the correctly-written pattern
       * reports anyway, and no author-side rewrite silences it.
       *
       * Exempting BY FILENAME rather than by a disable comment carries a trade-off knowingly: the exemption keys
       * off what the file is NAMED rather than what it does, so the prefix is load-bearing. A desktop-only module
       * that skips the prefix keeps reporting, and a cross-platform module that wrongly takes it gets an exemption
       * it should not have.
       */
      files: context.sourceFolders.map((sourceFolder) => join(sourceFolder, ObsidianPluginRepoPaths.AnyPath, ObsidianPluginRepoPaths.AnyDesktopTs)),
      rules: {
        'import-x/no-nodejs-modules': 'off',
        'obsidianmd/no-nodejs-modules': 'off'
      }
    },
    {
      /*
       * A unit test runs under vitest in Node and is never bundled into `main.js`, so the Node-builtins bans do not
       * apply to it either — the identical argument the integration-test block above already accepts. This also
       * covers the SUT-grouped `*.desktop.test.ts` shape, which names the platform as a dot segment after the
       * subject under test rather than as a `desktop-` prefix.
       */
      files: context.testFiles,
      rules: {
        'import-x/no-nodejs-modules': 'off',
        'obsidianmd/no-nodejs-modules': 'off'
      }
    }
  ]);
}

function getObsidianLintConfigs(context: EslintConfigContext): Linter.Config[] {
  const obsidianRecommendedConfigs = obsidianmd.configs.recommended;

  /*
   * A builtin this config sets itself must not ALSO run through `obsidianmd/rule-custom-message`, or a consumer's own
   * `'no-console': 'off'` is inert and every console line is reported twice. See `obsidianmd-rule-custom-message.ts`.
   */
  const ownedRuleNames = new Set(getEslintCoreConfigs(context).flatMap((config) => Object.keys(config.rules ?? {})));

  const scopedObsidianRecommendedConfigs = obsidianRecommendedConfigs.map((config) => {
    return config.files?.includes('package.json')
      ? config
      : {
        ...stripOwnedRuleCustomMessageEntries({ config, ownedRuleNames }),
        files: context.sourceFiles
      };
  });

  return defineConfig([
    {
      extends: [scopedObsidianRecommendedConfigs],
      plugins: {
        obsidianmd
      }
    }
  ]);
}

function getObsidianOverrideConfigs(context: EslintConfigContext): Linter.Config[] {
  return defineConfig([
    {
      files: context.sourceFolders.map((sourceFolder) => join(sourceFolder, ObsidianPluginRepoPaths.MainTs)),
      rules: {
        'import-x/no-default-export': 'off'
      }
    },
    {
      files: context.allFiles(),
      plugins: {
        'obsidian-dev-utils': obsidianDevUtilsPlugin
      },
      rules: {
        /*
         * Deliberately here, on `allFiles()`, rather than beside `no-untrusted-input-events` in
         * `getIntegrationTestConfigs()` (owner, 2026-09-09). An `evalInObsidian` call is unmistakable, so a
         * file that makes none is untouched and a broad glob costs nothing -- while script code that drives
         * a real Obsidian outside a test (`demo-vault-buttons.ts`) is under the same transport cap and would
         * otherwise be enforced nowhere.
         */
        'obsidian-dev-utils/no-over-cap-wait-in-eval-in-obsidian': 'error',
        'obsidian-dev-utils/require-component-suffix': 'error',
        /*
         * Obsidian's `Component` has its own `removeChild(component)` for the component lifecycle, unrelated
         * to `Node#removeChild`. The rule matches on the method name alone, so every report here is a
         * component being unloaded, and following the advice calls a `remove()` that does not exist -- which
         * is what `tsc` said when the fixer was let loose on them.
         */
        'unicorn/prefer-dom-node-remove': 'off',
        /*
         * Directly contradicts `obsidianmd/no-global-this`: this rule rewrites `window.x` to `globalThis.x`, and
         * that one forbids `globalThis` outright. With both enabled, `--fix` applies one and then the other
         * reverts it, which ESLint reports as `ESLintCircularFixesWarning` across 29 files. Obsidian's own
         * guidance wins in an Obsidian library, so this is the rule that gives way.
         */
        'unicorn/prefer-global-this': 'off'
      }
    }
  ]);
}

/* v8 ignore stop */
