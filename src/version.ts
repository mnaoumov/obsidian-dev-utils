import { TaskResult } from "./TaskResult.ts";
import { execFromRoot } from "./Root.ts";
import { spellcheck } from "./spellcheck.ts";
import { lint } from "./ESLint/ESLint.ts";
import { BuildMode, buildPlugin } from "./PluginBuilder.ts";

enum VersionType {
  Major = "major",
  Minor = "minor",
  Patch = "patch",
  Manual = "manual"
}

export async function updateVersion(version: string): Promise<TaskResult | void> {
  const versionType = getVersionType(version);
  return await TaskResult.chain([
    () => checkGitInstalled(),
    () => checkGitRepoClean(),
    () => checkGitHubCliInstalled(),
    () => spellcheck(),
    () => lint(),
    () => buildPlugin({ mode: BuildMode.Production })
  ]);
}

async function checkGitInstalled(): Promise<void> {
  try {
    await execFromRoot("git --version", { quiet: true });
  } catch {
    throw new Error("Git is not installed. Please install it from https://git-scm.com/");
  }
}

async function checkGitHubCliInstalled(): Promise<void> {
  try {
    await execFromRoot("gh --version", { quiet: true });
  } catch {
    throw new Error("GitHub CLI is not installed. Please install it from https://cli.github.com/");
  }
}

async function checkGitRepoClean(): Promise<void> {
  try {
    await execFromRoot("git status --porcelain --untracked-files=all", { quiet: true });
  } catch {
    throw new Error("Git repository is not clean. Please commit or stash your changes before releasing a new version.");
  }
}

function getVersionType(version: string): VersionType {
  switch (version) {
    case VersionType.Major:
    case VersionType.Minor:
    case VersionType.Patch:
      return version as VersionType;

    default:
      if (/^\d+\.\d+\.\d+(-[\w\d.-]+)?$/.test(version)) {
        return VersionType.Manual;
      }
      throw new Error("Invalid version format. Please use 'major', 'minor', 'patch', or 'x.y.z[-suffix]' format.");
  }
}
