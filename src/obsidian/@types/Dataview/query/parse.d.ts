import * as P from "parsimmon";
import { FlattenStep, GroupStep, LimitStep, NamedField, Query, QueryHeader, QueryOperation, QuerySortBy, QueryType, SortByStep, WhereStep, Comment } from "./query.js";
import { Source } from "../data-index/source.js";
import { Result } from "../api/result.js";
/** Typings for the outputs of all of the parser combinators. */
interface QueryLanguageTypes {
    queryType: QueryType;
    comment: Comment;
    explicitNamedField: NamedField;
    namedField: NamedField;
    sortField: QuerySortBy;
    headerClause: QueryHeader;
    fromClause: Source;
    whereClause: WhereStep;
    sortByClause: SortByStep;
    limitClause: LimitStep;
    flattenClause: FlattenStep;
    groupByClause: GroupStep;
    clause: QueryOperation;
    query: Query;
}
/** Return a new parser which executes the underlying parser and returns it's raw string representation. */
export declare function captureRaw<T>(base: P.Parser<T>): P.Parser<[T, string]>;
/** A parsimmon-powered parser-combinator implementation of the query language. */
export declare const QUERY_LANGUAGE: P.TypedLanguage<QueryLanguageTypes>;
/**
 * Attempt to parse a query from the given query text, returning a string error
 * if the parse failed.
 */
export declare function parseQuery(text: string): Result<Query, string>;
export {};
