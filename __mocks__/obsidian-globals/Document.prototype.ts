import { noop } from '../../src/Function.ts';

export function off(
  this: Document,
  _type: string,
  _selector: string,
  _listener: unknown,
  _options?: AddEventListenerOptions | boolean
): void {
  noop();
}

export function on(
  this: Document,
  type: string,
  _selector: string,
  listener: (this: Document, ev: Event, delegateTarget: HTMLElement) => unknown,
  options?: AddEventListenerOptions | boolean
): void {
  const that = this;
  function cb(ev: Event): void {
    listener.call(that, ev, ev.target as HTMLElement);
  }
  this.addEventListener(type, cb, options);
}
