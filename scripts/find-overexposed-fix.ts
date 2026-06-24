import process from 'node:process';

import { wrapCliTask } from '../src/script-utils/cli-utils.ts';
import {
  findOverExposure,
  formatOverExposureFindings
} from '../src/script-utils/linters/over-exposure.ts';

const [, , projectFolderArg] = process.argv;

await wrapCliTask(() => {
  const projectFolder = projectFolderArg ?? process.cwd();
  process.stderr.write(`Tightening over-exposed declarations in ${projectFolder}...\n`);

  let previousProgressLineLength = 0;

  const findings = findOverExposure({
    onProgress: (progress) => {
      const label = `  [${String(progress.analyzedFileCount + 1)}/${String(progress.totalFileCount)}] ${progress.currentFilePath}`;
      process.stderr.write(`\r${label.padEnd(previousProgressLineLength)}`);
      previousProgressLineLength = label.length;
    },
    projectFolder,
    shouldFix: true
  });

  process.stderr.write(`\r${' '.repeat(previousProgressLineLength)}\r`);
  process.stdout.write(formatOverExposureFindings(findings));
});
