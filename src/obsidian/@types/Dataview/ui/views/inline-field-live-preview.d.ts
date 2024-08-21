import type { App, Component, TFile } from "obsidian";
import type { RangeSet, RangeValue, StateField } from "@codemirror/state";
import type { DecorationSet, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import type { InlineField } from "../../data-import/inline-field.d.ts";
import type { DataviewSettings } from "../../settings.d.ts";
declare class InlineFieldValue extends RangeValue {
    field: InlineField;
    constructor(field: InlineField);
    eq(other: InlineFieldValue): boolean;
}
/** A state field that stores the inline fields and their positions as a range set. */
export declare const inlineFieldsField: StateField<RangeSet<InlineFieldValue>>;
/** Create a view plugin that renders inline fields in live preview just as in the reading view. */
export declare const replaceInlineFieldsInLivePreview: (app: App, settings: DataviewSettings) => ViewPlugin<{
    decorations: DecorationSet;
    component: Component;
    destroy(): void;
    buildDecorations(view: EditorView): DecorationSet;
    update(update: ViewUpdate): void;
    updateDecorations(view: EditorView): void;
    removeDeco(start: number, end: number): void;
    addDeco(start: number, end: number, field: InlineField, file: TFile, view: EditorView): void;
}>;
/**
 * A state effect that represents the workspace's layout change.
 * Mainly intended to detect when the user switches between live preview and source mode.
 */
export declare const workspaceLayoutChangeEffect: import("@codemirror/state").StateEffectType<null>;
export {};
