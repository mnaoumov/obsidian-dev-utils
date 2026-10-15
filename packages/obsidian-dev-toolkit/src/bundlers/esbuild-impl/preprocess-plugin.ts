/**
 * @file
 *
 * This module defines a custom esbuild plugin that preprocesses JavaScript and TypeScript files for Obsidian.
 *
 * @remarks
 * We cannot use `.` instead of `(dot)` in the above description because the file itself is preprocessed with the same rule.
 *
 * It is the generic `@mnaoumov/typescript-dev-toolkit` preprocess plugin plus two Obsidian-only parts: a CommonJS
 * `import(dot)meta(dot)url` fallback that reads `activeWindow`, and a `require` patch that resolves Obsidian's
 * built-in modules and stubs the rest on mobile. Both are serialized into the emitted bundle with `String(fn)`, so
 * each is self-contained: it reads only globals and what it declares itself. Calling a function imported from
 * another module would compile to `(0, import_module.fn)(…)` in the CommonJS build of this package, naming a binding
 * the emitted bundle does not have.
 */

/* eslint-disable unicorn/prefer-module -- The CommonJS surface is the subject here, not an oversight. These functions bridge the module systems in the emitted bundle, so they have to name `__filename` and `require`. */

import type { Plugin } from 'esbuild';
import type { pathToFileURL } from 'node:url';

import { preprocessPlugin as genericPreprocessPlugin } from '@mnaoumov/typescript-dev-toolkit/bundlers/esbuild-impl/preprocess-plugin';

interface EsmModule {
  __esModule: boolean;
  default: unknown;
}

interface RequirePatched extends NodeJS.Require {
  __isPatched: boolean;
}

interface UrlModule {
  pathToFileURL: typeof pathToFileURL;
}

/**
 * Creates an esbuild plugin that preprocesses JavaScript and TypeScript files for an Obsidian plugin.
 *
 * This plugin performs the following tasks:
 * - Everything the generic preprocess plugin does (the `process` and `Symbol.dispose` shims, the
 * `sourceMappingURL` fix, and the CommonJS `import(dot)meta(dot)url` replacement).
 * - Falls back to `activeWindow.location.href` for `import(dot)meta(dot)url` where there is no `__filename`.
 * - In a CommonJS build, patches `require()` so Obsidian's built-in modules resolve and the rest degrade on mobile.
 *
 * @param isEsm - Whether the build is for an ESM format.
 * @returns An esbuild `Plugin` object that handles the preprocessing.
 */
export function preprocessPlugin(isEsm?: boolean): Plugin {
  return genericPreprocessPlugin({
    additionalBannerInitFunctions: isEsm ? [] : [patchObsidianRequire],
    cjsImportMetaUrlProvider: getObsidianCjsImportMetaUrl,
    isEsm: isEsm ?? false
  });
}

/* v8 ignore start -- Both functions are serialized into the emitted bundle and so run inside it, never in this process. */

function getObsidianCjsImportMetaUrl(): string {
  if (typeof __filename === 'string') {
    const localRequire = require;
    const url = localRequire('node:url') as UrlModule;
    if (typeof url.pathToFileURL === 'function') {
      return url.pathToFileURL(__filename).href;
    }
  }

  // Fallback to an empty string if the environment is unknown
  return typeof window === 'undefined' ? '' : activeWindow.location.href;
}

function patchObsidianRequire(): void {
  const originalRequire = require as (NodeJS.Require & Partial<RequirePatched> | undefined);
  if (!originalRequire || originalRequire.__isPatched) {
    return;
  }

  // eslint-disable-next-line no-global-assign, no-implicit-globals -- We need to patch the `require()` function.
  require = Object.assign(
    (id: string) => requirePatched(id),
    originalRequire,
    {
      __isPatched: true
    }
  ) as RequirePatched;

  function extractDefault(module: Partial<EsmModule> | undefined): unknown {
    return module && module.__esModule && 'default' in module ? module.default : module;
  }

  const OBSIDIAN_BUILT_IN_MODULE_NAMES = new Set([
    '@codemirror/autocomplete',
    '@codemirror/collab',
    '@codemirror/commands',
    '@codemirror/language',
    '@codemirror/lint',
    '@codemirror/search',
    '@codemirror/state',
    '@codemirror/text',
    '@codemirror/view',
    '@lezer/common',
    '@lezer/highlight',
    '@lezer/lr',
    'obsidian'
  ]);

  const DEPRECATED_OBSIDIAN_BUILT_IN_MODULE_NAMES = new Set([
    '@codemirror/closebrackets',
    '@codemirror/comment',
    '@codemirror/fold',
    '@codemirror/gutter',
    '@codemirror/highlight',
    '@codemirror/history',
    '@codemirror/matchbrackets',
    '@codemirror/panel',
    '@codemirror/rangeset',
    '@codemirror/rectangular-selection',
    '@codemirror/stream-parser',
    '@codemirror/tooltip'
  ]);

  function requirePatched(id: string): unknown {
    if (OBSIDIAN_BUILT_IN_MODULE_NAMES.has(id) || DEPRECATED_OBSIDIAN_BUILT_IN_MODULE_NAMES.has(id)) {
      return originalRequire?.(id);
    }

    // eslint-disable-next-line @typescript-eslint/no-deprecated, obsidianmd/no-global-this  -- Need access to app. Actively use globalThis.
    if (globalThis.app.isMobile) {
      if (id === 'process' || id === 'node:process') {
        // eslint-disable-next-line no-console -- Valid usage.
        console.debug(`The most likely you can safely ignore this error. Module not found: ${id}. Fake process object is returned instead.`);

        return process;
      }
    } else {
      const module = originalRequire?.(id) as (Partial<EsmModule> | undefined);
      if (module) {
        return extractDefault(module);
      }
    }

    // eslint-disable-next-line no-console -- Valid usage.
    console.debug(`The most likely you can safely ignore this error. Module not found: ${id}. Empty object is returned instead.`);
    return {};
  }
}

/* v8 ignore stop */

/* eslint-enable unicorn/prefer-module -- Pairs with the file-level disable above. */
