/**
 * @file
 *
 * Refuses a `package-lock.json` whose installed entries have lost their `resolved` or `integrity` field.
 *
 * You get such a lock by deleting `package-lock.json` while `node_modules` is still installed and then
 * running `npm install`. npm records every package it reuses from `node_modules` with its version only.
 * One measured lock went from 7 such entries to 1064 of 1234 in a single regeneration. **npm never fills
 * the two fields back in afterwards**: a clean install into an empty directory does not, and neither does
 * `npm install --package-lock-only`. `npm ci` skips integrity verification for those packages, so the
 * defect is permanent and every other check stays green.
 *
 * The check reads the JSON and nothing else. It makes no network call and finishes in well under a second,
 * which is why `gate()` runs it before anything else.
 */

import { existsSync } from 'node:fs';

import type { PackageLockJson } from './npm.ts';

import {
  getPackageLockJsonPath,
  readPackageLockJson
} from './npm.ts';

/**
 * How many offending keys the error names before it summarizes the rest as a count.
 */
const MAX_REPORTED_KEYS = 5;

const NODE_MODULES_SEGMENT = 'node_modules/';
const REGISTRY_RESOLVED_REG_EXP = /^https?:\/\//;

/**
 * The fields of a `packages` entry this check reads. They are not on `PackageJson`, because they exist only
 * in a lockfile.
 */
interface PackageLockEntry {
  readonly inBundle?: boolean;
  readonly integrity?: string;
  readonly link?: boolean;
  readonly resolved?: string;
}

/**
 * Throws when the project's `package-lock.json` has an installed entry without `resolved` or `integrity`.
 * A project with no `package-lock.json`, such as one on another package manager, passes.
 *
 * @param cwd - The folder to resolve the project root from. Defaults to the current one.
 * @returns A {@link Promise} that resolves when the lock is complete.
 */
export async function assertPackageLockIntegrity(cwd?: string): Promise<void> {
  const packageLockJsonPath = getPackageLockJsonPath(cwd);
  if (!existsSync(packageLockJsonPath)) {
    return;
  }

  const keys = findPackageLockEntriesMissingIntegrity(await readPackageLockJson(cwd));
  if (keys.length === 0) {
    return;
  }

  const shownKeys = keys.slice(0, MAX_REPORTED_KEYS).map((key) => `  ${key}`);
  const remainingCount = keys.length - shownKeys.length;
  if (remainingCount > 0) {
    shownKeys.push(`  ... and ${String(remainingCount)} more`);
  }

  throw new Error(
    [
      `${packageLockJsonPath}: ${String(keys.length)} installed package(s) have no \`resolved\` or no \`integrity\`, so \`npm ci\` cannot verify them:`,
      ...shownKeys,
      'npm never adds these fields back by itself, and regenerating the lock would change versions. Fill each entry from the registry',
      'metadata for the version already locked: GET https://registry.npmjs.org/<name, with / written as %2f>/<version>, and copy',
      '`dist.tarball` into `resolved` and `dist.integrity` into `integrity`. The name is the entry\'s `name` field, or else the text',
      'after the key\'s last `node_modules/`. Then check that `npm install --package-lock-only` leaves the file byte-identical.',
      'To skip this check for one run, set PACKAGE_LOCK_INTEGRITY=0.'
    ].join('\n')
  );
}

/**
 * Finds the `packages` entries of a lockfile that have no `resolved` field, or that have a registry
 * `resolved` field and no `integrity` field.
 *
 * Some entries never have these fields in a healthy lock, so they are skipped: the root (`''`), a `link`,
 * a workspace source folder (its key has no `node_modules/` segment), and a bundled dependency (`inBundle`),
 * which comes inside its parent's tarball. `integrity` is only required when `resolved` is a registry URL,
 * because npm records no integrity for a git dependency.
 *
 * @param packageLockJson - The parsed `package-lock.json`.
 * @returns The keys of the offending entries, in lockfile order.
 */
export function findPackageLockEntriesMissingIntegrity(packageLockJson: PackageLockJson): string[] {
  const keys: string[] = [];

  for (const [key, value] of Object.entries(packageLockJson.packages ?? {})) {
    const entry = value as PackageLockEntry;
    if (key === '' || !key.includes(NODE_MODULES_SEGMENT) || entry.link || entry.inBundle) {
      continue;
    }

    if (entry.resolved === undefined || (entry.integrity === undefined && REGISTRY_RESOLVED_REG_EXP.test(entry.resolved))) {
      keys.push(key);
    }
  }

  return keys;
}
