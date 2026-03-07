/**
 * @packageDocumentation
 *
 * Lint fix script.
 */

import { wrapCliTask } from '../src/ScriptUtils/CliUtils.ts';
import { lintFix } from '../src/ScriptUtils/commands/LintFix.ts';

await wrapCliTask(async () => {
  await lintFix();
});
