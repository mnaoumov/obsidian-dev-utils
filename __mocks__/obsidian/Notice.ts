import { noop } from '../../src/Function.ts';

export class Notice {
  public containerEl: HTMLElement = createDiv();
  public messageEl: HTMLElement = createDiv();
  public noticeEl: HTMLElement = createDiv();

  public constructor(_message: DocumentFragment | string, _duration?: number) {
    noop();
  }

  public hide(): void {
    noop();
  }

  public setMessage(_message: DocumentFragment | string): this {
    return this;
  }
}
