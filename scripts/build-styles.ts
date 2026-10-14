import { wrapCliTask } from '@mnaoumov/typescript-dev-toolkit/cli-utils';
import { execFromRoot } from '@mnaoumov/typescript-dev-toolkit/root';

await wrapCliTask(async () => {
  await execFromRoot('sass src/styles/main.scss dist/styles.css --embed-sources --embed-source-map');
});
