/**
 * @packageDocumentation
 *
 * Lint script.
 */

import { wrapCliTask } from '../src/ScriptUtils/CliUtils.ts';
import { lint } from '../src/ScriptUtils/commands/Lint.ts';

await wrapCliTask(async () => {
  await lint();
});
