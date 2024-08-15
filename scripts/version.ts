import { wrapTask } from "../src/cli.ts";
import { lint } from "../src/ESLint/ESLint.ts";
import { spellcheck } from "../src/spellcheck.ts";
import { TaskResult } from "../src/TaskResult.ts";
import {
  addGitTag,
  addUpdatedFilesToGit,
  CHANGELOG_MD,
  checkGitHubCliInstalled,
  checkGitInstalled,
  checkGitRepoClean,
  getNewVersion,
  gitPush,
  updateChangelog,
  validate
} from "../src/version.ts";
import { execFromRoot, resolvePathFromRoot } from "../src/Root.ts";
import { editNpmPackage } from "../src/Npm.ts";
import AdmZip from "adm-zip";
import { readdirPosix } from "../src/Fs.ts";
import { join } from "../src/Path.ts";

await (wrapTask(async (): Promise<TaskResult | void> => {
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
}))();

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
  zip.addLocalFolder(resolvePathFromRoot("dist"));
  zip.writeZip(`dist/dist.zip`);

  await execFromRoot(toCommandLine(["gh", "release", "create", newVersion, CHANGELOG_MD, "LICENSE", "README.md", "package.config", "dist/dist.zip", "--title", `v${newVersion}`, "--notes-file", "-"]), {
    quiet: true,
    stdin: await getReleaseNotes(newVersion)
  });
}
