import { join } from "node:path/posix";
import { readdirPosix } from "../src/Fs.ts";
import { trimStart } from "../src/String.ts";
import { editNpmPackage } from "../src/Npm.ts";

const libDirs = ["."];

for (const dirent of await readdirPosix("./dist/lib", { withFileTypes: true, recursive: true })) {
  if (!dirent.isDirectory()) {
    continue;
  }

  const path = join(dirent.parentPath, dirent.name).replace("dist/lib/", "./");
  libDirs.push(path);
}

await editNpmPackage((npmPackage) => {
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
});
