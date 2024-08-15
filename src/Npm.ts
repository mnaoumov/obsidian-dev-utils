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

const PACKAGE_JSON_FILE_PATH = "./package.json";

export async function readNpmPackage(): Promise<NpmPackage> {
  return await readJson<NpmPackage>(PACKAGE_JSON_FILE_PATH);
}

export async function writeNpmPackage(npmPackage: NpmPackage): Promise<void> {
  await writeJson(PACKAGE_JSON_FILE_PATH, npmPackage);
}

export async function editNpmPackage(editFn: (npmPackage: NpmPackage) => MaybePromise<void>): Promise<void> {
  await editJson<NpmPackage>(PACKAGE_JSON_FILE_PATH, editFn);
}
