import {
  cp,
  readdir
} from "node:fs/promises";
import { join } from "node:path/posix";

for (const dirent of await readdir("./static", { withFileTypes: true, recursive: true })) {
  if (!dirent.isFile()) {
    continue;
  }

  const path = join(dirent.parentPath.replace(/\\/g, "/"), dirent.name).slice("static/".length);
  await cp(join("static", path), join("dist", path));
}
