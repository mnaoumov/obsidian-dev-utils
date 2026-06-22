import process from 'node:process';

import { wrapCliTask } from '../src/script-utils/cli-utils.ts';
import {
  findOverExposure,
  formatOverExposureFindings
} from '../src/script-utils/linters/over-exposure.ts';

const [, , projectFolder] = process.argv;

await wrapCliTask(() => {
  const findings = findOverExposure({ projectFolder: projectFolder ?? process.cwd() });
  process.stdout.write(formatOverExposureFindings(findings));
});
