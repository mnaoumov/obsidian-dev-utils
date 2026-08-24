/**
 * @file
 *
 * This module defines a custom esbuild plugin that preprocesses JavaScript and TypeScript files.
 *
 * @remarks
 * We cannot use `.` instead of `(dot)` in the above description because the file itself is preprocessed with the same rule.
 *
 * `initCjs`, `initEsm` and the shims they call are stringified with `String(fn)` and injected into every
 * built bundle as an esbuild banner, so they must be reachable from one another by BARE identifier. That is
 * why they all live in this module: esbuild compiles a cross-module call to `(0, import_module.fn)(…)`,
 * which would name a binding the emitted bundle does not have. Same-module references stay bare, and
 * `makeBanner()` serializes the shims alongside the `init` function so they are in scope there. A shim that
 * is not serialized silently degrades to whatever the consumer's global scope holds under that name — which
 * is how `__name` used to end up holding `window.name`.
 */

/* eslint-disable unicorn/prefer-module -- The CommonJS surface is the subject here, not an oversight. This plugin emits the interop shims that let a bundle run under either module system, so it has to name `__filename` and `require` to detect and bridge them. `import.meta.filename` is precisely what is unavailable in the environment these branches exist to serve. */

import type { Plugin } from 'esbuild';
import type { pathToFileURL } from 'node:url';

import { readFile } from 'node:fs/promises';

import type { GenericObject } from '../../../type-guards.ts';

import {
  FunctionHandlingMode,
  toJson
} from '../../../object-utils.ts';
import {
  makeValidVariableName,
  replaceAll
} from '../../../string.ts';

/**
 * A browser-flavored stand-in for Node's `process` global.
 */
interface BrowserProcess extends Partial<NodeJS.Process> {
  /**
   * Marks the process as a browser one. The bundled `debug` package selects its browser entry point on it.
   */
  browser: boolean;
}

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
 * Ensures the bundle runs against a `process` global that browser-targeting packages recognize.
 *
 * @remarks
 * Serialized into the emitted banner, so it never runs in the builder process — but it is an ordinary
 * function here, so it is unit-tested directly rather than by evaluating the banner text.
 *
 * Fills in the keys MISSING from a host-provided `process` rather than replacing or skipping it. Obsidian
 * Mobile exposes a partial `process`, and the whole-object guards this replaced (`if (globalThis.process) {
 * return; }` / `globalThisRecord['process'] ??= …`) took that as "already shimmed", so `browser` never
 * landed. The bundled `debug` package then selected its Node entry point, which calls
 * `require('util').deprecate()` at module top level, and on mobile the patched `require` returns `{}` — so
 * the plugin threw before its `onload` ran.
 *
 * A real Node or Electron `process` is left completely untouched. `process.versions.node` is the signal for
 * it, and — unlike `globalThis.app.isMobile` — it is self-contained, so it also holds in the Node CLI
 * bundles this banner is emitted into, where no Obsidian `app` exists.
 */
export function ensureBrowserProcess(): void {
  const browserProcess: GenericObject<BrowserProcess> = {
    browser: true,
    cwd() {
      return '/';
    },
    env: {},
    platform: 'android'
  };

  // eslint-disable-next-line obsidianmd/no-global-this, unicorn/no-unnecessary-global-this -- Must stay `globalThis`-qualified: in the emitted banner a bare `process` is a free identifier, so reading it where the host has none throws a ReferenceError instead of yielding `undefined`. That is the very case this function exists to handle.
  const existingProcess = globalThis.process as Partial<NodeJS.Process> | undefined;

  if (!existingProcess) {
    // eslint-disable-next-line obsidianmd/no-global-this -- Actively use globalThis.
    globalThis.process = browserProcess as NodeJS.Process;
    return;
  }

  if (existingProcess.versions?.node) {
    return;
  }

  const existingProcessRecord = existingProcess as GenericObject;

  for (const [key, value] of Object.entries(browserProcess)) {
    existingProcessRecord[key] ??= value;
  }

  existingProcessRecord['browser'] = true;
}

/**
 * Returns its argument unchanged.
 *
 * @param $unknown - The value to return.
 * @returns The value passed in.
 *
 * @remarks
 * Serialized into the emitted banner, where it stands in for esbuild's `__name` helper — which names a
 * function and returns it — for bundles that reference the helper without emitting their own.
 */
export function keepName($unknown: unknown): unknown {
  return $unknown;
}

/* v8 ignore start -- Everything from here to the matching `stop` either needs a live esbuild context or is serialized into the emitted banner and so runs inside the built bundle, never in this process. The shims above are deliberately NOT ignored: they are ordinary functions here and are unit-tested directly. */

