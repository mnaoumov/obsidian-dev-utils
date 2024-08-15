import type { Plugin } from "esbuild";
import { writeFile } from "node:fs/promises";

export default function renameToCjsPlugin(): Plugin {
  return {
    name: "rename-to-cjs",
    setup(build): void {
      build.onEnd(async (result) => {
        for (const file of result.outputFiles ?? []) {
          if (!file.path.endsWith(".js") || file.path.endsWith(".d.js")) {
            continue;
          }
          const newPath = file.path.replace(/\.js$/, ".cjs");
          await writeFile(newPath, file.text);
        }
      });
    }
  };
}
