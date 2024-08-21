import type { FullIndex } from "../../data-index/index.d.ts";
import type { App } from "obsidian";
import type { Query } from "../../query/query.d.ts";
import type { DataviewSettings } from "../../settings.d.ts";
import type { DataviewRefreshableRenderer } from "../../ui/refreshable-view.d.ts";
export declare class DataviewCalendarRenderer extends DataviewRefreshableRenderer {
  public query: Query;
  public container: HTMLElement;
  public index: FullIndex;
  public origin: string;
  public settings: DataviewSettings;
  public app: App;
  private calendar;
  public constructor(query: Query, container: HTMLElement, index: FullIndex, origin: string, settings: DataviewSettings, app: App);
  public render(): Promise<void>;
  public onClose(): Promise<void>;
}
