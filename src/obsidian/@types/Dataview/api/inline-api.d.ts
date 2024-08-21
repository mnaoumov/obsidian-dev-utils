/** Fancy wrappers for the JavaScript API, used both by external plugins AND by the dataview javascript view. */
import type { App, Component } from "obsidian";
import type { FullIndex } from "../data-index/index.d.ts";
import type { DataviewApi, DataviewIOApi, QueryApiSettings, QueryResult } from "../api/plugin-api.d.ts";
import type { DataviewSettings, ExportSettings } from "../settings.d.ts";
import type { DataObject, Grouping, Link, Literal, Values, Widgets } from "../data-model/value.d.ts";
import type { BoundFunctionImpl } from "../expression/functions.d.ts";
import type { Context } from "../expression/context.d.ts";
import type { DateTime, Duration } from "luxon";
import * as Luxon from "luxon";
import type { DataArray } from "./data-array.d.ts";
import type { SListItem } from "../data-model/serialized/markdown.d.ts";
import type { Result } from "../api/result.d.ts";
/** Asynchronous API calls related to file / system IO. */
export declare class DataviewInlineIOApi {
    api: DataviewIOApi;
    currentFile: string;
    constructor(api: DataviewIOApi, currentFile: string);
    /** Load the contents of a CSV asynchronously, returning a data array of rows (or undefined if it does not exist). */
    csv(path: string, originFile?: string): Promise<DataArray<DataObject> | undefined>;
    /** Asynchronously load the contents of any link or path in an Obsidian vault. */
    load(path: Link | string, originFile?: string): Promise<string | undefined>;
    /** Normalize a link or path relative to an optional origin file. Returns a textual fully-qualified-path. */
    normalize(path: Link | string, originFile?: string): string;
}
export declare class DataviewInlineApi {
    /**
     * The raw dataview indices, which track file <-> metadata relations. Use these if the intuitive API does not support
     * your use case.
     */
    index: FullIndex;
    /** The component that handles the lifetime of this view. Use it if you are adding custom event handlers/components. */
    component: Component;
    /** The path to the current file this script is running in. */
    currentFilePath: string;
    /**
     * The container which holds the output of this view. You can directly append fields to this, if you wish, though
     * the rendering API is likely to be easier for straight-forward purposes.
     */
    container: HTMLElement;
    /** Directly access the Obsidian app object, such as for reaching out to other plugins. */
    app: App;
    /** The general plugin API which much of this inline API delegates to. */
    api: DataviewApi;
    /** Settings which determine defaults, incl. many rendering options. */
    settings: DataviewSettings;
    /** Evaluation context which expressions can be evaluated in. */
    evaluationContext: Context;
    /** Value utilities which allow for type-checking and comparisons. */
    value: typeof Values;
    /** Widget utility functions for creating built-in widgets. */
    widget: typeof Widgets;
    /** IO utilities which are largely asynchronous. */
    io: DataviewInlineIOApi;
    /** Re-exporting of luxon for people who can't easily require it. Sorry! */
    luxon: typeof Luxon;
    /** Dataview functions which can be called from DataviewJS. */
    func: Record<string, BoundFunctionImpl>;
    constructor(api: DataviewApi, component: Component, container: HTMLElement, currentFilePath: string);
    /** Return an array of paths (as strings) corresponding to pages which match the query. */
    pagePaths(query?: string): DataArray<string>;
    /** Map a page path to the actual data contained within that page. */
    page(path: string | Link): DataObject | undefined;
    /** Return an array of page objects corresponding to pages which match the query. */
    pages(query?: string): DataArray<any>;
    /** Return the information about the current page. */
    current(): Record<string, any> | undefined;
    /** Execute a Dataview query, returning the results in programmatic form. */
    query(source: string, originFile?: string, settings?: QueryApiSettings): Promise<Result<QueryResult, string>>;
    /** Error-throwing version of {@link query}. */
    tryQuery(source: string, originFile?: string, settings?: QueryApiSettings): Promise<QueryResult>;
    /** Execute a Dataview query, returning the results in Markdown. */
    queryMarkdown(source: string, originFile?: string, settings?: QueryApiSettings): Promise<Result<string, string>>;
    /** Error-throwing version of {@link queryMarkdown}. */
    tryQueryMarkdown(source: string, originFile?: string, settings?: QueryApiSettings): Promise<string>;
    /**
     * Evaluate a dataview expression (like '2 + 2' or 'link("hello")'), returning the evaluated result.
     * This takes an optional second argument which provides definitions for variables, such as:
     *
     * ```
     * dv.evaluate("x + 6", { x: 2 }) = 8
     * dv.evaluate('link(target)', { target: "Okay" }) = [[Okay]]
     * ```
     *
     * Note that `this` is implicitly available and refers to the current file.
     *
     * This method returns a Result type instead of throwing an error; you can check the result of the
     * execution via `result.successful` and obtain `result.value` or `result.error` accordingly. If
     * you'd rather this method throw on an error, use `dv.tryEvaluate`.
     */
    evaluate(expression: string, context?: DataObject): Result<Literal, string>;
    /** Error-throwing version of `dv.evaluate`. */
    tryEvaluate(expression: string, context?: DataObject): Literal;
    /** Execute a Dataview query and embed it into the current view. */
    execute(source: string): Promise<void>;
    /** Execute a DataviewJS query and embed it into the current view. */
    executeJs(code: string): Promise<void>;
    /**
     * Convert an input element or array into a Dataview data-array. If the input is already a data array,
     * it is returned unchanged.
     */
    array(raw: any): DataArray<any>;
    /** Return true if the given value is a javascript array OR a dataview data array. */
    isArray(raw: any): raw is DataArray<any> | Array<any>;
    /** Return true if the given value is a dataview data array; this returns FALSE for plain JS arrays. */
    isDataArray(raw: unknown): raw is DataArray<any>;
    /** Create a dataview file link to the given path. */
    fileLink(path: string, embed?: boolean, display?: string): Link;
    /** Create a dataview section link to the given path. */
    sectionLink(path: string, section: string, embed?: boolean, display?: string): Link;
    /** Create a dataview block link to the given path. */
    blockLink(path: string, blockId: string, embed?: boolean, display?: string): Link;
    /** Attempt to extract a date from a string, link or date. */
    date(pathlike: string | Link | DateTime): DateTime | null;
    /** Attempt to extract a duration from a string or duration. */
    duration(dur: string | Duration): Duration | null;
    /** Parse a raw textual value into a complex Dataview type, if possible. */
    parse(value: string): Literal;
    /** Convert a basic JS type into a Dataview type by parsing dates, links, durations, and so on. */
    literal(value: any): Literal;
    /** Deep clone the given literal, returning a new literal which is independent of the original. */
    clone(value: Literal): Literal;
    /**
     * Compare two arbitrary JavaScript values using Dataview's default comparison rules. Returns a negative value if
     * a < b, 0 if a = b, and a positive value if a > b.
     */
    compare(a: any, b: any): number;
    /** Return true if the two given JavaScript values are equal using Dataview's default comparison rules. */
    equal(a: any, b: any): boolean;
    /** Render an HTML element, containing arbitrary text. */
    el<K extends keyof HTMLElementTagNameMap>(el: K, text: any, { container, ...options }?: DomElementInfo & {
        container?: HTMLElement;
    }): HTMLElementTagNameMap[K];
    /** Render an HTML header; the level can be anything from 1 - 6. */
    header(level: number, text: any, options?: DomElementInfo): HTMLHeadingElement;
    /** Render an HTML paragraph, containing arbitrary text. */
    paragraph(text: any, options?: DomElementInfo): HTMLParagraphElement;
    /** Render an inline span, containing arbitrary text. */
    span(text: any, options?: DomElementInfo): HTMLSpanElement;
    /**
     * Render HTML from the output of a template "view" saved as a file in the vault.
     * Takes a filename and arbitrary input data.
     */
    view(viewName: string, input: any): Promise<void>;
    /** Render a dataview list of the given values. */
    list(values?: any[] | DataArray<any>): Promise<void>;
    /** Render a dataview table with the given headers, and the 2D array of values. */
    table(headers: string[], values?: any[][] | DataArray<any>): Promise<void>;
    /** Render a dataview task view with the given tasks. */
    taskList(tasks: Grouping<SListItem>, groupByFile?: boolean): Promise<void>;
    /** Render a table directly to markdown, returning the markdown. */
    markdownTable(headers: string[], values?: any[][] | DataArray<any>, settings?: Partial<ExportSettings>): string;
    /** Render a list directly to markdown, returning the markdown. */
    markdownList(values?: any[] | DataArray<any> | undefined, settings?: Partial<ExportSettings>): string;
    /** Render at ask list directly to markdown, returning the markdown. */
    markdownTaskList(values: Grouping<SListItem>, settings?: Partial<ExportSettings>): string;
}
/**
 * Evaluate a script where 'this' for the script is set to the given context. Allows you to define global variables.
 */
export declare function evalInContext(script: string, context: any): any;
/**
 * Evaluate a script possibly asynchronously, if the script contains `async/await` blocks.
 */
export declare function asyncEvalInContext(script: string, context: any): Promise<any>;
