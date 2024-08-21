import type { FullIndex } from "../data-index/index.d.ts";
import type { App, MarkdownRenderChild } from "obsidian";
import type { DataviewSettings } from "../settings.d.ts";
/** Generic code for embedded Dataviews. */
export declare abstract class DataviewRefreshableRenderer extends MarkdownRenderChild {
    container: HTMLElement;
    index: FullIndex;
    app: App;
    settings: DataviewSettings;
    private lastReload;
    constructor(container: HTMLElement, index: FullIndex, app: App, settings: DataviewSettings);
    abstract render(): Promise<void>;
    onload(): void;
    maybeRefresh: () => void;
}
