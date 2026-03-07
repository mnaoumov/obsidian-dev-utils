/**
 * @packageDocumentation
 *
 * Build compile TypeScript script.
 */

import { wrapCliTask } from '../src/ScriptUtils/CliUtils.ts';
import { buildCompileTypeScript } from '../src/ScriptUtils/commands/BuildCompileTypeScript.ts';

await wrapCliTask(async () => {
  await buildCompileTypeScript();
});
