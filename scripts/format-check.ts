/**
 * @packageDocumentation
 *
 * Format check script.
 */

import { wrapCliTask } from '../src/ScriptUtils/CliUtils.ts';
import { formatCheck } from '../src/ScriptUtils/Commands.ts';

await wrapCliTask(async () => {
  await formatCheck();
});
