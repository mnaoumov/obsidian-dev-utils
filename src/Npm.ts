import { readFile, writeFile } from "node:fs/promises";
import { resolvePathFromRoot } from "./Root.ts";

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
  const packageJsonPath = resolvePathFromRoot(PACKAGE_JSON_FILE_PATH);
  const npmPackage = JSON.parse(await readFile(packageJsonPath, "utf8")) as NpmPackage;
  return npmPackage;
}

export async function writeNpmPackage(npmPackage: NpmPackage): Promise<void> {
  const packageJsonPath = resolvePathFromRoot(PACKAGE_JSON_FILE_PATH);
  await writeFile(packageJsonPath, JSON.stringify(npmPackage, null, 2) + "\n", "utf8");
}
