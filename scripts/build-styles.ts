import { wrapCliTask } from '../src/script-utils/cli-utils.ts';
import { execFromRoot } from '../src/script-utils/root.ts';

await wrapCliTask(async () => {
  await execFromRoot('sass src/styles/main.scss dist/styles.css --embed-sources --embed-source-map');
});
