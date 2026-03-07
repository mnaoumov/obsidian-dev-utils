/**
 * @packageDocumentation
 *
 * Lint markdown script.
 */

import { wrapCliTask } from '../src/ScriptUtils/CliUtils.ts';
import { lintMarkdown } from '../src/ScriptUtils/Commands.ts';

await wrapCliTask(async () => {
  await lintMarkdown();
});
