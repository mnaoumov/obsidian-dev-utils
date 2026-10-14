import { wrapCliTask } from '@mnaoumov/typescript-dev-toolkit/cli-utils';

import { stampGeneratedDuringBuild } from './stamp-generated-during-build.ts';

await wrapCliTask(async () => {
  await stampGeneratedDuringBuild();
});
