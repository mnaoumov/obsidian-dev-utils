/**
 * @packageDocumentation
 *
 * Format check script.
 */

import { wrapCliTask } from '../src/ScriptUtils/CliUtils.ts';
import { formatCheck } from '../src/ScriptUtils/commands/FormatCheck.ts';

await wrapCliTask(async () => {
  await formatCheck();
});