/**
 * Creates an esbuild plugin that preprocesses JavaScript and TypeScript files.
 *
 * This plugin performs the following tasks:
 * - Replaces instances of `import(dot)meta(dot)url` with a Node.js-compatible `__filename` alternative.
 * - Modifies the `sourceMappingURL` comment to ensure compatibility with Obsidian's plugin system.
 * - Adds a basic `process` object to the global scope if `process` is referenced but not defined.
 *
 * @param isEsm - Whether the build is for an ESM format.
 * @returns An esbuild `Plugin` object that handles the preprocessing.
 */
export function preprocessPlugin(isEsm?: boolean): Plugin {
  const replacements = isEsm
    ? {}
    : {
      [
        replaceAll({
          $string: 'import(dot)meta(dot)url',
          replacer: '.',
          searchValue: '(dot)'
        })
      ]: (): string => {
        if (typeof __filename === 'string') {
          const localRequire = require;
          const url = localRequire('node:url') as UrlModule;
          if (typeof url.pathToFileURL === 'function') {
            return url.pathToFileURL(__filename).href;
          }
        }

        if (typeof window !== 'undefined') {
          return activeWindow.location.href;
        }

        // Fallback to an empty string if the environment is unknown
        return '';
      }
    };

  return {
    name: 'preprocess',
    setup(build): void {
      build.initialOptions.define ??= {};

      for (const key of Object.keys(replacements)) {
        build.initialOptions.define[key] = `__${makeValidVariableName(key)}`;
      }

      build.initialOptions.banner ??= {};
      build.initialOptions.banner['js'] ??= '';
      build.initialOptions.banner['js'] += makeBanner(isEsm);

      build.onLoad({ filter: /\.(?:js|ts|cjs|mjs|cts|mts)$/ }, async ($arguments) => {
        let contents = await readFile($arguments.path, 'utf-8');

        for (const [key, value] of Object.entries(replacements)) {
          const variable = `__${makeValidVariableName(key)}`;
          if (!contents.includes(key)) {
            continue;
          }
          if (contents.includes(`var ${variable}`)) {
            continue;
          }
          const valueString = typeof value === 'function' ? `(${String(value)})()` : toJson(value, { functionHandlingMode: FunctionHandlingMode.Full });
          contents = `var ${variable} = globalThis['${key}'] ?? ${valueString};\n${contents}`;
        }

        // HACK: The ${''} part is used to ensure Obsidian loads the plugin properly,
        // Otherwise, it stops loading after the first line of the sourceMappingURL comment.

        contents = replaceAll({
          $string: contents,
          // eslint-disable-next-line no-template-curly-in-string -- It is intentional, the string looks like a template literal, but it is not.
          replacer: '`\n//#${\'\'} sourceMappingURL',
          searchValue: /`\r?\n\/\/# sourceMappingURL/g
        });

        return {
          contents,
          loader: 'ts'
        };
      });
    }
  };
}

function initCjs(): void {
  // eslint-disable-next-line obsidianmd/no-global-this -- Actively use globalThis.
  const globalThisRecord = globalThis as GenericObject;
  globalThisRecord['__name'] ??= keepName;
  const originalRequire = require as (NodeJS.Require & Partial<RequirePatched> | undefined);
  if (originalRequire && !originalRequire.__isPatched) {
    // eslint-disable-next-line no-global-assign, no-implicit-globals -- We need to patch the `require()` function.
    require = Object.assign(
      (id: string) => requirePatched(id),
      originalRequire,
      {
        __isPatched: true
      }
    ) as RequirePatched;
  }

  globalThisRecord['__extractDefault'] ??= extractDefault;

  ensureBrowserProcess();

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

function initEsm(): void {
  ensureBrowserProcess();
}

/* v8 ignore stop */

/**
 * Builds the banner injected at the top of every emitted bundle.
 *
 * `String(fn)` captures only the function's own body, so every shim the `init` function calls has to be
 * serialized next to it and wrapped in one shared scope; otherwise the call it makes resolves against the
 * consumer's global scope at runtime. See this file's `@file` remarks.
 *
 * @param isEsm - Whether the build is for an ESM format.
 * @returns The banner source to prepend to the emitted bundle.
 */
function makeBanner(isEsm: boolean | undefined): string {
  const shims = isEsm ? [ensureBrowserProcess] : [ensureBrowserProcess, keepName];
  const init = isEsm ? initEsm : initCjs;
  return `\n(function () {\n${shims.map(String).join('\n\n')}\n\n(${String(init)})();\n})();\n`;
}

/* eslint-enable unicorn/prefer-module -- Pairs with the file-level disable above. */
