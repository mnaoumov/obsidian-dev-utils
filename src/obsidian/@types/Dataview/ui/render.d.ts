import { App, Component } from "obsidian";
import { QuerySettings } from "../settings.js";
import { Literal } from "../data-model/value.js";
/** Render simple fields compactly, removing wrapping content like paragraph and span. */
export declare function renderCompactMarkdown(app: App, markdown: string, container: HTMLElement, sourcePath: string, component: Component, isInlineFieldLivePreview?: boolean): Promise<void>;
/** Render a pre block with an error in it; returns the element to allow for dynamic updating. */
export declare function renderErrorPre(container: HTMLElement, error: string): HTMLElement;
/** Render a static codeblock. */
export declare function renderCodeBlock(container: HTMLElement, source: string, language?: string): HTMLElement;
export type ValueRenderContext = "root" | "list";
/** Prettily render a value into a container with the given settings. */
export declare function renderValue(app: App, field: Literal, container: HTMLElement, originFile: string, component: Component, settings: QuerySettings, expandList?: boolean, context?: ValueRenderContext, depth?: number, isInlineFieldLivePreview?: boolean): Promise<void>;
