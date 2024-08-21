/**
 * Takes a full query and a set of indices, and (hopefully quickly) returns all relevant files.
 */
import type { FullIndex } from "../data-index/index.d.ts";
import type { Context, LinkHandler } from "../expression/context.d.ts";
import type { Datarow } from "../data-index/resolver.d.ts";
import type { DataObject, Link, Literal, Grouping } from "../data-model/value.d.ts";
import type { Query, QueryOperation } from "../query/query.d.ts";
import type { Result } from "../api/result.d.ts";
import type { Field } from "../expression/field.d.ts";
import type { QuerySettings } from "../settings.d.ts";
import type { DateTime } from "luxon";
import type { SListItem } from "../data-model/serialized/markdown.d.ts";
/** Operation diagnostics collected during the execution of each query step. */
export interface OperationDiagnostics {
    timeMs: number;
    incomingRows: number;
    outgoingRows: number;
    errors: {
        index: number;
        message: string;
    }[];
}
/** The meaning of the 'id' field for a data row - i.e., where it came from. */
export type IdentifierMeaning = {
    type: "group";
    name: string;
    on: IdentifierMeaning;
} | {
    type: "path";
};
/** A data row over an object. */
export type Pagerow = Datarow<DataObject>;
/** An error during execution. */
export type ExecutionError = {
    index: number;
    message: string;
};
/** The result of executing query operations over incoming data rows; includes timing and error information. */
export interface CoreExecution {
    data: Pagerow[];
    idMeaning: IdentifierMeaning;
    timeMs: number;
    ops: QueryOperation[];
    diagnostics: OperationDiagnostics[];
}
/** Shared execution code which just takes in arbitrary data, runs operations over it, and returns it + per-row errors. */
export declare function executeCore(rows: Pagerow[], context: Context, ops: QueryOperation[]): Result<CoreExecution, string>;
/** Expanded version of executeCore which adds an additional "extraction" step to the pipeline. */
export declare function executeCoreExtract(rows: Pagerow[], context: Context, ops: QueryOperation[], fields: Record<string, Field>): Result<CoreExecution, string>;
export interface ListExecution {
    core: CoreExecution;
    data: Literal[];
    primaryMeaning: IdentifierMeaning;
}
/** Execute a list-based query, returning the final results. */
export declare function executeList(query: Query, index: FullIndex, origin: string, settings: QuerySettings): Promise<Result<ListExecution, string>>;
/** Result of executing a table query. */
export interface TableExecution {
    core: CoreExecution;
    names: string[];
    data: Literal[][];
    idMeaning: IdentifierMeaning;
}
/** Execute a table query. */
export declare function executeTable(query: Query, index: FullIndex, origin: string, settings: QuerySettings): Promise<Result<TableExecution, string>>;
/** The result of executing a task query. */
export interface TaskExecution {
    core: CoreExecution;
    tasks: Grouping<SListItem>;
}
/** Execute a task query, returning all matching tasks. */
export declare function executeTask(query: Query, origin: string, index: FullIndex, settings: QuerySettings): Promise<Result<TaskExecution, string>>;
/** Execute a single field inline a file, returning the evaluated result. */
export declare function executeInline(field: Field, origin: string, index: FullIndex, settings: QuerySettings): Result<Literal, string>;
/** The default link resolver used when creating contexts. */
export declare function defaultLinkHandler(index: FullIndex, origin: string): LinkHandler;
/** Execute a calendar-based query, returning the final results. */
export declare function executeCalendar(query: Query, index: FullIndex, origin: string, settings: QuerySettings): Promise<Result<CalendarExecution, string>>;
export interface CalendarExecution {
    core: CoreExecution;
    data: {
        date: DateTime;
        link: Link;
        value?: Literal[];
    }[];
}
