import process from 'node:process';

import { wrapCliTask } from '../src/script-utils/cli-utils.ts';
import { npmRun } from '../src/script-utils/npm-run.ts';
import {
  parseVersionArguments,
  updateVersion
} from '../src/script-utils/version.ts';
import { stampGeneratedDuringBuild } from './stamp-generated-during-build.ts';

const [, , ...$arguments] = process.argv;

await wrapCliTask(async () => {
  await npmRun('build:templates');
  const { options, versionUpdateType } = parseVersionArguments($arguments);
  // The NPM publish is deliberately NOT run from here.
  // It happens in `.github/workflows/publish-npm.yml`, triggered by the GitHub release this creates.
  // That way it authenticates as a trusted publisher (OIDC), with no long-lived NPM token on this machine.
  await updateVersion(versionUpdateType, {
    ...options,
    prepareGitHubRelease
  });
});

async function prepareGitHubRelease(): Promise<void> {
  // The build stamped `dist/` with the version being released FROM, because it runs before the bump.
  // Re-stamping here picks up the bumped `package.json`, so the GitHub release asset carries the new one.
  // The NPM tarball is a separate artifact, built at the tag by `.github/workflows/publish-npm.yml`.
  await stampGeneratedDuringBuild();
}
