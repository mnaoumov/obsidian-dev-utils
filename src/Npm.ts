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
  return await readJson<NpmPackage>(await getPackageJsonPath(cwd));
}

export async function writeNpmPackage(npmPackage: NpmPackage, cwd?: string): Promise<void> {
  await writeJson(await getPackageJsonPath(cwd), npmPackage);
}

export async function editNpmPackage(editFn: (npmPackage: NpmPackage) => MaybePromise<void>, cwd?: string): Promise<void> {
  await editJson<NpmPackage>(await getPackageJsonPath(cwd), editFn);
}

export async function getPackageJsonPath(cwd?: string): Promise<string> {
  return resolvePathFromRoot(ObsidianPluginRepoPaths.PackageJson, cwd);
}
