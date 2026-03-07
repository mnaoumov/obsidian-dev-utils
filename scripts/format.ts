/**
 * @packageDocumentation
 *
 * Format script.
 */

import { wrapCliTask } from '../src/ScriptUtils/CliUtils.ts';
import { format } from '../src/ScriptUtils/commands/Format.ts';

await wrapCliTask(async () => {
  await format();
});
