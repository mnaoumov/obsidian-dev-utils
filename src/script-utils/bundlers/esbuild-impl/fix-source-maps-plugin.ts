/**
 * @file
 *
 * This module defines an esbuild plugin that fixes source maps generated during development.
 * It adjusts the paths in the source maps to be compatible with Obsidian's internal URL scheme.
 * A plugin is only active during development builds.
 */

/* v8 ignore start -- esbuild plugin that rewrites source maps for Obsidian URL scheme; requires a live esbuild context. */

import type { Plugin } from 'esbuild';

import { existsSync } from 'node:fs';
import {
  readFile,
  writeFile
} from 'node:fs/promises';

import { toPosixPath } from '../../../path.ts';
import { replaceAll } from '../../../string.ts';

/**
 * Parameters for {@link fixSourceMapsPlugin}.
 */
export interface FixSourceMapsPluginParams {
  /**
   * The paths to the output files containing the source maps.
   */
  readonly distPaths: string[];

  /**
   * A boolean indicating whether the build is a production build. The plugin only runs in non-production builds.
   */
  readonly isProductionBuild: boolean;

  /**
   * The name of the Obsidian plugin, used to construct the Obsidian-specific URLs.
   */
  readonly pluginName: string;
}

interface SourceMap {
  sources: string[];
}

/**
 * Creates an esbuild plugin that fixes source maps by adjusting the paths to be compatible
 * with Obsidian's internal URL scheme.
 *
 * @param params - The parameters for the function.
 * @returns An esbuild `Plugin` object that fixes source maps.
 */
export function fixSourceMapsPlugin(params: FixSourceMapsPluginParams): Plugin {
  const {
    distPaths,
    isProductionBuild,
    pluginName
  } = params;
  return {
    name: 'fix-source-maps',
    setup(build): void {
      build.onEnd(async () => {
        if (isProductionBuild) {
          return;
        }

        for (const distPath of distPaths) {
          if (!existsSync(distPath)) {
            continue;
          }

          const content = await readFile(distPath, 'utf-8');
          const newContent = replaceAll({
            replacer: ({ capturedGroupArgs: [prefix = '', sourceMapBase64 = '', suffix = ''] }) => `${prefix + fixSourceMap(sourceMapBase64, pluginName) + suffix.trim()}\n/* nosourcemap */`,
            searchValue: /(?<Prefix>\n(?:\/\/|\/\*)# sourceMappingURL=data:application\/json;base64,)(?<SourceMapBase64>.+?)(?<Suffix>$|\n| \*\/)(?:.|\n)*/g,
            str: content
          });

          if (content !== newContent) {
            await writeFile(distPath, newContent);
          }
        }
      });
    }
  };
}

/**
 * Converts a given file path to an Obsidian-specific URL.
 *
 * @param path - The original file path.
 * @param pluginName - The name of the Obsidian plugin.
 * @returns The converted path as an Obsidian-specific URL.
 */
function convertPathToObsidianUrl(path: string, pluginName: string): string {
  const convertedPath = replaceAll({
    replacer: '',
    searchValue: /^(?:\.\.\/)+/g,
    str: toPosixPath(path)
  });
  return `app://obsidian.md/plugin:${pluginName}/${convertedPath}`;
}

/**
 * Adjusts the paths in the base64-encoded source map to be compatible with Obsidian's URL scheme.
 *
 * @param sourceMapBase64 - The base64-encoded source map content.
 * @param pluginName - The name of the Obsidian plugin, used to construct the Obsidian-specific URLs.
 * @returns A base64-encoded string with the adjusted source map.
 */
function fixSourceMap(sourceMapBase64: string, pluginName: string): string {
  const sourceMapJson = Buffer.from(sourceMapBase64, 'base64').toString('utf-8');
  const sourceMap = JSON.parse(sourceMapJson) as Partial<SourceMap>;
  sourceMap.sources = (sourceMap.sources ?? []).map((path) => convertPathToObsidianUrl(path, pluginName));
  return Buffer.from(JSON.stringify(sourceMap)).toString('base64');
}

/* v8 ignore stop */
