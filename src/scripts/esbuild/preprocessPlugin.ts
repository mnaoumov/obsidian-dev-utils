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
import { readFile } from 'node:fs/promises';
import { toJson } from '../../Object.ts';
import { makeValidVariableName } from '../../String.ts';
import process from 'node:process';

/**
 * Creates an esbuild plugin that preprocesses JavaScript and TypeScript files.
 *
 * This plugin performs the following tasks:
 * - Replaces instances of `import.meta.url` with a Node.js-compatible `__filename` alternative.
 * - Modifies the `sourceMappingURL` comment to ensure compatibility with Obsidian's plugin system.
 * - Adds a basic `process` object to the global scope if `process` is referenced but not defined.
 *
 * @returns An esbuild `Plugin` object that handles the preprocessing.
 */
export function preprocessPlugin(): Plugin {
  const replacements = {
    'process': {
      cwd: () => '/',
      env: {},
      platform: 'android'
    } as typeof process,
    'import.meta.url': (): URL => {
      const normalizedPath = __filename.replace(/\\/g, '/');

      const windowsDriveLetterMatch = /^([a-zA-Z]):/.exec(normalizedPath);
      let path = normalizedPath;
      if (windowsDriveLetterMatch) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        path = `/${windowsDriveLetterMatch[1]!.toUpperCase()}:${normalizedPath.slice(2)}`;
      }

      const encodedPath = encodeURIComponent(path).replace(/%2F/g, '/').replace(/%3A/g, ':');
      return new URL(`file://${encodedPath}`);
    }
  };

  return {
    name: 'preprocess',
    setup(build): void {
      build.initialOptions.define ??= {};

      for (const key of Object.keys(replacements)) {
        build.initialOptions.define[key] = '__' + makeValidVariableName(key);
      }

      build.onLoad({ filter: /\.(js|ts|cjs|mjs|cts|mts)$/ }, async (args) => {
        let contents = await readFile(args.path, 'utf-8');

        for (const [key, value] of Object.entries(replacements)) {
          const valueStr = typeof value === 'function' ? `(${value.toString()})()` : toJson(value, { shouldHandleFunctions: true });
          if (contents.includes(`var __${makeValidVariableName(key)}`)) {
            continue;
          }
          contents = `var __${makeValidVariableName(key)} = globalThis["${key}"] ?? ${valueStr};\n` + contents;
        }

        // HACK: The ${""} part is used to ensure Obsidian loads the plugin properly,
        // otherwise, it stops loading after the first line of the sourceMappingURL comment.
        contents = contents.replace(/`\r?\n\/\/# sourceMappingURL/g, '`\n//#${""} sourceMappingURL');

        return {
          contents,
          loader: 'ts'
        };
      });
    }
  };
}
