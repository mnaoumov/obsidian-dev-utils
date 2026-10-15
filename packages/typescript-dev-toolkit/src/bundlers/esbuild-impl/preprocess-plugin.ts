/**
 * @file
 *
 * This module defines a custom esbuild plugin that preprocesses JavaScript and TypeScript files for any build target.
 *
 * @remarks
 * We cannot use `.` instead of `(dot)` in the above description because the file itself is preprocessed with the same rule.
 *
 * `initCjs`, `initEsm` and the shims they call are stringified with `String(fn)` and injected into every
 * built bundle as an esbuild banner, so they must be reachable from one another by BARE identifier. That is
 * why they all live in this module: esbuild compiles a cross-module call to `(0, import_module.fn)(…)`,
 * which would name a binding the emitted bundle does not have. Same-module references stay bare, and
 * {@link makePreprocessBanner} serializes the shims alongside the `init` function so they are in scope there. A shim
 * that is not serialized silently degrades to whatever the consumer's global scope holds under that name — which
 * is how `__name` used to end up holding `window.name`.
 *
 * A caller that needs more in the banner (the Obsidian plugin builder patches `require`) hands in
 * {@link PreprocessPluginOptions.additionalBannerInitFunctions}. Each one is serialized as its OWN immediately
 * invoked function after the shared scope, so it must be self-contained: it cannot see the shims, and calling one
 * from another module would hit exactly the cross-module trap above.
 */

/* eslint-disable unicorn/prefer-module -- The CommonJS surface is the subject here, not an oversight. This plugin emits the interop shims that let a bundle run under either module system, so it has to name `__filename` and `require` to detect and bridge them. `import.meta.filename` is precisely what is unavailable in the environment these branches exist to serve. */

import type { GenericObject } from '@mnaoumov/typescript-lib/type-guards';
import type { Plugin } from 'esbuild';
import type { pathToFileURL } from 'node:url';

import {
  FunctionHandlingMode,
  toJson
} from '@mnaoumov/typescript-lib/object-utils';
import {
  makeValidVariableName,
  replaceAll
} from '@mnaoumov/typescript-lib/string';
import { readFile } from 'node:fs/promises';

/**
 * Options for {@link makePreprocessBanner}.
 */
export interface MakePreprocessBannerOptions {
  /**
   * Self-contained functions serialized after the shared shims, each invoked once.
   */
  readonly additionalBannerInitFunctions?: readonly (() => void)[];

  /**
   * Whether the build is for an ESM format.
   */
  readonly isEsm?: boolean;
}

/**
 * Options for {@link preprocessPlugin}.
 */
export interface PreprocessPluginOptions {
  /**
   * Self-contained functions serialized into the banner after the shared shims, each invoked once.
   *
   * @remarks
   * Each function is emitted as `(${String(fn)})();`, so it may reference only globals and what it declares itself.
   */
  readonly additionalBannerInitFunctions?: readonly (() => void)[];

  /**
   * The self-contained function whose result replaces `import(dot)meta(dot)url` in a CommonJS build. Serialized into
   * every file that reads it.
   *
   * @default A function returning the file URL of `__filename`, or `location.href` where there is no `__filename`.
   */
  readonly cjsImportMetaUrlProvider?: () => string;

  /**
   * Whether the build is for an ESM format.
   */
  readonly isEsm?: boolean;
}

/**
 * A browser-flavored stand-in for Node's `process` global.
 */
interface BrowserProcess extends Partial<NodeJS.Process> {
  /**
   * Marks the process as a browser one. The bundled `debug` package selects its browser entry point on it.
   */
  browser: boolean;
}

/**
 * The slice of the `Symbol` constructor {@link ensureDisposeSymbols} reads and writes, with the two dispose
 * symbols optional because an engine without Explicit Resource Management does not have them.
 */
interface DisposeSymbolHost {
  asyncDispose?: symbol;
  dispose?: symbol;
  for: (key: string) => symbol;
}

interface EsmModule {
  __esModule: boolean;
  default: unknown;
}

/**
 * The slice of a browser global {@link getCjsImportMetaUrl} reads, optional because a non-browser host has none.
 */
interface LocationHost {
  location?: PageLocation;
}

