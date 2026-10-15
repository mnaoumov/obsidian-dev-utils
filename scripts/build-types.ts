import { wrapCliTask } from '@mnaoumov/typescript-dev-toolkit/cli-utils';
import { buildLibraryTypes } from '@mnaoumov/typescript-dev-toolkit/library-build';

await wrapCliTask(async () => {
  await buildLibraryTypes();
});
