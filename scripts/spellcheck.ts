/**
 * @packageDocumentation
 *
 * Spellcheck script.
 */

import { wrapCliTask } from '../src/ScriptUtils/CliUtils.ts';
import { spellcheck } from '../src/ScriptUtils/Commands.ts';

await wrapCliTask(async () => {
  await spellcheck();
});
