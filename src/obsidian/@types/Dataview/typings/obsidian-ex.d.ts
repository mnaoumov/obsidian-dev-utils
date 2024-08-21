import type { DataviewApi } from "../api/plugin-api.d.ts";
import type { Plugin } from "obsidian";

declare module "obsidian" {
    interface MetadataCache {
        trigger(...args: Parameters<MetadataCache["on"]>): void;
        trigger(name: string, ...data: any[]): void;
    }

    interface Workspace {
        /** Sent to rendered dataview components to tell them to possibly refresh */
        on(name: "dataview:refresh-views", callback: () => void, ctx?: any): EventRef;
    }
}

declare global {
    interface Window {
        DataviewAPI?: DataviewApi;
    }
}

declare module "obsidian-typings" {
  interface PluginsPluginsRecord {
    dataview?: Plugin & {
      api: DataviewApi;
    }
  }
}
