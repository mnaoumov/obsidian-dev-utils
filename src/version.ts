import { TaskResult } from "./TaskResult.ts";
import {
  execFromRoot,
  resolvePathFromRoot
} from "./Root.ts";
import { spellcheck } from "./spellcheck.ts";
import { lint } from "./ESLint/ESLint.ts";
import {
  BuildMode,
  buildPlugin
} from "./esbuild/PluginBuilder.ts";
import {
  editNpmPackage,
  PACKAGE_JSON,
  readNpmPackage
} from "./Npm.ts";
import { editJson } from "./JSON.ts";
import { existsSync } from "node:fs";
import {
  cp,
  readFile,
  writeFile
} from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { readdirPosix } from "./Fs.ts";
import { toCommandLine } from "./cli.ts";
import { join } from "./Path.ts";

enum VersionUpdateType {
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

export const MANIFEST_JSON = "manifest.json";
export const VERSIONS_JSON = "versions.json";
export const CHANGELOG_MD = "CHANGELOG.md";

export async function updateVersion(versionUpdateType: string): Promise<TaskResult | void> {
  return await TaskResult.chain([
    async (): Promise<void> => {
      validate(versionUpdateType);
      await checkGitInstalled();
      await checkGitRepoClean();
      await checkGitHubCliInstalled();
    },
    (): Promise<TaskResult> => spellcheck(),
    (): Promise<TaskResult> => lint(),
    (): Promise<TaskResult> => buildPlugin({ mode: BuildMode.Production }),
    async (): Promise<void> => {
      const newVersion = await getNewVersion(versionUpdateType);
      await updateVersionInFiles(newVersion);
      await updateChangelog(newVersion);
      await addUpdatedFilesToGit(newVersion);
      await addGitTag(newVersion);
      await gitPush();
      await copyUpdatedManifest();
      await publishGitHubRelease(newVersion);
    }
  ]);
}

export function validate(versionUpdateType: string): void {
  if (getVersionUpdateType(versionUpdateType) === VersionUpdateType.Invalid) {
    throw new Error("Invalid version update type. Please use 'major', 'minor', 'patch', or 'x.y.z[-suffix]' format.");
  }
}

export async function checkGitInstalled(): Promise<void> {
  try {
    await execFromRoot("git --version", { quiet: true });
  } catch {
    throw new Error("Git is not installed. Please install it from https://git-scm.com/");
  }
}

export async function checkGitHubCliInstalled(): Promise<void> {
  try {
    await execFromRoot("gh --version", { quiet: true });
  } catch {
    throw new Error("GitHub CLI is not installed. Please install it from https://cli.github.com/");
  }
}

export async function checkGitRepoClean(): Promise<void> {
  try {
    const stdout = await execFromRoot("git status --porcelain --untracked-files=all", { quiet: true });
    if (stdout) {
      throw new Error();
    }
  } catch {
    throw new Error("Git repository is not clean. Please commit or stash your changes before releasing a new version.");
  }
}

export function getVersionUpdateType(versionUpdateType: string): VersionUpdateType {
  const versionUpdateTypeEnum = versionUpdateType as VersionUpdateType;
  switch (versionUpdateTypeEnum) {
    case VersionUpdateType.Major:
    case VersionUpdateType.Minor:
    case VersionUpdateType.Patch:
    case VersionUpdateType.Beta:
      return versionUpdateTypeEnum;

    default:
      if (/^\d+\.\d+\.\d+(-[\w\d.-]+)?$/.test(versionUpdateType)) {
        return VersionUpdateType.Manual;
      }

      return VersionUpdateType.Invalid;
  }
}

export async function updateVersionInFiles(newVersion: string): Promise<void> {
  await editNpmPackage((npmPackage) => {
    npmPackage.version = newVersion;
  });

  const latestObsidianVersion = await getLatestObsidianVersion();

  await editJson<Manifest>(MANIFEST_JSON, (manifest) => {
    manifest.minAppVersion = latestObsidianVersion;
    manifest.version = newVersion;
  });

  await editJson<Record<string, string>>(VERSIONS_JSON, (versions) => {
    versions[newVersion] = latestObsidianVersion;
  });
}

export async function getNewVersion(versionUpdateType: string): Promise<string> {
  const versionType = getVersionUpdateType(versionUpdateType);
  if (versionType === VersionUpdateType.Manual) {
    return versionUpdateType;
  }

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
    case VersionUpdateType.Major:
      major++;
      minor = 0;
      patch = 0;
      beta = 0;
      break;
    case VersionUpdateType.Minor:
      minor++;
      patch = 0;
      beta = 0;
      break;
    case VersionUpdateType.Patch:
      patch++;
      beta = 0;
      break;
    case VersionUpdateType.Beta:
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

export async function updateChangelog(newVersion: string): Promise<void> {
  const changelogPath = resolvePathFromRoot(CHANGELOG_MD);
  let previousChangelogLines: string[];
  if (!existsSync(changelogPath)) {
    previousChangelogLines = [];
  } else {
    const content = await readFile(changelogPath, "utf8");
    previousChangelogLines = content.split("\n").slice(2);
    if (previousChangelogLines.at(-1) === "") {
      previousChangelogLines.pop();
    }
  }

  const lastTag = previousChangelogLines[0]?.replace("## ", "");
  const commitRange = lastTag ? `${lastTag}..HEAD` : "HEAD";
  const commitMessages = (await execFromRoot(`git log ${commitRange} --format=%s --first-parent`, { quiet: true })).split(/\r?\n/);

  let newChangeLog = `# CHANGELOG\n\n## ${newVersion}\n\n`;

  for (const message of commitMessages) {
    newChangeLog += `- ${message}\n`;
  }

  if (previousChangelogLines.length > 0) {
    newChangeLog += "\n";
    for (const line of previousChangelogLines) {
      newChangeLog += `${line}\n`;
    }
  }

  await writeFile(changelogPath, newChangeLog, "utf8");

  await createInterface(process.stdin, process.stdout).question(`Please update the ${CHANGELOG_MD} file. Press Enter when you are done...`);
}

export async function addUpdatedFilesToGit(newVersion: string): Promise<void> {
  const files = [MANIFEST_JSON, PACKAGE_JSON, VERSIONS_JSON, CHANGELOG_MD].filter(file => existsSync(resolvePathFromRoot(file)));
  await execFromRoot(toCommandLine(["git", "add", ...files]), { quiet: true });
  await execFromRoot(`git commit -m ${newVersion}`, { quiet: true });
}

export async function addGitTag(newVersion: string): Promise<void> {
  await execFromRoot(`git tag -a ${newVersion} -m ${newVersion}`, { quiet: true });
}

export async function gitPush(): Promise<void> {
  await execFromRoot("git push --follow-tags", { quiet: true });
}

export async function copyUpdatedManifest(): Promise<void> {
  await cp(resolvePathFromRoot(MANIFEST_JSON), resolvePathFromRoot(join("dist/build", MANIFEST_JSON)), { force: true });
}

export async function getReleaseNotes(newVersion: string): Promise<string> {
  const changelogPath = resolvePathFromRoot(CHANGELOG_MD);
  const content = await readFile(changelogPath, "utf8");
  const newVersionEscaped = newVersion.replaceAll(".", "\\.");
  const match = content.match(new RegExp(`\n## ${newVersionEscaped}\n\n((.|\n)+?)\n\n##`));
  let releaseNotes = match ? match[1] + "\n\n" : "";

  const tags = (await execFromRoot("git tag --sort=-creatordate", { quiet: true })).split(/\r?\n/);
  const previousVersion = tags[1];
  let changesUrl = "";

  const repoUrl = await execFromRoot("gh repo view --json url -q .url", { quiet: true });

  if (previousVersion) {
    changesUrl = `${repoUrl}/compare/${previousVersion}...${newVersion}`;
  } else {
    changesUrl = `${repoUrl}/commits/${newVersion}`;
  }

  releaseNotes += `**Full Changelog**: ${changesUrl}`;
  return releaseNotes;
}

export async function publishGitHubRelease(newVersion: string): Promise<void> {
  const buildDir = resolvePathFromRoot("dist/build");
  const fileNames = await readdirPosix(buildDir);
  const filePaths = fileNames.map(fileName => join(buildDir, fileName));

  await execFromRoot(toCommandLine(["gh", "release", "create", newVersion, ...filePaths, "--title", `v${newVersion}`, "--notes-file", "-"]), {
    quiet: true,
    stdin: await getReleaseNotes(newVersion)
  });
}
