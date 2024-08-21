import type { DataviewRefreshableRenderer } from "../../ui/refreshable-view.d.ts";
import type { DataviewApi } from "../../api/plugin-api.d.ts";
export declare class DataviewJSRenderer extends DataviewRefreshableRenderer {
    api: DataviewApi;
    script: string;
    container: HTMLElement;
    origin: string;
    static PREAMBLE: string;
    constructor(api: DataviewApi, script: string, container: HTMLElement, origin: string);
    render(): Promise<void>;
}
/** Inline JS renderer accessible using '=$' by default. */
export declare class DataviewInlineJSRenderer extends DataviewRefreshableRenderer {
    api: DataviewApi;
    script: string;
    container: HTMLElement;
    target: HTMLElement;
    origin: string;
    static PREAMBLE: string;
    errorbox?: HTMLElement;
    constructor(api: DataviewApi, script: string, container: HTMLElement, target: HTMLElement, origin: string);
    render(): Promise<void>;
}
