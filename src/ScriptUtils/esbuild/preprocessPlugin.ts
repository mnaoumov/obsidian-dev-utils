/**
 * @packageDocumentation
 *
 * This module defines a custom esbuild plugin that preprocesses JavaScript and TypeScript files.
 *
 * @remarks
 * We cannot use `.` instead of `(dot)` in the above description because the file itself is preprocessed with the same rule.
 */

import type { Plugin } from 'esbuild';

import type { GenericObject } from '../../ObjectUtils.ts';

import {
  FunctionHandlingMode,
  toJson
} from '../../ObjectUtils.ts';
import {
  makeValidVariableName,
  replaceAll
} from '../../String.ts';
import { readFile } from '../NodeModules.ts';

interface BrowserProcess extends Partial<NodeJS.Process> {
  browser: boolean;
}

interface EsmModule {
  __esModule: boolean;
  default: unknown;
}

interface RequirePatched extends NodeJS.Require {
  __isPatched: boolean;
}

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
      [replaceAll('import(dot)meta(dot)url', '(dot)', '.')]: (): string => {
        if (typeof __filename === 'string') {
          const localRequire = require;
          const url = localRequire('node:url') as typeof import('node:url');
          if (typeof url.pathToFileURL === 'function') {
            return url.pathToFileURL(__filename).href;
          }
        }

        if (typeof window !== 'undefined') {
          return window.location.href;
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
      build.initialOptions.banner['js'] += `\n(${String(isEsm ? initEsm : initCjs)})();\n`;

      build.onLoad({ filter: /\.(?:js|ts|cjs|mjs|cts|mts)$/ }, async (args) => {
        let contents = await readFile(args.path, 'utf-8');

        for (const [key, value] of Object.entries(replacements)) {
          const variable = `__${makeValidVariableName(key)}`;
          if (!contents.includes(key)) {
            continue;
          }
          const valueStr = typeof value === 'function' ? `(${String(value)})()` : toJson(value, { functionHandlingMode: FunctionHandlingMode.Full });
          if (contents.includes(`var ${variable}`)) {
            continue;
          }
          contents = `var ${variable} = globalThis['${key}'] ?? ${valueStr};\n${contents}`;
        }

        // HACK: The ${''} part is used to ensure Obsidian loads the plugin properly,
        // Otherwise, it stops loading after the first line of the sourceMappingURL comment.
        // eslint-disable-next-line no-template-curly-in-string -- It is intentional, the string looks like a template literal, but it is not.
        contents = replaceAll(contents, /`\r?\n\/\/# sourceMappingURL/g, '`\n//#${\'\'} sourceMappingURL');

        return {
          contents,
          loader: 'ts'
        };
      });
    }
  };
}

function initCjs(): void {
  const globalThisRecord = globalThis as unknown as GenericObject;
  globalThisRecord['__name'] ??= name;
  const originalRequire = require as (NodeJS.Require & Partial<RequirePatched> | undefined);
  if (originalRequire && !originalRequire.__isPatched) {
    require = Object.assign(
      (id: string) => requirePatched(id),
      originalRequire,
      {
        __isPatched: true
      }
    ) as RequirePatched;
  }

  const newFuncs: Record<string, () => unknown> = {
    __extractDefault() {
      return extractDefault;
    },
    process() {
      const browserProcess: BrowserProcess = {
        browser: true,
        cwd() {
          return '/';
        },
        env: {},
        platform: 'android'
      };
      return browserProcess;
    }
  };

  for (const key of Object.keys(newFuncs)) {
    globalThisRecord[key] ??= newFuncs[key]?.();
  }

  function name(obj: unknown): unknown {
    return obj;
  }

  function extractDefault(module: Partial<EsmModule> | undefined): unknown {
    return module && module.__esModule && 'default' in module ? module.default : module;
  }

  function requirePatched(id: string): unknown {
    // eslint-disable-next-line @typescript-eslint/no-deprecated, @typescript-eslint/no-unnecessary-condition -- We need access to app here which might not be available yet.
    const module = window?.app?.isMobile ? undefined : originalRequire?.(id) as (Partial<EsmModule> | undefined);
    if (module) {
      return extractDefault(module);
    }

    if (id === 'process' || id === 'node:process') {
      // eslint-disable-next-line no-console -- Debug message is intentional here.
      console.debug(`The most likely you can safely ignore this error. Module not found: ${id}. Fake process object is returned instead.`);
      return globalThis.process;
    }

    // eslint-disable-next-line no-console -- Debug message is intentional here.
    console.debug(`The most likely you can safely ignore this error. Module not found: ${id}. Empty object is returned instead.`);
    return {};
  }
}

function initEsm(): void {
  if ((globalThis.process as NodeJS.Process | undefined)) {
    return;
  }

  const browserProcess: BrowserProcess = {
    browser: true,
    cwd() {
      return '/';
    },
    env: {},
    platform: 'android'
  };
  globalThis.process = browserProcess as NodeJS.Process;
}
