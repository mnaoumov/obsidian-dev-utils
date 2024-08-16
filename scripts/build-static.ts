import { cp } from "node:fs/promises";
import { join } from "../src/Path.ts";
import { readdirPosix } from "../src/Fs.ts";
import { trimStart } from "../src/String.ts";
import { wrapCliTask } from "../src/bin/cli.ts";

await wrapCliTask(async () => {
  for (const dirent of await readdirPosix("static", { withFileTypes: true, recursive: true })) {
    if (!dirent.isFile()) {
      continue;
    }

    const path = trimStart(join(dirent.parentPath, dirent.name), "static/");
    await cp(join("static", path), join("dist", path));
  }
});
