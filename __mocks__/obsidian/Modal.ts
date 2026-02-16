import { noop } from '../../src/Function.ts';
import { Scope } from './Scope.ts';

export class Modal {
  public app: unknown;
  public containerEl: HTMLElement = {} as HTMLElement;
  public contentEl: HTMLElement = {} as HTMLElement;
  public modalEl: HTMLElement = {} as HTMLElement;
  public scope = new Scope();
  public shouldRestoreSelection = true;
  public titleEl: HTMLElement = {} as HTMLElement;

  public constructor(app: unknown) {
    this.app = app;
    this.containerEl = { addClass: noop } as unknown as HTMLElement;
    this.contentEl = { createEl: (() => ({})) as unknown } as HTMLElement;
    this.titleEl = { setText: noop } as unknown as HTMLElement;
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

  public setContent(_content: DocumentFragment | string): this {
    return this;
  }

  public setTitle(_title: string): this {
    return this;
  }
}
