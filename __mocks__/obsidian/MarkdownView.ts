import type { TFile } from './TFile.ts';

export class MarkdownView {
  editor = {};
  file: null | TFile = null;
  getViewType(): string {
    return 'markdown';
  }
}
