import type { FullIndex } from "../../data-index/index.d.ts";
import type { Field } from "../../expression/field.d.ts";
import type { App } from "obsidian";
import type { DataviewSettings } from "../../settings.d.ts";
import type { DataviewRefreshableRenderer } from "../../ui/refreshable-view.d.ts";
/** Refreshable renderer which renders inline instead of in a div. */
export declare class DataviewInlineRenderer extends DataviewRefreshableRenderer {
  public field: Field;
  public fieldText: string;
  public container: HTMLElement;
  public target: HTMLElement;
  public index: FullIndex;
  public origin: string;
  public settings: DataviewSettings;
  public app: App;
  public errorbox?: HTMLElement;
  public constructor(field: Field, fieldText: string, container: HTMLElement, target: HTMLElement, index: FullIndex, origin: string, settings: DataviewSettings, app: App);
  public render(): Promise<void>;
}
