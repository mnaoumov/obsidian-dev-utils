/**
 * @packageDocumentation
 *
 * Build static script.
 */

import { wrapCliTask } from '../src/ScriptUtils/CliUtils.ts';
import { buildStatic } from '../src/ScriptUtils/commands/BuildStatic.ts';

await wrapCliTask(async () => {
  await buildStatic();
});
