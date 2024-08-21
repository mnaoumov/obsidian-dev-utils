/** Stores various indices on all files in the vault to make dataview generation fast. */
import { Result } from "../api/result.js";
import { LocalStorageCache } from "../data-import/persister.js";
import { FileImporter } from "../data-import/web-worker/import-manager.js";
import { PageMetadata } from "../data-model/markdown.js";
import { DataObject } from "../data-model/value.js";
import { DateTime } from "luxon";
import { App, Component, MetadataCache, TAbstractFile, TFile, Vault } from "obsidian";
/** Aggregate index which has several sub-indices and will initialize all of them. */
export declare class FullIndex extends Component {
    app: App;
    indexVersion: string;
    onChange: () => void;
    /** Generate a full index from the given vault. */
    static create(app: App, indexVersion: string, onChange: () => void): FullIndex;
    /** Whether all files in the vault have been indexed at least once. */
    initialized: boolean;
    /** I/O access to the Obsidian vault contents. */
    vault: Vault;
    /** Access to in-memory metadata, useful for parsing and metadata lookups. */
    metadataCache: MetadataCache;
    /** Persistent IndexedDB backing store, used for faster startup. */
    persister: LocalStorageCache;
    pages: Map<string, PageMetadata>;
    /** Map files -> tags in that file, and tags -> files. This version includes subtags. */
    tags: ValueCaseInsensitiveIndexMap;
    /** Map files -> exact tags in that file, and tags -> files. This version does not automatically add subtags. */
    etags: ValueCaseInsensitiveIndexMap;
    /** Map files -> linked files in that file, and linked file -> files that link to it. */
    links: IndexMap;
    /** Search files by path prefix. */
    prefix: PrefixIndex;
    /** Allows for efficient lookups of whether a file is starred or not. */
    starred: StarredCache;
    /** Caches data in CSV files. */
    csv: CsvCache;
    /**
     * The current "revision" of the index, which monotonically increases for every index change. Use this to determine
     * if you are up to date.
     */
    revision: number;
    /** Asynchronously parses files in the background using web workers. */
    importer: FileImporter;
    /** Construct a new index using the app data and a current data version. */
    private constructor();
    /** Trigger a metadata event on the metadata cache. */
    private trigger;
    /** "Touch" the index, incrementing the revision number and causing downstream views to reload. */
    touch(): void;
    /** Runs through the whole vault to set up initial file metadata. */
    initialize(): void;
    /** Drops the local storage cache and re-indexes all files; this should generally be used if you expect cache issues. */
    reinitialize(): Promise<void>;
    /** Internal asynchronous initializer. */
    private _initialize;
    rename(file: TAbstractFile, oldPath: string): void;
    /** Queue a file for reloading; this is done asynchronously in the background and may take a few seconds. */
    reload(file: TFile): Promise<{
        cached: boolean;
        skipped: boolean;
    }>;
    /** Import a file directly from disk, skipping the cache. */
    private import;
    /** Finish the reloading of file metadata by adding it to in memory indexes. */
    private finish;
}
/** Indexes files by their full prefix - essentially a simple prefix tree. */
export declare class PrefixIndex extends Component {
    vault: Vault;
    updateRevision: () => void;
    static create(vault: Vault, updateRevision: () => void): PrefixIndex;
    constructor(vault: Vault, updateRevision: () => void);
    private walk;
    /** Get the list of all files under the given path. */
    get(prefix: string, filter?: (path: string) => boolean): Set<string>;
    /** Determines if the given path exists in the prefix index. */
    pathExists(path: string): boolean;
    /** Determines if the given prefix exists in the prefix index. */
    nodeExists(prefix: string): boolean;
    /**
     * Use the in-memory prefix index to convert a relative path to an absolute one.
     */
    resolveRelative(path: string, origin?: string): string;
}
/** Simple path filters which filter file types. */
export declare namespace PathFilters {
    function csv(path: string): boolean;
    function markdown(path: string): boolean;
}
/**
 * Caches in-use CSVs to make high-frequency reloads (such as actively looking at a document
 * that uses CSV) fast.
 */
export declare class CsvCache extends Component {
    vault: Vault;
    static CACHE_EXPIRY_SECONDS: number;
    cache: Map<string, {
        data: DataObject[];
        loadTime: DateTime;
    }>;
    cacheClearInterval: number;
    constructor(vault: Vault);
    /** Load a CSV file from the cache, doing a fresh load if it has not been loaded. */
    get(path: string): Promise<Result<DataObject[], string>>;
    /** Do the actual raw loading of a CSV path (which is either local or an HTTP request). */
    private loadInternal;
    /** Clear old entries in the cache (as measured by insertion time). */
    private clearOldEntries;
}
export type StarredEntry = {
    type: "group";
    items: StarredEntry[];
    title: string;
} | {
    type: "file";
    path: string;
    title: string;
} | {
    type: "folder";
} | {
    type: "query";
};
/** Optional connector to the Obsidian 'Starred' plugin which allows for efficiently querying if a file is starred or not. */
export declare class StarredCache extends Component {
    app: App;
    onUpdate: () => void;
    /** Initial delay before checking the cache; we need to wait for it to asynchronously load the initial stars. */
    static INITIAL_DELAY: number;
    /** How frequently to check for star updates. */
    static REFRESH_INTERVAL: number;
    /** Set of all starred file paths. */
    private stars;
    constructor(app: App, onUpdate: () => void);
    /** Determines if the given path is starred. */
    starred(path: string): boolean;
    private reload;
    /** Fetch all starred files from the stars plugin, if present. */
    private static fetch;
}
/** A generic index which indexes variables of the form key -> value[], allowing both forward and reverse lookups. */
export declare class IndexMap {
    /** Maps key -> values for that key. */
    map: Map<string, Set<string>>;
    /** Cached inverse map; maps value -> keys that reference that value. */
    invMap: Map<string, Set<string>>;
    /** Create a new, empty index map. */
    constructor();
    /** Returns all values for the given key. */
    get(key: string): Set<string>;
    /** Returns all keys that reference the given key. Mutating the returned set is not allowed. */
    getInverse(value: string): Readonly<Set<string>>;
    /** Sets the key to the given values; this will delete the old mapping for the key if one was present. */
    set(key: string, values: Set<string>): this;
    /** Clears all values for the given key so they can be re-added. */
    delete(key: string): boolean;
    /** Rename all references to the given key to a new value. */
    rename(oldKey: string, newKey: string): boolean;
    /** Clear the entire index. */
    clear(): void;
    static EMPTY_SET: Readonly<Set<string>>;
}
/** Index map wrapper which is case-insensitive in the key. */
export declare class ValueCaseInsensitiveIndexMap {
    delegate: IndexMap;
    /** Create a new, empty case insensitive index map. */
    constructor(delegate?: IndexMap);
    /** Returns all values for the given key. */
    get(key: string): Set<string>;
    /** Returns all keys that reference the given value. Mutating the returned set is not allowed. */
    getInverse(value: string): Readonly<Set<string>>;
    /** Sets the key to the given values; this will delete the old mapping for the key if one was present. */
    set(key: string, values: Set<string>): this;
    /** Clears all values for the given key so they can be re-added. */
    delete(key: string): boolean;
    /** Rename all references to the given key to a new value. */
    rename(oldKey: string, newKey: string): boolean;
    /** Clear the entire index. */
    clear(): void;
}
