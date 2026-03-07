/**
 * @packageDocumentation
 *
 * Lint markdown fix script.
 */

import { wrapCliTask } from '../src/ScriptUtils/CliUtils.ts';
import { lintMarkdownFix } from '../src/ScriptUtils/commands/LintMarkdownFix.ts';

await wrapCliTask(async () => {
  await lintMarkdownFix();
});
