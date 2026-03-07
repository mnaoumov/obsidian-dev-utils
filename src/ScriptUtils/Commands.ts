/**
 * @packageDocumentation
 *
 * Strongly typed command functions for Obsidian plugin development tasks.
 * Each function corresponds to a CLI command and can be imported directly.
 * Commands are safe to call from other code — they never call `process.exit()`.
 */

import {
  buildClean as buildCleanImpl,
  buildCompile as buildCompileImpl,
  buildCompileSvelte as buildCompileSvelteImpl,
  buildCompileTypeScript as buildCompileTypeScriptImpl,
  buildStatic as buildStaticImpl
} from './build.ts';
import {
  BuildMode,
  buildObsidianPlugin
} from './esbuild/ObsidianPluginBuilder.ts';
import { lint as lintImpl } from './ESLint/ESLint.ts';
import { format as formatImpl } from './format.ts';
import { lintMarkdown as lintMarkdownImpl } from './markdownlint/markdownlint.ts';
import { publish as publishImpl } from './NpmPublish.ts';
import { spellcheck as spellcheckImpl } from './spellcheck.ts';
import {
  test as testImpl,
  testCoverage as testCoverageImpl,
  testWatch as testWatchImpl
} from './test.ts';
import { updateVersion as updateVersionImpl } from './version.ts';

/**
 * Builds the plugin in production mode.
 *
 * @returns A {@link Promise} that resolves when the build is complete.
 */
export async function build(): Promise<void> {
  const result = await buildObsidianPlugin({ mode: BuildMode.Production });
  result.throwOnFailure();
}

/**
 * Cleans the build output directory.
 *
 * @returns A {@link Promise} that resolves when the clean is complete.
 */
export async function buildClean(): Promise<void> {
  await buildCleanImpl();
}

/**
 * Compiles the source code.
 *
 * @returns A {@link Promise} that resolves when the compilation check is complete.
 */
export async function buildCompile(): Promise<void> {
  await buildCompileImpl();
}

/**
 * Compiles the Svelte source code.
 *
 * @returns A {@link Promise} that resolves when the Svelte compilation check is complete.
 */
export async function buildCompileSvelte(): Promise<void> {
  await buildCompileSvelteImpl();
}

/**
 * Compiles the TypeScript source code.
 *
 * @returns A {@link Promise} that resolves when the TypeScript compilation check is complete.
 */
export async function buildCompileTypeScript(): Promise<void> {
  await buildCompileTypeScriptImpl();
}

/**
 * Copies static assets to the build output directory.
 *
 * @returns A {@link Promise} that resolves when the copy is complete.
 */
export async function buildStatic(): Promise<void> {
  await buildStaticImpl();
}

/**
 * Builds the plugin in development mode.
 *
 * @returns A {@link Promise} that resolves when the dev build starts (keeps process alive for watch mode).
 */
export async function dev(): Promise<void> {
  await buildObsidianPlugin({ mode: BuildMode.Development });
}

/**
 * Formats the source code.
 *
 * @returns A {@link Promise} that resolves when formatting is complete.
 */
export async function format(): Promise<void> {
  await formatImpl();
}

/**
 * Checks if the source code is formatted.
 *
 * @returns A {@link Promise} that resolves when the check is complete.
 */
export async function formatCheck(): Promise<void> {
  await formatImpl(false);
}

/**
 * Lints the source code.
 *
 * @returns A {@link Promise} that resolves when linting is complete.
 */
export async function lint(): Promise<void> {
  await lintImpl();
}

/**
 * Lints the source code and applies automatic fixes.
 *
 * @returns A {@link Promise} that resolves when linting and fixing is complete.
 */
export async function lintFix(): Promise<void> {
  await lintImpl(true);
}

/**
 * Lints the markdown documentation.
 *
 * @returns A {@link Promise} that resolves when linting is complete.
 */
export async function lintMarkdown(): Promise<void> {
  await lintMarkdownImpl();
}

/**
 * Lints the markdown documentation and applies automatic fixes.
 *
 * @returns A {@link Promise} that resolves when linting and fixing is complete.
 */
export async function lintMarkdownFix(): Promise<void> {
  await lintMarkdownImpl(true);
}

/**
 * Publishes the package to NPM.
 *
 * @returns A {@link Promise} that resolves when publishing is complete.
 */
export async function publish(): Promise<void> {
  await publishImpl();
}

/**
 * Checks the source code for spelling errors.
 *
 * @returns A {@link Promise} that resolves when spellchecking is complete.
 */
export async function spellcheck(): Promise<void> {
  await spellcheckImpl();
}

/**
 * Runs the test suite.
 *
 * @returns A {@link Promise} that resolves when testing is complete.
 */
export async function test(): Promise<void> {
  await testImpl();
}

/**
 * Runs the test suite with coverage reporting.
 *
 * @returns A {@link Promise} that resolves when testing is complete.
 */
export async function testCoverage(): Promise<void> {
  await testCoverageImpl();
}

/**
 * Runs the test suite in watch mode.
 *
 * @returns A {@link Promise} that resolves when testing starts (keeps process alive for watch mode).
 */
export async function testWatch(): Promise<void> {
  await testWatchImpl();
}

/**
 * Updates the package version.
 *
 * @returns A {@link Promise} that resolves when the version update is complete.
 */
export async function updateVersion(): Promise<void> {
  await updateVersionImpl();
}
