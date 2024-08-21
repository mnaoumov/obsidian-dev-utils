/** Core implementation of the query language evaluation engine. */
import type { Literal } from "../data-model/value.d.ts";
import type { Result } from "../api/result.d.ts";
import type { BinaryOpHandler } from "./binaryop.d.ts";
import type { Field } from "./field.d.ts";
import type { FunctionImpl } from "./functions.d.ts";
import type { QuerySettings } from "../settings.d.ts";
/** Handles link resolution and normalization inside of a context. */
export interface LinkHandler {
    /** Resolve a link to the metadata it contains. */
    resolve(path: string): Record<string, Literal> | null;
    /**
     * Normalize a link to it's fully-qualified path for comparison purposes.
     * If the path does not exist, returns it unchanged.
     */
    normalize(path: string): string;
    /** Return true if the given path actually exists, false otherwise. */
    exists(path: string): boolean;
}
/**
 * Evaluation context that expressions can be evaluated in. Includes global state, as well as available functions and a handler
 * for binary operators.
 */
export declare class Context {
    linkHandler: LinkHandler;
    settings: QuerySettings;
    globals: Record<string, Literal>;
    binaryOps: BinaryOpHandler;
    functions: Record<string, FunctionImpl>;
    /**
     * Create a new context with the given namespace of globals, as well as optionally with custom binary operator, function,
     * and link handlers.
     */
    constructor(linkHandler: LinkHandler, settings: QuerySettings, globals?: Record<string, Literal>, binaryOps?: BinaryOpHandler, functions?: Record<string, FunctionImpl>);
    /** Set a global value in this context. */
    set(name: string, value: Literal): Context;
    /** Get the value of a global variable by name. Returns null if not present. */
    get(name: string): Literal;
    /** Try to evaluate an arbitrary field in this context, raising an exception on failure. */
    tryEvaluate(field: Field, data?: Record<string, Literal>): Literal;
    /** Evaluate an arbitrary field in this context. */
    evaluate(field: Field, data?: Record<string, Literal>): Result<Literal, string>;
}
