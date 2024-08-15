import {
  readFile,
  writeFile
} from "node:fs/promises";
import { join } from "node:path/posix";
import { readdirPosix } from "../src/Fs.ts";
import { trimStart } from "../src/String.ts";

interface NpmPackage {
  exports: Record<string, Export>;
}

interface Export {
  default: string;
  types: string;
}

const npmPackage = JSON.parse(await readFile("./package.json", "utf8")) as NpmPackage;

const libDirs = ["."];

for (const dirent of await readdirPosix("./dist/lib", { withFileTypes: true, recursive: true })) {
  if (!dirent.isDirectory()) {
    continue;
  }

  const path = join(dirent.parentPath, dirent.name).replace("dist/lib/", "./");
  libDirs.push(path);
}

npmPackage.exports = {};
for (const libDir of libDirs) {
  const dir = libDir === "." ? "./dist/lib" : `./dist/lib/${trimStart(libDir, "./", true)}`;
  npmPackage.exports[libDir] = {
    default: `${dir}/index.cjs`,
    types: `${dir}/index.d.ts`
  };
  npmPackage.exports[`${libDir}/*`] = {
    default: `${dir}/*.cjs`,
    types: `${dir}/*.d.ts`
  };
}

await writeFile("./package.json", JSON.stringify(npmPackage, null, 2) + "\n", "utf8");
