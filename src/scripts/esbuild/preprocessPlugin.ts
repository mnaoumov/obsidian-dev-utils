/**
 * @packageDocumentation preprocessPlugin
 * This module defines a custom esbuild plugin that preprocesses JavaScript and TypeScript files.
 * The preprocessing includes replacing `import(dot)meta(dot)url` with a Node.js-compatible alternative,
 * ensuring compatibility with Obsidian's plugin system, and adding a basic `process` object for environments
 * where `process` is not available (like mobile or web environments).
 *
 * @remarks
 * We cannot use `.` instead of `(dot)` in the above description because the file itself is preprocessed with the same rule.
 */

import type { Plugin } from 'esbuild';

import {
  FunctionHandlingMode,
  toJson
} from '../../Object.ts';
import {
  makeValidVariableName,
  replaceAll
} from '../../String.ts';
import {
  process,
  readFile
} from '../NodeModules.ts';

interface EsmModule {
  __esModule: boolean;
  default: unknown;
}

type ProcessEx = {
  browser: boolean;
} & typeof process;

/**
 * Creates an esbuild plugin that preprocesses JavaScript and TypeScript files.
 *
 * This plugin performs the following tasks:
 * - Replaces instances of `import(dot)meta(dot)url` with a Node.js-compatible `__filename` alternative.
 * - Modifies the `sourceMappingURL` comment to ensure compatibility with Obsidian's plugin system.
 * - Adds a basic `process` object to the global scope if `process` is referenced but not defined.
 *
 * @returns An esbuild `Plugin` object that handles the preprocessing.
 */
export function preprocessPlugin(): Plugin {
  const replacements = {
    process: {
      browser: true,
      cwd: () => '/',
      env: {},
      platform: 'android'
    } as ProcessEx,
    [replaceAll('import(dot)meta(dot)url', '(dot)', '.')]: (): string => {
      if (typeof __filename === 'string') {
        // eslint-disable-next-line import-x/no-nodejs-modules, @typescript-eslint/no-require-imports
        const url = require('node:url') as typeof import('node:url');
        return url.pathToFileURL(__filename).href;
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
      build.initialOptions.banner['js'] += '\n' + `${__extractDefault.toString()}\n`;
      build.initialOptions.banner['js'] += '\n' + `(${patchRequireEsmDefault.toString()})()\n`;

      build.onLoad({ filter: /\.(js|ts|cjs|mjs|cts|mts)$/ }, async (args) => {
        let contents = await readFile(args.path, 'utf-8');

        for (const [key, value] of Object.entries(replacements)) {
          const variable = `__${makeValidVariableName(key)}`;
          if (!contents.includes(key)) {
            continue;
          }
          const valueStr = typeof value === 'function' ? `(${value.toString()})()` : toJson(value, { functionHandlingMode: FunctionHandlingMode.Full });
          if (contents.includes(`var ${variable}`)) {
            continue;
          }
          contents = `var ${variable} = globalThis['${key}'] ?? ${valueStr};\n` + contents;
        }

        // HACK: The ${''} part is used to ensure Obsidian loads the plugin properly,
        // otherwise, it stops loading after the first line of the sourceMappingURL comment.
        contents = replaceAll(contents, /`\r?\n\/\/# sourceMappingURL/g, '`\n//#${\'\'} sourceMappingURL');

        return {
          contents,
          loader: 'ts'
        };
      });
    }
  };

  function __extractDefault(module: Partial<EsmModule> | undefined): unknown {
    return module && module.__esModule && module.default ? module.default : module;
  }

  function patchRequireEsmDefault(): void {
    const __require = require;
    require = Object.assign((id: string): unknown => {
      const module = __require(id) as (Partial<EsmModule> | undefined) ?? {};
      return __extractDefault(module);
    }, __require) as NodeRequire;
  }
}
