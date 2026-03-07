/**
 * @packageDocumentation
 *
 * Commit script.
 */

import { wrapCliTask } from '../src/ScriptUtils/CliUtils.ts';
import { execFromRoot } from '../src/ScriptUtils/Root.ts';

await wrapCliTask(async () => {
  await execFromRoot('cz');
});
