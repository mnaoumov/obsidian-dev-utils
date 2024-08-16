import {
  rm
} from "node:fs/promises";
import {
  basename,
  join
} from "../src/Path.ts";
import { readdirPosix } from "../src/Fs.ts";
import { SOURCE_DEPENDENCIES_PATH } from "../src/bin/esbuild/Dependency.ts";

await rm("dist", { recursive: true, force: true });

for (const file of await readdirPosix("src", { recursive: true })) {
  if (basename(file) !== "index.ts") {
    continue;
  }

  await rm(join("src", file));
}

await rm(SOURCE_DEPENDENCIES_PATH, { force: true });
