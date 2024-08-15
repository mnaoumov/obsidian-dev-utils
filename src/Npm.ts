import type { MaybePromise } from "./Async.ts";
import {
  editJson,
  readJson,
  writeJson
} from "./JSON.ts";

export interface NpmPackage {
  exports?: Record<string, Export>;
  name: string;
  version: string;
}

interface Export {
  default: string;
  types: string;
}

export const PACKAGE_JSON = "package.json";

export async function readNpmPackage(): Promise<NpmPackage> {
  return await readJson<NpmPackage>(PACKAGE_JSON);
}

export async function writeNpmPackage(npmPackage: NpmPackage): Promise<void> {
  await writeJson(PACKAGE_JSON, npmPackage);
}

export async function editNpmPackage(editFn: (npmPackage: NpmPackage) => MaybePromise<void>): Promise<void> {
  await editJson<NpmPackage>(PACKAGE_JSON, editFn);
}
