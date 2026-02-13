import { noop } from '../../src/Function.ts';

export class Notice {
  public containerEl: HTMLElement = null as unknown as HTMLElement;
  public messageEl: HTMLElement = null as unknown as HTMLElement;
  public noticeEl: HTMLElement = null as unknown as HTMLElement;

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
