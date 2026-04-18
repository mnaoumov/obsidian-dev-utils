import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { noop } from '../../../function.ts';
import { AsyncErrorHandlerComponent } from './async-error-handler-component.ts';
import { PluginNoticeComponent } from './plugin-notice-component.ts';

const mocks = vi.hoisted(() => ({
  registerAsyncErrorEventHandler: vi.fn(() => vi.fn()),
  t: vi.fn((fn: (translations: Record<string, Record<string, string>>) => string) =>
    fn({
      obsidianDevUtils: {
        notices: {
          unhandledError: 'An error occurred'
        }
      }
    } as never)
  )
}));

vi.mock('../../../error.ts', () => ({
  registerAsyncErrorEventHandler: mocks.registerAsyncErrorEventHandler
}));

vi.mock('../../i18n/i18n.ts', () => ({
  t: mocks.t
}));

describe('AsyncErrorHandlerComponent', () => {
  it('should register error handler on load', () => {
    const noticeComponent = new PluginNoticeComponent('Test');
    const component = new AsyncErrorHandlerComponent(noticeComponent);
    const registerSpy = vi.spyOn(component, 'register');

    component.onload();

    expect(mocks.registerAsyncErrorEventHandler).toHaveBeenCalled();
    expect(registerSpy).toHaveBeenCalled();
  });

  it('should show notice when async error occurs', () => {
    const noticeComponent = new PluginNoticeComponent('Test');
    const showNoticeSpy = vi.spyOn(noticeComponent, 'showNotice');
    const component = new AsyncErrorHandlerComponent(noticeComponent);

    // eslint-disable-next-line func-style -- must be reassigned inside mockImplementation
    let errorHandler: (error: unknown) => void = () => {
      noop();
    };
    mocks.registerAsyncErrorEventHandler.mockImplementation(
      ((handler: (error: unknown) => void) => {
        errorHandler = handler;
        return vi.fn();
      }) as never
    );

    component.onload();
    errorHandler(new Error('test error'));

    expect(showNoticeSpy).toHaveBeenCalled();
  });
});
