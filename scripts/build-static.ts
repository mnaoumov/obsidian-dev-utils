import { cp } from "node:fs/promises";
import { join } from "node:path/posix";
import { readdirPosix } from "../src/Fs.ts";
import { trimStart } from "../src/String.ts";

for (const dirent of await readdirPosix("./static", { withFileTypes: true, recursive: true })) {
  if (!dirent.isFile()) {
    continue;
  }

  const path = join(trimStart(dirent.parentPath, "static/", true), dirent.name);
  await cp(join("static", path), join("dist", path));
}
