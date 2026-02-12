export class Notice {
  containerEl: HTMLElement = null as unknown as HTMLElement;
  messageEl: HTMLElement = null as unknown as HTMLElement;
  noticeEl: HTMLElement = null as unknown as HTMLElement;

  constructor(_message: DocumentFragment | string, _duration?: number) {}

  hide(): void {}

  setMessage(_message: DocumentFragment | string): this {
    return this;
  }
}
