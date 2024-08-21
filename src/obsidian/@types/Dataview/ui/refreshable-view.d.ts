import { FullIndex } from "../data-index/index.js";
import { App, MarkdownRenderChild } from "obsidian";
import { DataviewSettings } from "../settings.js";
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
