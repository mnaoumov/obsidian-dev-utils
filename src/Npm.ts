import type { MaybePromise } from "./Async.ts";
import {
  editJson,
  readJson,
  writeJson
} from "./JSON.ts";
import { ObsidianPluginRepoPaths } from "./obsidian/Plugin/ObsidianPluginRepoPaths.ts";
import { resolvePathFromRoot } from "./Root.ts";

export interface NpmPackage {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  exports?: Record<string, Export>;
  name: string;
  version: string;
}

interface Export {
  default: string;
  types: string;
}

export async function readNpmPackage(cwd?: string): Promise<NpmPackage> {
  return await readJson<NpmPackage>(getPackageJsonPath(cwd));
}

export async function writeNpmPackage(npmPackage: NpmPackage, cwd?: string): Promise<void> {
  await writeJson(getPackageJsonPath(cwd), npmPackage);
}

export async function editNpmPackage(editFn: (npmPackage: NpmPackage) => MaybePromise<void>, cwd?: string): Promise<void> {
  await editJson<NpmPackage>(getPackageJsonPath(cwd), editFn);
}

export function getPackageJsonPath(cwd?: string): string {
  return resolvePathFromRoot(ObsidianPluginRepoPaths.PackageJson, cwd);
}
