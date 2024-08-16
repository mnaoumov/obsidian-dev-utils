import type { MaybePromise } from "./Async.ts";
import {
  editJson,
  readJson,
  writeJson
} from "./JSON.ts";
import PluginPaths from "./obsidian/Plugin/PluginPaths.ts";

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

export async function readNpmPackage(): Promise<NpmPackage> {
  return await readJson<NpmPackage>(PluginPaths.PackageJson);
}

export async function writeNpmPackage(npmPackage: NpmPackage): Promise<void> {
  await writeJson(PluginPaths.PackageJson, npmPackage);
}

export async function editNpmPackage(editFn: (npmPackage: NpmPackage) => MaybePromise<void>): Promise<void> {
  await editJson<NpmPackage>(PluginPaths.PackageJson, editFn);
}
