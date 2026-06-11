import {
  CliTaskResult,
  wrapCliTask
} from '../src/script-utils/cli-utils.ts';
import { validateDeclarations } from '../src/script-utils/validate-declarations.ts';

await wrapCliTask(() => CliTaskResult.Success(validateDeclarations()));
