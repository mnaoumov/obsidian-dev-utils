type LocalForage = typeof import("localforage");

import { PageMetadata } from "../data-model/markdown.js";
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
    appId: string;
    version: string;
    persister: LocalForage;
    constructor(appId: string, version: string);
    /** Drop the entire cache instance and re-create a new fresh instance. */
    recreate(): Promise<void>;
    /** Load file metadata by path. */
    loadFile(path: string): Promise<Cached<Partial<PageMetadata>> | null | undefined>;
    /** Store file metadata by path. */
    storeFile(path: string, data: Partial<PageMetadata>): Promise<void>;
    /** Drop old file keys that no longer exist. */
    synchronize(existing: string[] | Set<string>): Promise<Set<string>>;
    /** Obtain a list of all metadata keys. */
    allKeys(): Promise<string[]>;
    /** Obtain a list of all persisted files. */
    allFiles(): Promise<string[]>;
    fileKey(path: string): string;
}
