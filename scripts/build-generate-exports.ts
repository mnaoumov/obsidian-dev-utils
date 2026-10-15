import { wrapCliTask } from '@mnaoumov/typescript-dev-toolkit/cli-utils';
import { generateLibraryExports } from '@mnaoumov/typescript-dev-toolkit/library-build';

await wrapCliTask(async () => {
  await generateLibraryExports();
});
