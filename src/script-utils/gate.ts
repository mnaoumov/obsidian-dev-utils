/**
 * @file
 *
 * The branch gate: the verification sequence that `updateVersion` runs as its release preflight, available
 * as a command of its own.
 *
 * Four of the preflight's checks — `format:check`, `spellcheck`, `find-overexposed` and `test:coverage` —
 * are reachable by no other routine command. So the natural branch gate (build, lint, test) can be green
 * while the release is still going to fail, and the failure arrives at release time rather than in seconds
 * on the branch.
 *
 * This module exists so the two are the same code rather than two lists that agree today: `updateVersion`
 * calls {@link gate}, and a check added here is reachable from both. What the gate deliberately leaves to
 * the release path is the clean-repo assertion — a branch gate is run on a dirty tree, which is the whole
 * point of running it before committing — and the integration suite, which has to run in sequence across
 * the whole fleet and so cannot be part of a command run casually.
 */

import { parseArgs } from 'node:util';

import {
  npmRun,
  npmRunOptional
} from './npm-run.ts';

/**
 * Options for {@link gate}.
 */
export interface GateOptions {
  /**
   * Whether to run the build. The build is not a verification check — it is kept in the gate because it is
   * the only step that type-checks the project, and a green lint is not a type-check.
   *
   * @default `true`
   */
  readonly shouldBuild?: boolean;

  /**
   * Whether to run the verification checks. When `false`, only the build runs, which is what
   * `npm run version -- --no-checks` does.
   *
   * @default `true`
   */
  readonly shouldRunChecks?: boolean;

  /**
   * Whether to run the integration test suite. Off by default: integration runs have to be serialized
   * across the whole set of sibling repositories, so a gate that always ran them would collide with
   * another session's run.
   *
   * @default `false`
   */
  readonly shouldRunIntegrationTests?: boolean;
}

/**
 * Runs the verification sequence that `npm run version` runs as its preflight.
 *
 * The order is deliberate: the checks that finish in seconds (`format:check`, `spellcheck`, `lint:md`) run
 * first, so a typo fails the gate immediately instead of after the coverage run. Each step is dispatched
 * through the package manager, so a project overriding one of these scripts gets its own version, and each
 * step carries its own environment off switch.
 *
 * The steps that are run with {@link npmRunOptional} are skipped when the project does not define them; the
 * rest are required.
 *
 * @param options - The {@link GateOptions} controlling which steps run.
 * @returns A {@link Promise} that resolves when every step has passed.
 */
export async function gate(options: GateOptions = {}): Promise<void> {
  const {
    shouldBuild = true,
    shouldRunChecks = true,
    shouldRunIntegrationTests = false
  } = options;

  if (shouldRunChecks) {
    await npmRun('format:check');
    await npmRun('spellcheck');
    await npmRun('lint:md');
  }

  if (shouldBuild) {
    await npmRun('build');
  }

  if (shouldRunChecks) {
    await npmRun('lint');
    await npmRunOptional('find-overexposed');
    await npmRunOptional('test');

    if (shouldRunIntegrationTests) {
      await npmRunOptional('test:integration');
    }

    await npmRunOptional('test:coverage');
  }
}

/**
 * Parses the command-line arguments for the gate script.
 *
 * @param $arguments - The command-line arguments to parse.
 * @returns The parsed {@link GateOptions}.
 */
export function parseGateArguments($arguments: string[]): GateOptions {
  const { values } = parseArgs({
    // eslint-disable-next-line unicorn/name-replacements -- `args` is the option name Node's `parseArgs` reads.
    args: $arguments,
    options: {
      'no-build': { type: 'boolean' },
      'no-checks': { type: 'boolean' }
    }
  });

  return {
    shouldBuild: !(values['no-build'] ?? false),
    shouldRunChecks: !(values['no-checks'] ?? false)
  };
}
