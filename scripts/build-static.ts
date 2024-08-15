import { cp } from "node:fs/promises";
import { join } from "node:path/posix";
import { readdirPosix } from "../src/Fs.ts";

for (const dirent of await readdirPosix("./static", { withFileTypes: true, recursive: true })) {
  if (!dirent.isFile()) {
    continue;
  }

  const path = join(dirent.parentPath, dirent.name).slice("static/".length);
  await cp(join("static", path), join("dist", path));
}
