import process from 'node:process';
import { parseArgs } from 'node:util';

import {
  CliTaskResult,
  wrapCliTask
} from '../src/script-utils/cli-utils.ts';
import {
  findOverExposure,
  formatOverExposureFindings
} from '../src/script-utils/linters/over-exposure.ts';

const [, , ...args] = process.argv;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  args,
  options: {
    force: { type: 'boolean' }
  }
});

const shouldForce = values.force ?? false;

await wrapCliTask(() => {
  const projectFolder = positionals[0] ?? process.cwd();
  process.stderr.write(`Tightening${shouldForce ? ' (forced)' : ''} over-exposed declarations in ${projectFolder}...\n`);

  let previousProgressLineLength = 0;

  const findings = findOverExposure({
    onProgress: (progress) => {
      const label = `  [${String(progress.analyzedFileCount + 1)}/${String(progress.totalFileCount)}] ${progress.currentFilePath}`;
      process.stderr.write(`\r${label.padEnd(previousProgressLineLength)}`);
      previousProgressLineLength = label.length;
    },
    projectFolder,
    shouldFix: true,
    shouldForce
  });

  process.stderr.write(`\r${' '.repeat(previousProgressLineLength)}\r`);
  process.stdout.write(formatOverExposureFindings(findings));
  return CliTaskResult.Success(findings.every((finding) => finding.wasFixed));
});
