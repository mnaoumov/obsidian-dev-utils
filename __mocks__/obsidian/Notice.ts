import { noop } from '../../src/Function.ts';
import { castTo } from '../../src/ObjectUtils.ts';

export class Notice {
  public containerEl: HTMLElement = castTo<HTMLElement>(null);
  public messageEl: HTMLElement = castTo<HTMLElement>(null);
  public noticeEl: HTMLElement = castTo<HTMLElement>(null);

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
