/**
 * @packageDocumentation
 *
 * Lint markdown script.
 */

import { wrapCliTask } from '../src/ScriptUtils/CliUtils.ts';
import { lintMarkdown } from '../src/ScriptUtils/commands/LintMarkdown.ts';

await wrapCliTask(async () => {
  await lintMarkdown();
});
