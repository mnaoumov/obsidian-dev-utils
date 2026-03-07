/**
 * @packageDocumentation
 *
 * Lint markdown fix script.
 */

import { wrapCliTask } from '../src/ScriptUtils/CliUtils.ts';
import { lintMarkdownFix } from '../src/ScriptUtils/Commands.ts';

await wrapCliTask(async () => {
  await lintMarkdownFix();
});
