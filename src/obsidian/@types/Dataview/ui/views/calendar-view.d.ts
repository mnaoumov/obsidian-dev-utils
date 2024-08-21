import { FullIndex } from "../../data-index/index.js";
import { App } from "obsidian";
import { Query } from "../../query/query.js";
import { DataviewSettings } from "../../settings.js";
import { DataviewRefreshableRenderer } from "../../ui/refreshable-view.js";
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
