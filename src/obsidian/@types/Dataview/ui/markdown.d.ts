/** Provides core preact / rendering utilities for all view types. */
import { App, MarkdownRenderChild } from "obsidian";
import { h, ComponentChildren } from "preact";
import { Component } from "obsidian";
import { DataviewSettings } from "../settings.js";
import { FullIndex } from "../data-index/index.js";
import { Literal } from "../data-model/value.js";
import React from "preact/compat";
export type MarkdownProps = {
    contents: string;
    sourcePath: string;
};
export type MarkdownContext = {
    component: Component;
};
/** Context need to create dataviews. */
export type DataviewInit = {
    app: App;
    index: FullIndex;
    settings: DataviewSettings;
    container: HTMLElement;
};
/** Shared context for dataview views and objects. */
export type DataviewContexts = DataviewInit & {
    component: Component;
};
export declare const DataviewContext: React.Context<DataviewContexts>;
/** Hacky preact component which wraps Obsidian's markdown renderer into a neat component. */
export declare function RawMarkdown({ content, sourcePath, inline, style, cls, onClick, }: {
    content: string;
    sourcePath: string;
    inline?: boolean;
    style?: string;
    cls?: string;
    onClick?: (e: preact.JSX.TargetedMouseEvent<HTMLElement>) => void;
}): h.JSX.Element;
/** Hacky preact component which wraps Obsidian's markdown renderer into a neat component. */
export declare const Markdown: typeof RawMarkdown;
/** Embeds an HTML element in the react DOM. */
export declare function RawEmbedHtml({ element }: {
    element: HTMLElement;
}): h.JSX.Element;
/** Embeds an HTML element in the react DOM. */
export declare const EmbedHtml: typeof RawEmbedHtml;
/** Intelligently render an arbitrary literal value. */
export declare function RawLit({ value, sourcePath, inline, depth, }: {
    value: Literal | undefined;
    sourcePath: string;
    inline?: boolean;
    depth?: number;
}): h.JSX.Element;
/** Intelligently render an arbitrary literal value. */
export declare const Lit: typeof RawLit;
/** Render a simple nice looking error box in a code style. */
export declare function ErrorPre(props: {
    children: ComponentChildren;
}, {}: {}): h.JSX.Element;
/** Render a pretty centered error message in a box. */
export declare function ErrorMessage({ message }: {
    message: string;
}): h.JSX.Element;
/**
 * Complex convenience hook which calls `compute` every time the index updates, updating the current state.
 */
export declare function useIndexBackedState<T>(container: HTMLElement, app: App, settings: DataviewSettings, index: FullIndex, initial: T, compute: () => Promise<T>): T;
/** A trivial wrapper which allows a react component to live for the duration of a `MarkdownRenderChild`. */
export declare class ReactRenderer extends MarkdownRenderChild {
    init: DataviewInit;
    element: h.JSX.Element;
    constructor(init: DataviewInit, element: h.JSX.Element);
    onload(): void;
    onunload(): void;
}
