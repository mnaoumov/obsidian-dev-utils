/**
 * @packageDocumentation
 *
 * Format script.
 */

import { wrapCliTask } from '../src/ScriptUtils/CliUtils.ts';
import { format } from '../src/ScriptUtils/Commands.ts';

await wrapCliTask(async () => {
  await format();
});
