/**
 * @packageDocumentation
 *
 * Strongly typed command functions for Obsidian plugin development tasks.
 * Each function corresponds to a CLI command and can be imported directly.
 */

import type { CliTaskResult } from './CliUtils.ts';

import {
  buildClean,
  buildCompile,
  buildCompileSvelte,
  buildCompileTypeScript,
  buildStatic
} from './build.ts';
import {
  BuildMode,
  buildObsidianPlugin
} from './esbuild/ObsidianPluginBuilder.ts';
import { lint } from './ESLint/ESLint.ts';
import { format } from './format.ts';
import { lintMarkdown } from './markdownlint/markdownlint.ts';
import { publish } from './NpmPublish.ts';
import { spellcheck } from './spellcheck.ts';
import {
  test,
  testCoverage,
  testWatch
} from './test.ts';
import { updateVersion } from './version.ts';

/**
 * Re-exported command functions from their respective modules.
 */
export {
  buildClean,
  buildCompile,
  buildCompileSvelte,
  buildCompileTypeScript,
  buildStatic,
  format,
  lint,
  lintMarkdown,
  publish,
  spellcheck,
  test,
  testCoverage,
  testWatch,
  updateVersion
};

/**
 * Builds the plugin in production mode.
 *
 * @returns A {@link Promise} that resolves to a {@link CliTaskResult}.
 */
export async function build(): Promise<CliTaskResult> {
  return buildObsidianPlugin({ mode: BuildMode.Production });
}

/**
 * Builds the plugin in development mode.
 *
 * @returns A {@link Promise} that resolves to a {@link CliTaskResult}.
 */
export async function dev(): Promise<CliTaskResult> {
  return buildObsidianPlugin({ mode: BuildMode.Development });
}

/**
 * Checks if the source code is formatted.
 *
 * @returns A {@link Promise} that resolves when the check is complete.
 */
export async function formatCheck(): Promise<void> {
  await format(false);
}

/**
 * Lints the source code and applies automatic fixes.
 *
 * @returns A {@link Promise} that resolves when linting and fixing is complete.
 */
export async function lintFix(): Promise<void> {
  await lint(true);
}

/**
 * Lints the markdown documentation and applies automatic fixes.
 *
 * @returns A {@link Promise} that resolves when linting and fixing is complete.
 */
export async function lintMarkdownFix(): Promise<void> {
  await lintMarkdown(true);
}
