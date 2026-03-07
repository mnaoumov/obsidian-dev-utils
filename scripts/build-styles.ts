/**
 * @packageDocumentation
 *
 * Build styles script.
 */

import { wrapCliTask } from '../src/ScriptUtils/CliUtils.ts';
import { execFromRoot } from '../src/ScriptUtils/Root.ts';

await wrapCliTask(async () => {
  await execFromRoot('sass src/styles/main.scss dist/styles.css --embed-sources --embed-source-map');
});
