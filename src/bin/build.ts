import {
  cp,
  rm
} from "node:fs/promises";
import { join } from "../Path.ts";
import { readdirPosix } from "../Fs.ts";
import { trimStart } from "../String.ts";
import { ObsidianDevUtilsRepoPaths } from "./esbuild/ObsidianDevUtilsRepoPaths.ts";

export async function buildStatic(): Promise<void> {
  for (const dirent of await readdirPosix(ObsidianDevUtilsRepoPaths.Static, { withFileTypes: true, recursive: true })) {
    if (!dirent.isFile()) {
      continue;
    }

    const path = trimStart(join(dirent.parentPath, dirent.name), ObsidianDevUtilsRepoPaths.Static + "/");
    await cp(join(ObsidianDevUtilsRepoPaths.Static, path), join(ObsidianDevUtilsRepoPaths.Dist, path));
  }
}

export async function buildClean(): Promise<void> {
  await rm(ObsidianDevUtilsRepoPaths.Dist, { recursive: true, force: true });
}
