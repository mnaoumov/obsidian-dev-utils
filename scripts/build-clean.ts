import {
  readdir,
  rm
} from "node:fs/promises";
import {
  basename,
  join
} from "node:path";

await rm("dist", { recursive: true, force: true });

for (const file of await readdir("src", { recursive: true })) {
  if (basename(file) !== "index.ts") {
    continue;
  }

  await rm(join("src", file));
}
