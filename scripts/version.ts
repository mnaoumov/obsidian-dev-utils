import { wrapCliTask } from "../src/bin/cli.ts";
import { lint } from "../src/bin/ESLint/ESLint.ts";
import { spellcheck } from "../src/bin/spellcheck.ts";
import { TaskResult } from "../src/TaskResult.ts";
import {
  addGitTag,
  addUpdatedFilesToGit,
  checkGitHubCliInstalled,
  checkGitInstalled,
  checkGitRepoClean,
  getNewVersion,
  getReleaseNotes,
  gitPush,
  updateChangelog,
  validate
} from "../src/bin/version.ts";
import {
  execFromRoot,
  resolvePathFromRoot
} from "../src/Root.ts";
import { editNpmPackage } from "../src/Npm.ts";
import AdmZip from "adm-zip";
import { ObsidianDevUtilsRepoPaths } from "../src/bin/esbuild/ObsidianDevUtilsPaths.ts";

await wrapCliTask(async (): Promise<TaskResult | void> => {
  const versionUpdateType = process.argv[2];

  if (!versionUpdateType) {
    console.error("Version update type is required");
    return TaskResult.CreateSuccessResult(false);
  }

  return await TaskResult.chain([
    async (): Promise<void> => {
      validate(versionUpdateType);
      await checkGitInstalled();
      await checkGitRepoClean();
      await checkGitHubCliInstalled();
    },
    (): Promise<TaskResult> => spellcheck(),
    (): Promise<TaskResult> => lint(),
    async (): Promise<void> => {
      await execFromRoot("npm run build");

      const newVersion = await getNewVersion(versionUpdateType);
      await updateVersionInFiles(newVersion);
      await updateChangelog(newVersion);
      await addUpdatedFilesToGit(newVersion);
      await addGitTag(newVersion);
      await gitPush();
      await publishGitHubRelease(newVersion);
      await publishNpmPackage();
    }
  ]);
});

async function publishNpmPackage(): Promise<void> {
  await execFromRoot("npm publish");
}

async function updateVersionInFiles(newVersion: string): Promise<void> {
  await editNpmPackage((npmPackage) => {
    npmPackage.version = newVersion;
  });
}

async function publishGitHubRelease(newVersion: string): Promise<void> {
  const zip = new AdmZip();
  zip.addLocalFolder(resolvePathFromRoot(ObsidianDevUtilsRepoPaths.Dist));
  zip.writeZip(ObsidianDevUtilsRepoPaths.DistZip);

  await execFromRoot([
    "gh",
    "release",
    "create",
    newVersion,
    ObsidianDevUtilsRepoPaths.ChangelogMd,
    ObsidianDevUtilsRepoPaths.License,
    ObsidianDevUtilsRepoPaths.ReadmeMd,
    ObsidianDevUtilsRepoPaths.PackageJson,
    ObsidianDevUtilsRepoPaths.DistZip,
    "--title",
    `v${newVersion}`,
    "--notes-file",
    "-"
  ], {
    quiet: true,
    stdin: await getReleaseNotes(newVersion)
  });
}
