import { wrapCliTask } from '../src/script-utils/cli-utils.ts';
import { stampGeneratedDuringBuild } from './stamp-generated-during-build.ts';

await wrapCliTask(async () => {
  await stampGeneratedDuringBuild();
});
