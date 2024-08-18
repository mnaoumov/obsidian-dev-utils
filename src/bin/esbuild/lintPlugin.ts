/**
 * @fileoverview
 * This module defines an esbuild plugin that runs ESLint on the codebase after each build.
 * The plugin is particularly useful during development to ensure code quality is maintained
 * by automatically linting the code whenever a build is completed.
 */

import type { Plugin } from "esbuild";
import { lint } from "../ESLint/ESLint.ts";

/**
 * Creates an esbuild plugin that runs ESLint on the codebase after each build.
 *
 * @param isProductionBuild - A boolean indicating whether the build is a production build. The linting process is skipped in production builds.
 * @returns An esbuild `Plugin` object that lints the code.
 */
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
