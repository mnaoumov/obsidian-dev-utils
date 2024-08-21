import { Component, MarkdownPostProcessorContext, Plugin } from "obsidian";
import { FullIndex } from "./data-index/index.js";
import { DataviewApi } from "./api/plugin-api.js";
import { DataviewSettings } from "./settings.js";
import { DataviewInlineApi } from "./api/inline-api.js";
export default class DataviewPlugin extends Plugin {
    /** Plugin-wide default settings. */
    settings: DataviewSettings;
    /** The index that stores all dataview data. */
    index: FullIndex;
    /** External-facing plugin API. */
    api: DataviewApi;
    /** CodeMirror 6 extensions that dataview installs. Tracked via array to allow for dynamic updates. */
    private cmExtension;
    onload(): Promise<void>;
    registerDataviewjsCodeHighlighting(): void;
    unregisterDataviewjsCodeHighlighting(): void;
    private debouncedRefresh;
    private updateRefreshSettings;
    onunload(): void;
    /** Register a markdown post processor with the given priority. */
    registerPriorityMarkdownPostProcessor(priority: number, processor: (el: HTMLElement, ctx: MarkdownPostProcessorContext) => Promise<void>): void;
    /** Register a markdown codeblock post processor with the given priority. */
    registerPriorityCodeblockPostProcessor(language: string, priority: number, processor: (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => Promise<void>): void;
    updateEditorExtensions(): void;
    /**
     * Based on the source, generate a dataview view. This works by doing an initial parsing pass, and then adding
     * a long-lived view object to the given component for life-cycle management.
     */
    dataview(source: string, el: HTMLElement, component: Component | MarkdownPostProcessorContext, sourcePath: string): Promise<void>;
    /** Generate a DataviewJS view running the given source in the given element. */
    dataviewjs(source: string, el: HTMLElement, component: Component | MarkdownPostProcessorContext, sourcePath: string): Promise<void>;
    /** Render all dataview inline expressions in the given element. */
    dataviewInline(el: HTMLElement, component: Component | MarkdownPostProcessorContext, sourcePath: string): Promise<void>;
    /** Update plugin settings. */
    updateSettings(settings: Partial<DataviewSettings>): Promise<void>;
    /** @deprecated Call the given callback when the dataview API has initialized. */
    withApi(callback: (api: DataviewApi) => void): void;
    /**
     * Create an API element localized to the given path, with lifecycle management managed by the given component.
     * The API will output results to the given HTML element.
     */
    localApi(path: string, component: Component, el: HTMLElement): DataviewInlineApi;
}
