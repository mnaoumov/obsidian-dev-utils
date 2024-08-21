/** The general, externally accessible plugin API (available at `app.plugins.plugins.dataview.api` or as global `DataviewAPI`). */
import { App, Component, MarkdownPostProcessorContext } from "obsidian";
import { FullIndex } from "../data-index/index.js";
import { DataObject, Grouping, Link, Literal, Values, Widgets } from "../data-model/value.js";
import { DataArray } from "./data-array.js";
import { BoundFunctionImpl } from "../expression/functions.js";
import { Context } from "../expression/context.js";
import { IdentifierMeaning } from "../query/engine.js";
import { DateTime, Duration } from "luxon";
import * as Luxon from "luxon";
import { CompareOperator } from "compare-versions";
import { DataviewSettings, ExportSettings } from "../settings.js";
import { SListItem } from "../data-model/serialized/markdown.js";
import { Result } from "../api/result.js";
import { Query } from "../query/query.js";
/** Asynchronous API calls related to file / system IO. */
export declare class DataviewIOApi {
    api: DataviewApi;
    constructor(api: DataviewApi);
    /** Load the contents of a CSV asynchronously, returning a data array of rows (or undefined if it does not exist). */
    csv(path: Link | string, originFile?: string): Promise<DataArray<DataObject> | undefined>;
    /** Asynchronously load the contents of any link or path in an Obsidian vault. */
    load(path: Link | string, originFile?: string): Promise<string | undefined>;
    /** Normalize a link or path relative to an optional origin file. Returns a textual fully-qualified-path. */
    normalize(path: Link | string, originFile?: string): string;
}
/** Global API for accessing the Dataview API, executing dataview queries, and  */
export declare class DataviewApi {
    app: App;
    index: FullIndex;
    settings: DataviewSettings;
    private verNum;
    /** Evaluation context which expressions can be evaluated in. */
    evaluationContext: Context;
    /** IO API which supports asynchronous loading of data directly. */
    io: DataviewIOApi;
    /** Dataview functions which can be called from DataviewJS. */
    func: Record<string, BoundFunctionImpl>;
    /** Value utility functions for comparisons and type-checking. */
    value: typeof Values;
    /** Widget utility functions for creating built-in widgets. */
    widget: typeof Widgets;
    /** Re-exporting of luxon for people who can't easily require it. Sorry! */
    luxon: typeof Luxon;
    constructor(app: App, index: FullIndex, settings: DataviewSettings, verNum: string);
    /** Utilities to check the current Dataview version and compare it to SemVer version ranges. */
    version: {
        current: string;
        compare: (op: CompareOperator, ver: string) => boolean;
        satisfies: (range: string) => boolean;
    };
    /** Return an array of paths (as strings) corresponding to pages which match the query. */
    pagePaths(query?: string, originFile?: string): DataArray<string>;
    /** Map a page path to the actual data contained within that page. */
    page(path: string | Link, originFile?: string): Record<string, Literal> | undefined;
    /** Return an array of page objects corresponding to pages which match the source query. */
    pages(query?: string, originFile?: string): DataArray<Record<string, Literal>>;
    /** Remaps important metadata to add data arrays.  */
    private _addDataArrays;
    /**
     * Convert an input element or array into a Dataview data-array. If the input is already a data array,
     * it is returned unchanged.
     */
    array(raw: unknown): DataArray<any>;
    /** Return true if the given value is a javascript array OR a dataview data array. */
    isArray(raw: unknown): raw is DataArray<any> | Array<any>;
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
    duration(str: string | Duration): Duration | null;
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
    /**
     * Execute an arbitrary Dataview query, returning a query result which:
     *
     * 1. Indicates the type of query,
     * 2. Includes the raw AST of the parsed query.
     * 3. Includes the output in the form relevant to that query type.
     *
     * List queries will return a list of objects ({ id, value }); table queries return a header array
     * and a 2D array of values; and task arrays return a Grouping<Task> type which allows for recursive
     * task nesting.
     */
    query(source: string | Query, originFile?: string, settings?: QueryApiSettings): Promise<Result<QueryResult, string>>;
    /** Error-throwing version of {@link query}. */
    tryQuery(source: string, originFile?: string, settings?: QueryApiSettings): Promise<QueryResult>;
    /** Execute an arbitrary dataview query, returning the results in well-formatted markdown. */
    queryMarkdown(source: string | Query, originFile?: string, settings?: Partial<QueryApiSettings & ExportSettings>): Promise<Result<string, string>>;
    /** Error-throwing version of {@link queryMarkdown}. */
    tryQueryMarkdown(source: string | Query, originFile?: string, settings?: Partial<QueryApiSettings & ExportSettings>): Promise<string>;
    /**
     * Evaluate a dataview expression (like '2 + 2' or 'link("hello")'), returning the evaluated result.
     * This takes an optional second argument which provides definitions for variables, such as:
     *
     * ```
     * dv.evaluate("x + 6", { x: 2 }) = 8
     * dv.evaluate('link(target)', { target: "Okay" }) = [[Okay]]
     * ```
     *
     * This method returns a Result type instead of throwing an error; you can check the result of the
     * execution via `result.successful` and obtain `result.value` or `result.error` accordingly. If
     * you'd rather this method throw on an error, use `dv.tryEvaluate`.
     */
    evaluate(expression: string, context?: DataObject, originFile?: string): Result<Literal, string>;
    /** Error-throwing version of `dv.evaluate`. */
    tryEvaluate(expression: string, context?: DataObject, originFile?: string): Literal;
    /** Evaluate an expression in the context of the given file. */
    evaluateInline(expression: string, origin: string): Result<Literal, string>;
    /**
     * Execute the given query, rendering results into the given container using the components lifecycle.
     * Your component should be a *real* component which calls onload() on it's child components at some point,
     * or a MarkdownPostProcessorContext!
     *
     * Note that views made in this way are live updating and will automatically clean themselves up when
     * the component is unloaded or the container is removed.
     */
    execute(source: string, container: HTMLElement, component: Component | MarkdownPostProcessorContext, filePath: string): Promise<void>;
    /**
     * Execute the given DataviewJS query, rendering results into the given container using the components lifecycle.
     * See {@link execute} for general rendering semantics.
     */
    executeJs(code: string, container: HTMLElement, component: Component | MarkdownPostProcessorContext, filePath: string): Promise<void>;
    /** Render a dataview list of the given values. */
    list(values: any[] | DataArray<any> | undefined, container: HTMLElement, component: Component, filePath: string): Promise<void>;
    /** Render a dataview table with the given headers, and the 2D array of values. */
    table(headers: string[], values: any[][] | DataArray<any> | undefined, container: HTMLElement, component: Component, filePath: string): Promise<void>;
    /** Render a dataview task view with the given tasks. */
    taskList(tasks: Grouping<SListItem>, groupByFile: boolean | undefined, container: HTMLElement, component: Component, filePath?: string): Promise<void>;
    /** Render an arbitrary value into a container. */
    renderValue(value: any, container: HTMLElement, component: Component, filePath: string, inline?: boolean): Promise<void>;
    /** Render data to a markdown table. */
    markdownTable(headers: string[] | undefined, values: any[][] | DataArray<any> | undefined, settings?: Partial<ExportSettings>): string;
    /** Render data to a markdown list. */
    markdownList(values: any[] | DataArray<any> | undefined, settings?: Partial<ExportSettings>): string;
    /** Render tasks or list items to a markdown task list. */
    markdownTaskList(values: Grouping<SListItem>, settings?: Partial<ExportSettings>): string;
}
/** The result of executing a table query. */
export type TableResult = {
    type: "table";
    headers: string[];
    values: Literal[][];
    idMeaning: IdentifierMeaning;
};
/** The result of executing a list query. */
export type ListResult = {
    type: "list";
    values: Literal[];
    primaryMeaning: IdentifierMeaning;
};
/** The result of executing a task query. */
export type TaskResult = {
    type: "task";
    values: Grouping<SListItem>;
};
/** The result of executing a calendar query. */
export type CalendarResult = {
    type: "calendar";
    values: {
        date: DateTime;
        link: Link;
        value?: Literal[];
    }[];
};
/** The result of executing a query of some sort. */
export type QueryResult = TableResult | ListResult | TaskResult | CalendarResult;
/** Settings when querying the dataview API. */
export type QueryApiSettings = {
    /** If present, then this forces queries to include/exclude the implicit id field (such as with `WITHOUT ID`). */
    forceId?: boolean;
};
/** Determines if source-path has a `?no-dataview` annotation that disables dataview. */
export declare function isDataviewDisabled(sourcePath: string): boolean;
