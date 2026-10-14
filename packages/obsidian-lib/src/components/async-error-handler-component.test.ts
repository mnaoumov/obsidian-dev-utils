import type { App as AppOriginal } from 'obsidian';

import { CallbackDisposable } from '@mnaoumov/typescript-lib/disposable';
import { noop } from '@mnaoumov/typescript-lib/function';
import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { AsyncErrorHandlerComponent } from './async-error-handler-component.ts';
import { PluginNoticeComponent } from './plugin-notice-component.ts';

type TranslationsArgument = Parameters<Parameters<typeof import('../i18n/i18n.ts')['t']>[0]>[0];

const app = strictProxy<AppOriginal>({});

const mocks = vi.hoisted(() => ({
  registerAsyncErrorEventHandler: vi.fn<(handler: (error: unknown) => void) => Disposable>(),
  t: vi.fn(($function: (translations: TranslationsArgument) => string) =>
    $function(castTo<TranslationsArgument>({
      obsidianDevUtils: {
        notices: {
          unhandledError: 'An error occurred'
        }
      }
    }))
  )
}));

vi.mock('@mnaoumov/typescript-lib/error', () => ({
  registerAsyncErrorEventHandler: mocks.registerAsyncErrorEventHandler
}));

vi.mock('../i18n/i18n.ts', () => ({
  t: mocks.t
}));

describe('AsyncErrorHandlerComponent', () => {
  it('should register error handler on load', () => {
    mocks.registerAsyncErrorEventHandler.mockReturnValue(new CallbackDisposable({ callback: noop }));
    const noticeComponent = new PluginNoticeComponent({ app, pluginName: 'Test' });
    const component = new AsyncErrorHandlerComponent(noticeComponent);
    const registerSpy = vi.spyOn(component, 'register');

    component.onload();

    expect(mocks.registerAsyncErrorEventHandler).toHaveBeenCalled();
    expect(registerSpy).toHaveBeenCalled();
  });

  it('should dispose the registration when unloaded', () => {
    const disposeSpy = vi.fn();
    mocks.registerAsyncErrorEventHandler.mockReturnValue(new CallbackDisposable({ callback: disposeSpy }));
    const noticeComponent = new PluginNoticeComponent({ app, pluginName: 'Test' });
    const component = new AsyncErrorHandlerComponent(noticeComponent);

    component.load();
    component.unload();

    expect(disposeSpy).toHaveBeenCalledTimes(1);
  });

  it('should show notice when async error occurs', () => {
    const noticeComponent = new PluginNoticeComponent({ app, pluginName: 'Test' });
    noticeComponent.load();
    const showNoticeSpy = vi.spyOn(noticeComponent, 'showNotice');
    const component = new AsyncErrorHandlerComponent(noticeComponent);

    // eslint-disable-next-line func-style -- must be reassigned inside mockImplementation
    let errorHandler: (error: unknown) => void = () => {
      noop();
    };
    mocks.registerAsyncErrorEventHandler.mockImplementation((handler) => {
      errorHandler = handler;
      return new CallbackDisposable({ callback: noop });
    });

    component.onload();
    errorHandler(new Error('test error'));

    expect(showNoticeSpy).toHaveBeenCalled();
  });
});
