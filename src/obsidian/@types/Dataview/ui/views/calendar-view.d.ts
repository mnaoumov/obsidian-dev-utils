import type { FullIndex } from "../../data-index/index.d.ts";
import type { App } from "obsidian";
import type { Query } from "../../query/query.d.ts";
import type { DataviewSettings } from "../../settings.d.ts";
import type { DataviewRefreshableRenderer } from "../../ui/refreshable-view.d.ts";
export declare class DataviewCalendarRenderer extends DataviewRefreshableRenderer {
    query: Query;
    container: HTMLElement;
    index: FullIndex;
    origin: string;
    settings: DataviewSettings;
    app: App;
    private calendar;
    constructor(query: Query, container: HTMLElement, index: FullIndex, origin: string, settings: DataviewSettings, app: App);
    render(): Promise<void>;
    onClose(): Promise<void>;
}
