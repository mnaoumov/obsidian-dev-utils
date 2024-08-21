/** Functional return type for error handling. */
export declare class Success<T, E> {
  public value: T;
  public successful: true;
  public constructor(value: T);
  public map<U>(f: (a: T) => U): Result<U, E>;
  public flatMap<U>(f: (a: T) => Result<U, E>): Result<U, E>;
  public mapErr<U>(f: (e: E) => U): Result<T, U>;
  public bimap<T2, E2>(succ: (a: T) => T2, _fail: (b: E) => E2): Result<T2, E2>;
  public orElse(_value: T): T;
  public cast<U>(): Result<U, E>;
  public orElseThrow(_message?: (e: E) => string): T;
}
/** Functional return type for error handling. */
export declare class Failure<T, E> {
  public error: E;
  public successful: false;
  public constructor(error: E);
  public map<U>(_f: (a: T) => U): Result<U, E>;
  public flatMap<U>(_f: (a: T) => Result<U, E>): Result<U, E>;
  public mapErr<U>(f: (e: E) => U): Result<T, U>;
  public bimap<T2, E2>(_succ: (a: T) => T2, fail: (b: E) => E2): Result<T2, E2>;
  public orElse(value: T): T;
  public cast<U>(): Result<U, E>;
  public orElseThrow(message?: (e: E) => string): T;
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
