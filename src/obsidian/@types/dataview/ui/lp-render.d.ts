import type {
  EditorSelection,
  Range
} from '@codemirror/state';
import type {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate
} from '@codemirror/view';
import type { SyntaxNode } from '@lezer/common';
import type {
  App,
  Component,
  TFile
} from 'obsidian';
import type { DataviewApi } from '../api/plugin-api.d.ts';
import type { FullIndex } from '../data-index/index.d.ts';
import type { DataviewSettings } from '../settings.d.ts';
export declare function selectionAndRangeOverlap(selection: EditorSelection, rangeFrom: number, rangeTo: number): boolean;
export declare function inlinePlugin(app: App, index: FullIndex, settings: DataviewSettings, api: DataviewApi): ViewPlugin<{
  decorations: DecorationSet;
  component: Component;
  update(update: ViewUpdate): void;
  updateTree(view: EditorView): void;
  removeDeco(node: SyntaxNode): void;
  addDeco(node: SyntaxNode, view: EditorView): void;
  renderNode(view: EditorView, node: SyntaxNode): {
    render: boolean;
    isQuery: boolean;
  };
  isInlineQuery(view: EditorView, start: number, end: number): boolean;
  inlineRender(view: EditorView): DecorationSet | undefined;
  renderWidget(node: SyntaxNode, view: EditorView, currentFile: TFile): Range<Decoration> | undefined;
  destroy(): void;
}>;
