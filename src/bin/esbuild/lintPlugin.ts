import type { Plugin } from "esbuild";
import { lint } from "../ESLint/ESLint.ts";

export function lintPlugin(isProductionBuild: boolean): Plugin {
  return {
    name: "lint",
    setup(build): void {
      build.onEnd(async () => {
        if (isProductionBuild) {
          return;
        }
        console.log("[watch] lint started");
        await lint();
        console.log("[watch] lint finished");
      });
    },
  };
}
