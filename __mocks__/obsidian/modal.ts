import type { App } from './app.ts';

import { noop } from '../../src/function.ts';
import { Scope } from './scope.ts';

export class Modal {
  public app: App;
  public containerEl: HTMLElement = createDiv();
  public contentEl: HTMLElement = createDiv();
  public modalEl: HTMLElement = createDiv();
  public scope = new Scope();
  public shouldRestoreSelection = true;
  public titleEl: HTMLElement = createDiv();

  public constructor(app: App) {
    this.app = app;
  }

  public close(): void {
    this.onClose();
  }

  public onClose(): void {
    noop();
  }

  public onOpen(): void {
    noop();
  }

  public open(): void {
    this.onOpen();
    // Use setTimeout so tests can intercept (e.g. simulate button clicks)
    // Before the modal auto-closes.
    setTimeout(() => {
      this.close();
    }, 0);
  }

  public setCloseCallback(_callback: () => unknown): this {
    return this;
  }

  public setContent(_content: DocumentFragment | string): this {
    return this;
  }

  public setTitle(_title: string): this {
    return this;
  }
}
