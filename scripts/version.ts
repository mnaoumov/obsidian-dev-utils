import {
  toCommandLine,
  wrapTask
} from "../src/cli.ts";
import { lint } from "../src/ESLint/ESLint.ts";
import { spellcheck } from "../src/spellcheck.ts";
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
} from "../src/version.ts";
import {
  execFromRoot,
  resolvePathFromRoot
} from "../src/Root.ts";
import { editNpmPackage } from "../src/Npm.ts";
import AdmZip from "adm-zip";
import PluginPaths from "../src/obsidian/Plugin/PluginPaths.ts";

const DIST_ZIP = "dist/dist.zip";

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
  zip.writeZip(DIST_ZIP);

  await execFromRoot(toCommandLine(["gh", "release", "create", newVersion, PluginPaths.ChangelogMd, PluginPaths.License, PluginPaths.ReadmeMd, PluginPaths.PackageJson, DIST_ZIP, "--title", `v${newVersion}`, "--notes-file", "-"]), {
    quiet: true,
    stdin: await getReleaseNotes(newVersion)
  });
}
