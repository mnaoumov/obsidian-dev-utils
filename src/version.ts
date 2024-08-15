import { TaskResult } from "./TaskResult.ts";
import { execFromRoot } from "./Root.ts";
import { spellcheck } from "./spellcheck.ts";
import { lint } from "./ESLint/ESLint.ts";
import {
  BuildMode,
  buildPlugin
} from "./PluginBuilder.ts";
import {
  editNpmPackage,
  readNpmPackage
} from "./Npm.ts";
import { editJson } from "./JSON.ts";

enum VersionType {
  Major = "major",
  Minor = "minor",
  Patch = "patch",
  Beta = "beta",
  Manual = "manual",
  Invalid = "invalid"
}

type Manifest = {
  minAppVersion: string;
  version: string;
};

type ObsidianReleasesJson = {
  name: string;
};

export async function updateVersion(version: string): Promise<TaskResult | void> {
  return await TaskResult.chain([
    (): void => validateVersion(version),
    (): Promise<void> => checkGitInstalled(),
    (): Promise<void> => checkGitRepoClean(),
    (): Promise<void> => checkGitHubCliInstalled(),
    (): Promise<TaskResult> => spellcheck(),
    (): Promise<TaskResult> => lint(),
    (): Promise<TaskResult> => buildPlugin({ mode: BuildMode.Production }),
    (): Promise<void> => updateVersionInFiles(version),
  ]);
}

function validateVersion(version: string): void {
  if (getVersionType(version) === VersionType.Invalid) {
    throw new Error("Invalid version format. Please use 'major', 'minor', 'patch', or 'x.y.z[-suffix]' format.");
  }
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
  const versionType = version as VersionType;
  switch (versionType) {
    case VersionType.Major:
    case VersionType.Minor:
    case VersionType.Patch:
    case VersionType.Beta:
      return versionType;

    default:
      if (/^\d+\.\d+\.\d+(-[\w\d.-]+)?$/.test(version)) {
        return VersionType.Manual;
      }

      return VersionType.Invalid;
  }
}

async function updateVersionInFiles(version: string): Promise<void> {
  const versionType = getVersionType(version);
  const newVersion = versionType === VersionType.Manual ? version : await getNewVersion(versionType);
  await editNpmPackage((npmPackage) => {
    npmPackage.version = newVersion;
  });

  const latestObsidianVersion = await getLatestObsidianVersion();

  await editJson<Manifest>("manifest.json", (manifest) => {
    manifest.minAppVersion = latestObsidianVersion;
    manifest.version = newVersion;
  });

  await editJson<Record<string, string>>("versions.json", (versions) => {
    versions[newVersion] = latestObsidianVersion;
  });
}

async function getNewVersion(versionType: VersionType): Promise<string> {
  const npmPackage = await readNpmPackage();
  const currentVersion = npmPackage.version;

  const match = currentVersion.match(/^(\d+)\.(\d+)\.(\d+)(-beta.(\d+))?/);
  if (!match) {
    throw new Error(`Invalid current version format: ${currentVersion}`);
  }

  let major = Number(match[1]);
  let minor = Number(match[2]);
  let patch = Number(match[3]);
  let beta = match[5] ? Number(match[5]) : 0;

  switch (versionType) {
    case VersionType.Major:
      major++;
      minor = 0;
      patch = 0;
      beta = 0;
      break;
    case VersionType.Minor:
      minor++;
      patch = 0;
      beta = 0;
      break;
    case VersionType.Patch:
      patch++;
      beta = 0;
      break;
    case VersionType.Beta:
      beta++;
      break;
  }

  return `${major}.${minor}.${patch}${beta > 0 ? `-beta.${beta}` : ""}`;
}

async function getLatestObsidianVersion(): Promise<string> {
  const response = await fetch("https://api.github.com/repos/obsidianmd/obsidian-releases/releases/latest");
  const obsidianReleasesJson = await response.json() as ObsidianReleasesJson;
  return obsidianReleasesJson.name;
}
