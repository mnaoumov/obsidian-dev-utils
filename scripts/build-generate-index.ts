import {
  writeFile
} from "node:fs/promises";
import {
  basename,
  extname,
  join
} from "node:path/posix";
import { readdirPosix } from "../src/Fs.ts";

async function main(): Promise<void> {
  await generateIndex("src");
}

async function generateIndex(dir: string): Promise<void> {
  const dirents = await readdirPosix(dir, { withFileTypes: true });
  const lines: string[] = ["/* THIS IS A GENERATED/BUNDLED FILE BY BUILD SCRIPT */", ""];
  for (const dirent of dirents) {
    if (dirent.name === "index.ts" || dirent.name === "@types") {
      continue;
    }
    let sourceFile: string;
    let name: string;
    if (dirent.isDirectory()) {
      await generateIndex(`${dir}/${dirent.name}`);
      sourceFile = `./${dirent.name}/index.ts`;
      name = dirent.name;
    } else {
      const extension = getExtension(dirent.name);
      name = basename(dirent.name, extension);
      sourceFile = `./${dirent.name}`;
    }

    const escapedName = name.replace(/[^a-zA-Z0-9_]/g, "_");

    lines.push(`export * as ${escapedName} from "${sourceFile}";`);
  }

  if (lines.at(-1)) {
    lines.push("");
  }

  await writeFile(join(dir, "index.ts"), lines.join("\n"), "utf-8");
}

function getExtension(file: string): string {
  if (file.endsWith(".d.ts")) {
    return ".d.ts";
  }

  return extname(file);
}

await main();
