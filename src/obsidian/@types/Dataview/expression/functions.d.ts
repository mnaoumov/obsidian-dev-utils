/** Default function implementations for the expression evaluator. */
import { Literal } from "../data-model/value.js";
import { LiteralReprAll, LiteralTypeOrAll } from "./binaryop.js";
import { Context } from "./context.js";
/**
 * A function implementation which takes in a function context and a variable number of arguments. Throws an error if an
 * invalid number/type of arguments are passed.
 */
export type FunctionImpl = (context: Context, ...rest: Literal[]) => Literal;
/** A "bound" function implementation which has already had a function context passed to it. */
export type BoundFunctionImpl = (...args: Literal[]) => Literal;
/** A function variant used in the function builder which holds the argument types. */
interface FunctionVariant {
    args: LiteralTypeOrAll[];
    varargs: boolean;
    /** The implementing function for this specific variant. */
    impl: FunctionImpl;
}
/**
 * Allows for the creation of functions that check the number and type of their arguments, and dispatch
 * to different implementations based on the types of the inputs.
 */
export declare class FunctionBuilder {
    name: string;
    variants: FunctionVariant[];
    vectorized: Record<number, number[]>;
    constructor(name: string);
    /** Add a general function variant which accepts any number of arguments of any type. */
    vararg(impl: FunctionImpl): FunctionBuilder;
    /** Add a function variant which takes in a single argument. */
    add1<T extends LiteralTypeOrAll>(argType: T, impl: (a: LiteralReprAll<T>, context: Context) => Literal): FunctionBuilder;
    /** Add a function variant which takes in two typed arguments. */
    add2<T extends LiteralTypeOrAll, U extends LiteralTypeOrAll>(arg1: T, arg2: U, impl: (a: LiteralReprAll<T>, b: LiteralReprAll<U>, context: Context) => Literal): FunctionBuilder;
    /** Add a function variant which takes in three typed arguments. */
    add3<T extends LiteralTypeOrAll, U extends LiteralTypeOrAll, V extends LiteralTypeOrAll>(arg1: T, arg2: U, arg3: V, impl: (a: LiteralReprAll<T>, b: LiteralReprAll<U>, c: LiteralReprAll<V>, context: Context) => Literal): FunctionBuilder;
    /** Add vectorized variants which accept the given number of arguments and delegate. */
    vectorize(numArgs: number, positions: number[]): FunctionBuilder;
    /** Return a function which checks the number and type of arguments, passing them on to the first matching variant. */
    build(): FunctionImpl;
}
/** Utilities for managing function implementations. */
export declare namespace Functions {
    /** Bind a context to a function implementation, yielding a function which does not need the context argument. */
    function bind(func: FunctionImpl, context: Context): BoundFunctionImpl;
    /** Bind a context to all functions in the given map, yielding a new map of bound functions. */
    function bindAll(funcs: Record<string, FunctionImpl>, context: Context): Record<string, BoundFunctionImpl>;
}
/**
 * Collection of all defined functions; defined here so that they can be called from within dataview,
 * and test code.
 */
export declare namespace DefaultFunctions {
    const typeOf: FunctionImpl;
    /** Compute the length of a data type. */
    const length: FunctionImpl;
    /** List constructor function. */
    const list: FunctionImpl;
    /** Object constructor function. */
    const object: FunctionImpl;
    /** Internal link constructor function. */
    const link: FunctionImpl;
    /** Embed and un-embed a link. */
    const embed: FunctionImpl;
    /** External link constructor function. */
    const elink: FunctionImpl;
    /** Date constructor function. */
    const date: FunctionImpl;
    /** Duration constructor function. */
    const dur: FunctionImpl;
    /** Format a date using a luxon/moment-style date format. */
    const dateformat: FunctionImpl;
    const durationformat: FunctionImpl;
    const localtime: FunctionImpl;
    /** Number constructor function. */
    const number: FunctionImpl;
    /** Format a number using a standard currency format. */
    const currencyformat: FunctionImpl;
    /**
     * Convert any value to a reasonable internal string representation. Most useful for dates, strings, numbers, and
     * so on.
     */
    const string: FunctionImpl;
    const round: FunctionImpl;
    const trunc: FunctionImpl;
    const floor: FunctionImpl;
    const ceil: FunctionImpl;
    const min: FunctionImpl;
    const max: FunctionImpl;
    const minby: FunctionImpl;
    const maxby: FunctionImpl;
    const striptime: FunctionImpl;
    const contains: FunctionImpl;
    const icontains: FunctionImpl;
    const econtains: FunctionImpl;
    const containsword: FunctionImpl;
    /** Extract 0 or more keys from a given object via indexing. */
    const extract: FunctionImpl;
    const reverse: FunctionImpl;
    const sort: FunctionImpl;
    const regextest: FunctionImpl;
    const regexmatch: FunctionImpl;
    const regexreplace: FunctionImpl;
    const lower: FunctionImpl;
    const upper: FunctionImpl;
    const replace: FunctionImpl;
    /** Split a string on a given string. */
    const split: FunctionImpl;
    const startswith: FunctionImpl;
    const endswith: FunctionImpl;
    const padleft: FunctionImpl;
    const padright: FunctionImpl;
    const substring: FunctionImpl;
    const truncate: FunctionImpl;
    const fdefault: FunctionImpl;
    const ldefault: FunctionImpl;
    const choice: FunctionImpl;
    const hash: FunctionImpl;
    const reduce: FunctionImpl;
    const sum: FunctionImpl;
    const average: FunctionImpl;
    const product: FunctionImpl;
    const join: FunctionImpl;
    const any: FunctionImpl;
    const all: FunctionImpl;
    const none: FunctionImpl;
    const filter: FunctionImpl;
    const unique: FunctionImpl;
    const map: FunctionImpl;
    const nonnull: FunctionImpl;
    /** Gets an object containing a link's own properties */
    const meta: FunctionImpl;
    const flat: FunctionImpl;
    const slice: FunctionImpl;
}
/** Default function implementations for the expression evaluator. */
export declare const DEFAULT_FUNCTIONS: Record<string, FunctionImpl>;
export {};
