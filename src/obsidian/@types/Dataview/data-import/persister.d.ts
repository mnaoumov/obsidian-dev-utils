type LocalForage = typeof import("localforage");

import type { PageMetadata } from "../data-model/markdown.d.ts";
/** A piece of data that has been cached for a specific version and time. */
export interface Cached<T> {
  /** The version of Dataview that the data was written to cache with. */
  version: string;
  /** The time that the data was written to cache. */
  time: number;
  /** The data that was cached. */
  data: T;
}
/** Simpler wrapper for a file-backed cache for arbitrary metadata. */
export declare class LocalStorageCache {
  public appId: string;
  public version: string;
  public persister: LocalForage;
  public constructor(appId: string, version: string);
  /** Drop the entire cache instance and re-create a new fresh instance. */
  public recreate(): Promise<void>;
  /** Load file metadata by path. */
  public loadFile(path: string): Promise<Cached<Partial<PageMetadata>> | null | undefined>;
  /** Store file metadata by path. */
  public storeFile(path: string, data: Partial<PageMetadata>): Promise<void>;
  /** Drop old file keys that no longer exist. */
  public synchronize(existing: string[] | Set<string>): Promise<Set<string>>;
  /** Obtain a list of all metadata keys. */
  public allKeys(): Promise<string[]>;
  /** Obtain a list of all persisted files. */
  public allFiles(): Promise<string[]>;
  public fileKey(path: string): string;
}
