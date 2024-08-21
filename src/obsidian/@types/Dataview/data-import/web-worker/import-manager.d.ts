/** Controls and creates Dataview file importers, allowing for asynchronous loading and parsing of files. */
import { Component, MetadataCache, TFile, Vault } from "obsidian";
/** Callback when a file is resolved. */
type FileCallback = (p: any) => void;
/** Multi-threaded file parser which debounces rapid file requests automatically. */
export declare class FileImporter extends Component {
    numWorkers: number;
    vault: Vault;
    metadataCache: MetadataCache;
    workers: Worker[];
    /** Tracks which workers are actively parsing a file, to make sure we properly delegate results. */
    busy: boolean[];
    /** List of files which have been queued for a reload. */
    reloadQueue: TFile[];
    /** Fast-access set which holds the list of files queued to be reloaded; used for debouncing. */
    reloadSet: Set<string>;
    /** Paths -> promises for file reloads which have not yet been queued. */
    callbacks: Map<string, [FileCallback, FileCallback][]>;
    constructor(numWorkers: number, vault: Vault, metadataCache: MetadataCache);
    /**
     * Queue the given file for reloading. Multiple reload requests for the same file in a short time period will be de-bounced
     * and all be resolved by a single actual file reload.
     */
    reload<T>(file: TFile): Promise<T>;
    /** Finish the parsing of a file, potentially queueing a new file. */
    private finish;
    /** Send a new task to the given worker ID. */
    private send;
    /** Find the next available, non-busy worker; return undefined if all workers are busy. */
    private nextAvailableWorker;
}
export {};
