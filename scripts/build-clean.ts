import { wrapCliTask } from '@mnaoumov/typescript-dev-toolkit/cli-utils';
import { buildCleanLibrary } from '@mnaoumov/typescript-dev-toolkit/library-build';

await wrapCliTask(async () => {
  await buildCleanLibrary();
});
