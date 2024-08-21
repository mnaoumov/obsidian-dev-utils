import type { DataviewRefreshableRenderer } from "../../ui/refreshable-view.d.ts";
import type { DataviewApi } from "../../api/plugin-api.d.ts";
export declare class DataviewJSRenderer extends DataviewRefreshableRenderer {
  public api: DataviewApi;
  public script: string;
  public container: HTMLElement;
  public origin: string;
  public static PREAMBLE: string;
  public constructor(api: DataviewApi, script: string, container: HTMLElement, origin: string);
  public render(): Promise<void>;
}
/** Inline JS renderer accessible using '=$' by default. */
export declare class DataviewInlineJSRenderer extends DataviewRefreshableRenderer {
  public api: DataviewApi;
  public script: string;
  public container: HTMLElement;
  public target: HTMLElement;
  public origin: string;
  public static PREAMBLE: string;
  public errorbox?: HTMLElement;
  public constructor(api: DataviewApi, script: string, container: HTMLElement, target: HTMLElement, origin: string);
  public render(): Promise<void>;
}
