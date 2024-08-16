import type { Plugin } from "esbuild";
import { existsSync } from "node:fs";
import {
  cp,
  mkdir
} from "node:fs/promises";
import { join } from "../../Path.ts";

export function copyToObsidianPluginsFolderPlugin(isProductionBuild: boolean, distDir: string, obsidianConfigDir: string | undefined, pluginName: string): Plugin {
  return {
    name: "copy-to-obsidian-plugins-folder",
    setup(build): void {
      build.onEnd(async () => {
        if (isProductionBuild || !obsidianConfigDir) {
          return;
        }

        const pluginDir = join(obsidianConfigDir, "plugins", pluginName);
        if (!existsSync(pluginDir)) {
          await mkdir(pluginDir);
        }

        await cp(distDir, pluginDir, { recursive: true });
      });
    }
  };
}
