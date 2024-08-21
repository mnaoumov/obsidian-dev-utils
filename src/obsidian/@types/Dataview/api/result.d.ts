/** Functional return type for error handling. */
export declare class Success<T, E> {
    value: T;
    successful: true;
    constructor(value: T);
    map<U>(f: (a: T) => U): Result<U, E>;
    flatMap<U>(f: (a: T) => Result<U, E>): Result<U, E>;
    mapErr<U>(f: (e: E) => U): Result<T, U>;
    bimap<T2, E2>(succ: (a: T) => T2, _fail: (b: E) => E2): Result<T2, E2>;
    orElse(_value: T): T;
    cast<U>(): Result<U, E>;
    orElseThrow(_message?: (e: E) => string): T;
}
/** Functional return type for error handling. */
export declare class Failure<T, E> {
    error: E;
    successful: false;
    constructor(error: E);
    map<U>(_f: (a: T) => U): Result<U, E>;
    flatMap<U>(_f: (a: T) => Result<U, E>): Result<U, E>;
    mapErr<U>(f: (e: E) => U): Result<T, U>;
    bimap<T2, E2>(_succ: (a: T) => T2, fail: (b: E) => E2): Result<T2, E2>;
    orElse(value: T): T;
    cast<U>(): Result<U, E>;
    orElseThrow(message?: (e: E) => string): T;
}
export type Result<T, E> = Success<T, E> | Failure<T, E>;
/** Monadic 'Result' type which encapsulates whether a procedure succeeded or failed, as well as it's return value. */
export declare namespace Result {
    /** Construct a new success result wrapping the given value. */
    function success<T, E>(value: T): Result<T, E>;
    /** Construct a new failure value wrapping the given error. */
    function failure<T, E>(error: E): Result<T, E>;
    /** Join two results with a bi-function and return a new result. */
    function flatMap2<T1, T2, O, E>(first: Result<T1, E>, second: Result<T2, E>, f: (a: T1, b: T2) => Result<O, E>): Result<O, E>;
    /** Join two results with a bi-function and return a new result. */
    function map2<T1, T2, O, E>(first: Result<T1, E>, second: Result<T2, E>, f: (a: T1, b: T2) => O): Result<O, E>;
}
