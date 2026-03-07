/**
 * @packageDocumentation
 *
 * Commit script.
 */

import { wrapCliTask } from '../src/script-utils/cli-utils.ts';
import { execFromRoot } from '../src/script-utils/root.ts';

await wrapCliTask(async () => {
  await execFromRoot('cz');
});
