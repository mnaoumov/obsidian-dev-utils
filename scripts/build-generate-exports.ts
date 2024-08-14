import {
  readdir,
  readFile,
  writeFile
} from "node:fs/promises";
import { join } from "node:path/posix";

interface NpmPackage {
  exports: Record<string, Export>;
}

interface Export {
  import: string;
  types: string;
}

const npmPackage = JSON.parse(await readFile("./package.json", "utf8")) as NpmPackage;

const libDirs = ["."];

for (const dirent of await readdir("./dist/lib", { withFileTypes: true, recursive: true })) {
  if (!dirent.isDirectory()) {
    continue;
  }

  const path = join(dirent.parentPath.replace(/\\/g, "/"), dirent.name).replace("dist/lib/", "./");
  libDirs.push(path);
}

npmPackage.exports = {};
for (const libDir of libDirs) {
  const dir = libDir === "." ? "./dist/lib" : `./dist/lib/${libDir.slice(2)}`;
  npmPackage.exports[libDir] = {
    import: `${dir}/index.cjs`,
    types: `${dir}/index.d.ts`
  };
  npmPackage.exports[`${libDir}/*`] = {
    import: `${dir}/*.cjs`,
    types: `${dir}/*.d.ts`
  };
}

await writeFile("./package.json", JSON.stringify(npmPackage, null, 2) + "\n", "utf8");
