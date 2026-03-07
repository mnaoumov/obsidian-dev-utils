/**
 * @packageDocumentation
 *
 * Lint fix script.
 */

import { wrapCliTask } from '../src/ScriptUtils/CliUtils.ts';
import { lintFix } from '../src/ScriptUtils/Commands.ts';

await wrapCliTask(async () => {
  await lintFix();
});
