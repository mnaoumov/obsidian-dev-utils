/** Collect data matching a source query. */
import type { Result } from '../api/result.d.ts';
import type { FullIndex } from '../data-index/index.d.ts';
import type {
  DataObject,
  Literal
} from '../data-model/value.d.ts';
import type { Source } from './source.d.ts';
/** A data row which has an ID and associated data (like page link / page data). */
export type Datarow<T> = {
  id: Literal;
  data: T;
};
/** Find source paths which match the given source. */
export declare function matchingSourcePaths(source: Source, index: FullIndex, originFile?: string): Result<Set<string>, string>;
/** Convert a path to the data for that path; usually markdown pages, but could also be other file types (like CSV).  */
export declare function resolvePathData(path: string, index: FullIndex): Promise<Result<Datarow<DataObject>[], string>>;
/** Convert a CSV path to the data in the CSV (in dataview format). */
export declare function resolveCsvData(path: string, index: FullIndex): Promise<Result<Datarow<DataObject>[], string>>;
/** Convert a path pointing to a markdown page, into the associated metadata. */
export declare function resolveMarkdownData(path: string, index: FullIndex): Result<Datarow<DataObject>[], string>;
/** Resolve a source to the collection of data rows that it matches. */
export declare function resolveSource(source: Source, index: FullIndex, originFile?: string): Promise<Result<Datarow<DataObject>[], string>>;
