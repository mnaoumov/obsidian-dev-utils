/**
 * @packageDocumentation
 *
 * Build compile TypeScript script.
 */

import { wrapCliTask } from '../src/ScriptUtils/CliUtils.ts';
import { buildCompileTypeScript } from '../src/ScriptUtils/Commands.ts';

await wrapCliTask(async () => {
  await buildCompileTypeScript();
});
