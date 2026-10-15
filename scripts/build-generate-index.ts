import { wrapCliTask } from '@mnaoumov/typescript-dev-toolkit/cli-utils';
import { generateLibraryIndex } from '@mnaoumov/typescript-dev-toolkit/library-build';

await wrapCliTask(async () => {
  await generateLibraryIndex();
});