interface PageLocation {
  href: string;
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
 * it, and it is self-contained, so it also holds in the Node CLI bundles this banner is emitted into.
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
 * Makes `Symbol.dispose` and `Symbol.asyncDispose` exist, falling back to the registry symbols esbuild's
 * `using` helpers look up.
 *
 * @param symbolConstructor - The `Symbol` constructor to patch. Defaults to the ambient one; the parameter
 * exists so a test can hand in an engine that lacks the well-known symbols.
 *
 * @remarks
 * Serialized into the emitted banner. A disposable declares its method under the LITERAL key
 * `[Symbol.dispose]`, while esbuild lowers every `using` to a lookup through `__knownSymbol('dispose')`,
 * which falls back to `Symbol.for('Symbol.dispose')` when the engine has no well-known symbol. On such an
 * engine the literal key evaluates to `undefined`, the method lands under the string `"undefined"`, and
 * every `using` of it throws `Object not disposable`. Filling the well-known slot with that same registry
 * symbol makes both sides name one key on every engine. A host that already has the symbol is left
 * untouched: `??=` never reaches the assignment, which the host's non-writable property would refuse.
 *
 * The default names `Symbol` bare on purpose: it exists on every engine this runs on, and a bare reference
 * resolves against whatever scope the banner is evaluated in, exactly as the bundle's own
 * `[Symbol.dispose]` keys do.
 */
export function ensureDisposeSymbols(symbolConstructor: DisposeSymbolHost = Symbol): void {
  symbolConstructor.asyncDispose ??= symbolConstructor.for('Symbol.asyncDispose');
  symbolConstructor.dispose ??= symbolConstructor.for('Symbol.dispose');
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

/**
 * Builds the banner injected at the top of every emitted bundle.
 *
 * `String(fn)` captures only the function's own body, so every shim the `init` function calls has to be
 * serialized next to it and wrapped in one shared scope; otherwise the call it makes resolves against the
 * consumer's global scope at runtime. See this file's `@file` remarks.
 *
 * @param options - The banner options.
 * @returns The banner source to prepend to the emitted bundle.
 */
export function makePreprocessBanner(options: MakePreprocessBannerOptions = {}): string {
  const { additionalBannerInitFunctions = [], isEsm = false } = options;
  const shims = isEsm ? [ensureDisposeSymbols, ensureBrowserProcess] : [ensureDisposeSymbols, ensureBrowserProcess, keepName];
  const init = isEsm ? initEsm : initCjs;
  const additionalInits = additionalBannerInitFunctions.map((function_) => `(${String(function_)})();\n`).join('');
  return `\n(function () {\n${shims.map(String).join('\n\n')}\n\n(${String(init)})();\n})();\n${additionalInits}`;
}

/* v8 ignore start -- Everything from here to the matching `stop` either needs a live esbuild context or is serialized into the emitted banner and so runs inside the built bundle, never in this process. The shims above are deliberately NOT ignored: they are ordinary functions here and are unit-tested directly. */

/**
 * Creates an esbuild plugin that preprocesses JavaScript and TypeScript files.
 *
 * This plugin performs the following tasks:
 * - Replaces instances of `import(dot)meta(dot)url` with a CommonJS-compatible `__filename` alternative.
 * - Modifies the `sourceMappingURL` comment so a template literal ending a file does not swallow it.
 * - Adds a basic `process` object to the global scope if `process` is referenced but not defined.
 * - Fills in `Symbol.dispose` / `Symbol.asyncDispose` on engines that lack them, so `using` works there.
 *
 * @param options - The plugin options.
 * @returns An esbuild `Plugin` object that handles the preprocessing.
 */
export function preprocessPlugin(options: PreprocessPluginOptions = {}): Plugin {
  const { additionalBannerInitFunctions = [], cjsImportMetaUrlProvider = getCjsImportMetaUrl, isEsm = false } = options;
  const replacements = isEsm
    ? {}
    : {
      [
        replaceAll({
          $string: 'import(dot)meta(dot)url',
          replacer: '.',
          searchValue: '(dot)'
        })
      ]: cjsImportMetaUrlProvider
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
      build.initialOptions.banner['js'] += makePreprocessBanner({ additionalBannerInitFunctions, isEsm });

      build.onLoad({ filter: /\.(?:js|ts|cjs|mjs|cts|mts)$/ }, async ($arguments) => {
        let contents = await readFile($arguments.path, 'utf-8');

        for (const [key, value] of Object.entries(replacements)) {
          const variable = `__${makeValidVariableName(key)}`;
          if (!contents.includes(key) || contents.includes(`var ${variable}`)) {
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

function getCjsImportMetaUrl(): string {
  if (typeof __filename === 'string') {
    const localRequire = require;
    const url = localRequire('node:url') as UrlModule;
    if (typeof url.pathToFileURL === 'function') {
      return url.pathToFileURL(__filename).href;
    }
  }

  // Fallback to the page URL, or an empty string if the environment is unknown.
  // eslint-disable-next-line obsidianmd/no-global-this -- A bare `location` would throw where the host has none.
  return (globalThis as LocationHost).location?.href ?? '';
}

function initCjs(): void {
  // eslint-disable-next-line obsidianmd/no-global-this -- Actively use globalThis.
  const globalThisRecord = globalThis as GenericObject;
  ensureDisposeSymbols();
  globalThisRecord['__name'] ??= keepName;
  globalThisRecord['__extractDefault'] ??= extractDefault;

  ensureBrowserProcess();

  // eslint-disable-next-line unicorn/consistent-function-scoping -- Serialized with initCjs into the banner; at module scope it would be left out of it.
  function extractDefault(module: Partial<EsmModule> | undefined): unknown {
    return module && module.__esModule && 'default' in module ? module.default : module;
  }
}

function initEsm(): void {
  ensureDisposeSymbols();
  ensureBrowserProcess();
}

/* v8 ignore stop */

/* eslint-enable unicorn/prefer-module -- Pairs with the file-level disable above. */
