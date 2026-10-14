/**
 * @file
 *
 * Runs one npm script in every workspace package that defines it, in dependency order:
 * `node scripts/run.mjs scripts/workspaces-run.ts <script> [-- <arguments>]`.
 */

import { wrapCliTask } from '@mnaoumov/typescript-dev-toolkit/cli-utils';
import process from 'node:process';

import { runInWorkspaces } from './helpers/workspaces.ts';

const [, , script, ...rest] = process.argv;

await wrapCliTask(async () => {
  if (!script) {
    throw new Error('Usage: node scripts/run.mjs scripts/workspaces-run.ts <script> [-- <arguments>]');
  }
  const scriptArguments = rest[0] === '--' ? rest.slice(1) : rest;
  await runInWorkspaces(script, { scriptArguments });
});
