import { wrapCliTask } from '@mnaoumov/typescript-dev-toolkit/cli-utils';
import {
  generateLibraryExports,
  SOURCE_CONDITION
} from '@mnaoumov/typescript-dev-toolkit/library-build';

await wrapCliTask(async () => {
  await generateLibraryExports({ sourceCondition: SOURCE_CONDITION });
});
