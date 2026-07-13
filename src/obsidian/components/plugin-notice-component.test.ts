import type {
  App as AppOriginal,
  Notice as NoticeOriginal
} from 'obsidian';

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { waitForAllAsyncOperations } from '../../async.ts';
import { noop } from '../../function.ts';
import { castTo } from '../../object-utils.ts';
import { strictProxy } from '../../strict-proxy.ts';
import { ensureNonNullable } from '../../type-guards.ts';
import { CssClass } from '../css-class.ts';
import { confirm } from '../modals/confirm.ts';
import { PluginNoticeComponent } from './plugin-notice-component.ts';

interface NoticeInstance {
  containerEl: HTMLElement;
  hide: ReturnType<typeof vi.fn>;
  messageEl: HTMLElement;
  setMessage: ReturnType<typeof vi.fn>;
}

interface StateWrapper {
  value: unknown;
}

const PERMANENT_NOTICES_STATE_KEY = 'plugin-notice-component:permanent-notices';
const PLUGIN_NAME = 'My Plugin';
// Nothing dereferences the app in these tests (the confirm modal is stubbed), so a strict proxy over an
// Empty object is enough to satisfy the constructor's type.
const app = strictProxy<AppOriginal>({});

const mocks = vi.hoisted(() => {
  const instances: NoticeInstance[] = [];
  const NoticeMock = vi.fn(function noticeMock(this: NoticeInstance, ..._args: unknown[]) {
    this.hide = vi.fn();
    this.setMessage = vi.fn();
    this.messageEl = createDiv();
    this.containerEl = createDiv();
    this.containerEl.appendChild(this.messageEl);
    instances.push(this);
  });
  return { instances, NoticeMock };
});

const stateMocks = vi.hoisted(() => {
  const store = new Map<string, StateWrapper>();
  return { store };
});

vi.mock('obsidian', async (importOriginal) => {
  const actual = await importOriginal<typeof import('obsidian')>();
  return {
    ...actual,
    Notice: castTo<typeof NoticeOriginal>(mocks.NoticeMock)
  };
});

vi.mock('../modals/confirm.ts', () => ({
  confirm: vi.fn()
}));

vi.mock('../../obsidian-dev-utils-state.ts', () => ({
  getObsidianDevUtilsState: vi.fn((key: string, defaultValue: unknown) => {
    let wrapper = stateMocks.store.get(key);
    if (!wrapper) {
      wrapper = { value: defaultValue };
      stateMocks.store.set(key, wrapper);
    }
    return wrapper;
  })
}));

function getPermanentNotices(): Map<string, NoticeInstance> {
  const wrapper = stateMocks.store.get(PERMANENT_NOTICES_STATE_KEY);
  return wrapper ? castTo<Map<string, NoticeInstance>>(wrapper.value) : new Map<string, NoticeInstance>();
}

describe('PluginNoticeComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.instances.length = 0;
    stateMocks.store.clear();
  });

  it('should show a notice with plugin name prefix', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    component.showNotice('Something happened');

    const [content, duration] = mocks.NoticeMock.mock.calls[0] ?? [];
    expect(content).toBeInstanceOf(DocumentFragment);
    expect(castTo<DocumentFragment>(content).textContent).toBe('My Plugin\nSomething happened');
    expect(duration).toBeUndefined();
  });

  it('should render the plugin name in a styled element distinct from the message body', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    component.showNotice('Something happened');

    const fragment = castTo<DocumentFragment>(mocks.NoticeMock.mock.calls[0]?.[0]);
    const nameEl = fragment.querySelector('span');
    expect(nameEl?.textContent).toBe('My Plugin');
    expect(nameEl?.classList.contains(CssClass.LibraryName)).toBe(true);
    expect(nameEl?.classList.contains(CssClass.PluginNoticeName)).toBe(true);
  });

  it('should wrap the notice content in a container carrying the plugin-notice-content class', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    component.showNotice('Something happened');

    const fragment = castTo<DocumentFragment>(mocks.NoticeMock.mock.calls[0]?.[0]);
    const contentEl = fragment.firstElementChild;
    expect(contentEl?.classList.contains(CssClass.PluginNoticeContent)).toBe(true);
    // The whole message lives inside that single wrapper.
    expect(contentEl?.textContent).toBe('My Plugin\nSomething happened');
  });

  it('should keep the notice open when an interactive element inside it is clicked', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    const messageFragment = createFragment((f) => {
      f.createEl('a', { text: 'Link' });
    });
    component.showNotice(messageFragment);

    const fragment = castTo<DocumentFragment>(mocks.NoticeMock.mock.calls[0]?.[0]);
    // Stand in for Obsidian's noticeEl, whose own bubble-phase click handler dismisses the notice.
    const noticeElStub = createDiv();
    noticeElStub.appendChild(fragment);
    const dismissListener = vi.fn();
    noticeElStub.addEventListener('click', dismissListener);

    const linkEl = ensureNonNullable(noticeElStub.querySelector('a'));
    linkEl.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(dismissListener).not.toHaveBeenCalled();
  });

  it('should dismiss the notice when a non-interactive element inside it is clicked', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    component.showNotice('Something happened');

    const fragment = castTo<DocumentFragment>(mocks.NoticeMock.mock.calls[0]?.[0]);
    const noticeElStub = createDiv();
    noticeElStub.appendChild(fragment);
    const dismissListener = vi.fn();
    noticeElStub.addEventListener('click', dismissListener);

    // The plugin-name prefix is non-interactive, so its click must still reach the dismiss handler.
    const nameEl = ensureNonNullable(noticeElStub.querySelector('span'));
    nameEl.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(dismissListener).toHaveBeenCalledTimes(1);
  });

  it('should dismiss the notice when the click target is not an element (e.g. a text node)', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    component.showNotice('Something happened');

    const fragment = castTo<DocumentFragment>(mocks.NoticeMock.mock.calls[0]?.[0]);
    const noticeElStub = createDiv();
    noticeElStub.appendChild(fragment);
    const dismissListener = vi.fn();
    noticeElStub.addEventListener('click', dismissListener);

    const contentEl = ensureNonNullable(noticeElStub.querySelector(`.${CssClass.PluginNoticeContent}`));
    const textNode = ensureNonNullable(Array.from(contentEl.childNodes).find((node) => node.nodeType === Node.TEXT_NODE));
    textNode.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(dismissListener).toHaveBeenCalledTimes(1);
  });

  it('should return the created notice', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    const notice = component.showNotice('Something happened');
    expect(notice).toBe(mocks.instances[0]);
  });

  it('should mark the notice as unloaded when shown while not loaded', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.showNotice('Something happened');

    const content = mocks.NoticeMock.mock.calls[0]?.[0];
    expect(content).toBeInstanceOf(DocumentFragment);
    expect(castTo<DocumentFragment>(content).textContent).toBe('My Plugin (unloaded)\nSomething happened');
  });

  it('should hide previous notice when showing a new one', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();

    component.showNotice('First');
    const firstNotice = mocks.instances[0];

    component.showNotice('Second');
    expect(firstNotice?.hide).toHaveBeenCalled();
    expect(mocks.NoticeMock).toHaveBeenCalledTimes(2);
  });

  it('should not call hide if no previous notice exists', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    component.showNotice('First');
    expect(mocks.NoticeMock).toHaveBeenCalledTimes(1);
  });

  it('should hide the current notice on unload', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    component.showNotice('Persistent');
    const notice = mocks.instances[0];

    component.unload();

    expect(notice?.hide).toHaveBeenCalled();
  });

  it('should not throw on unload when no notice was shown', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();

    expect(() => {
      component.unload();
    }).not.toThrow();
  });

  it('should hide the current notice when a permanent notice is shown', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    component.showNotice('Usual');
    const usualNotice = mocks.instances[0];

    component.showNotice('Persistent', { isPermanent: true });

    expect(usualNotice?.hide).toHaveBeenCalled();
  });

  it('should show a permanent notice with an infinite duration and store it by plugin name', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    component.showNotice('Persistent', { isPermanent: true });

    const [content, duration] = mocks.NoticeMock.mock.calls[0] ?? [];
    expect(content).toBeInstanceOf(DocumentFragment);
    expect(castTo<DocumentFragment>(content).textContent).toBe('My Plugin\nPersistent');
    expect(duration).toBe(0);
    expect(getPermanentNotices().get(PLUGIN_NAME)).toBe(mocks.instances[0]);
  });

  it('should not hide a permanent notice on unload', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    component.showNotice('Persistent', { isPermanent: true });
    const notice = mocks.instances[0];

    component.unload();

    expect(notice?.hide).not.toHaveBeenCalled();
  });

  it('should hide the previous permanent notice when another notice is shown', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    component.showNotice('First', { isPermanent: true });
    const firstPermanentNotice = mocks.instances[0];

    component.showNotice('Second');

    expect(firstPermanentNotice?.hide).toHaveBeenCalled();
  });

  it('should dismiss a permanent notice left over from a previous load', () => {
    const staleNotice: NoticeInstance = { containerEl: createDiv(), hide: vi.fn(), messageEl: createDiv(), setMessage: vi.fn() };
    stateMocks.store.set(PERMANENT_NOTICES_STATE_KEY, { value: new Map([[PLUGIN_NAME, staleNotice]]) });

    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();

    expect(staleNotice.hide).toHaveBeenCalledTimes(1);
    expect(getPermanentNotices().has(PLUGIN_NAME)).toBe(false);
  });

  it('should not hide a standalone notice when a reusable notice is shown', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    component.showNotice('Standalone', { isReusable: false });
    const standaloneNotice = mocks.instances[0];

    component.showNotice('Reusable');

    expect(standaloneNotice?.hide).not.toHaveBeenCalled();
  });

  it('should not hide the current reusable notice when a standalone notice is shown', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    component.showNotice('Reusable');
    const reusableNotice = mocks.instances[0];

    component.showNotice('Standalone', { isReusable: false });

    expect(reusableNotice?.hide).not.toHaveBeenCalled();
  });

  it('should let multiple standalone notices coexist', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    component.showNotice('First', { isReusable: false });
    const firstNotice = mocks.instances[0];

    component.showNotice('Second', { isReusable: false });

    expect(firstNotice?.hide).not.toHaveBeenCalled();
    expect(mocks.NoticeMock).toHaveBeenCalledTimes(2);
  });

  it('should hide standalone notices on unload', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    component.showNotice('Standalone', { isReusable: false });
    const standaloneNotice = mocks.instances[0];

    component.unload();

    expect(standaloneNotice?.hide).toHaveBeenCalledTimes(1);
  });

  it('should throw when a permanent notice is explicitly marked non-reusable', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();

    expect(() => {
      component.showNotice('Bad', { isPermanent: true, isReusable: false });
    }).toThrow();
  });

  it('should show a requires-close-confirmation notice with an infinite duration', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    component.showNotice('Locked', { requiresCloseConfirmation: true });

    const [, duration] = mocks.NoticeMock.mock.calls[0] ?? [];
    expect(duration).toBe(0);
  });

  it('should make a requires-close-confirmation notice standalone by default', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    component.showNotice('Reusable');
    const reusableNotice = mocks.instances[0];

    component.showNotice('Locked', { requiresCloseConfirmation: true });

    expect(reusableNotice?.hide).not.toHaveBeenCalled();
  });

  it('should stop any click from dismissing a requires-close-confirmation notice', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    component.showNotice('Locked', { requiresCloseConfirmation: true });

    const fragment = castTo<DocumentFragment>(mocks.NoticeMock.mock.calls[0]?.[0]);
    const noticeElStub = createDiv();
    noticeElStub.appendChild(fragment);
    const dismissListener = vi.fn();
    noticeElStub.addEventListener('click', dismissListener);

    // Even a non-interactive element (the plugin-name prefix) must not dismiss it.
    const nameEl = ensureNonNullable(noticeElStub.querySelector('span'));
    nameEl.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(dismissListener).not.toHaveBeenCalled();
  });

  it('should render a close button on a requires-close-confirmation notice', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    component.showNotice('Locked', { requiresCloseConfirmation: true });

    const fragment = castTo<DocumentFragment>(mocks.NoticeMock.mock.calls[0]?.[0]);
    const closeButton = fragment.querySelector(`.${CssClass.PluginNoticeCloseButton}`);
    expect(closeButton).not.toBeNull();
  });

  it('should mark the notice container with the requires-confirmation class', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    component.showNotice('Locked', { requiresCloseConfirmation: true });

    const notice = ensureNonNullable(mocks.instances[0]);
    expect(notice.containerEl.classList.contains(CssClass.PluginNoticeRequiresConfirmation)).toBe(true);
  });

  it('should stop a click on the notice container from reaching the dismiss handler', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    component.showNotice('Locked', { requiresCloseConfirmation: true });

    const notice = ensureNonNullable(mocks.instances[0]);
    const outerStub = createDiv();
    outerStub.appendChild(notice.containerEl);
    const dismissListener = vi.fn();
    outerStub.addEventListener('click', dismissListener);

    notice.containerEl.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(dismissListener).not.toHaveBeenCalled();
  });

  it('should let a click on the close button pass through the container guard to the confirmation', async () => {
    vi.mocked(confirm).mockResolvedValue(true);
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    component.showNotice('Locked', { requiresCloseConfirmation: true });
    const notice = ensureNonNullable(mocks.instances[0]);

    // Simulate Obsidian inserting the notice content into the container, so the close button becomes a
    // Descendant of the container's capture-phase guard.
    const fragment = castTo<DocumentFragment>(mocks.NoticeMock.mock.calls[0]?.[0]);
    notice.messageEl.appendChild(fragment);

    const closeButton = ensureNonNullable(notice.containerEl.querySelector(`.${CssClass.PluginNoticeCloseButton}`));
    closeButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await waitForAllAsyncOperations();

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(notice.hide).toHaveBeenCalledTimes(1);
  });

  it('should stop a non-element click target on the container from dismissing the notice', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    component.showNotice('Locked', { requiresCloseConfirmation: true });
    const notice = ensureNonNullable(mocks.instances[0]);

    const outerStub = createDiv();
    outerStub.appendChild(notice.containerEl);
    const dismissListener = vi.fn();
    outerStub.addEventListener('click', dismissListener);

    // A text node is not an `Element`, exercising the guard's non-element branch.
    const textNode = notice.messageEl.appendChild(document.createTextNode('text'));
    textNode.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(dismissListener).not.toHaveBeenCalled();
  });

  it('should hide the notice when the close is confirmed', async () => {
    vi.mocked(confirm).mockResolvedValue(true);
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    component.showNotice('Locked', { requiresCloseConfirmation: true });
    const notice = ensureNonNullable(mocks.instances[0]);

    const fragment = castTo<DocumentFragment>(mocks.NoticeMock.mock.calls[0]?.[0]);
    const closeButton = ensureNonNullable(fragment.querySelector(`.${CssClass.PluginNoticeCloseButton}`));
    closeButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await waitForAllAsyncOperations();

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(notice.hide).toHaveBeenCalledTimes(1);
  });

  it('should not hide the notice when the close is not confirmed', async () => {
    vi.mocked(confirm).mockResolvedValue(false);
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    component.showNotice('Locked', { requiresCloseConfirmation: true });
    const notice = ensureNonNullable(mocks.instances[0]);

    const fragment = castTo<DocumentFragment>(mocks.NoticeMock.mock.calls[0]?.[0]);
    const closeButton = ensureNonNullable(fragment.querySelector(`.${CssClass.PluginNoticeCloseButton}`));
    closeButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await waitForAllAsyncOperations();

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(notice.hide).not.toHaveBeenCalled();
  });

  it('should throw when a reusable notice also requires close confirmation', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();

    expect(() => {
      component.showNotice('Bad', { isReusable: true, requiresCloseConfirmation: true });
    }).toThrow();
  });

  it('should invoke onHide when the notice is hidden by a replacing notice', async () => {
    const onHide = vi.fn();
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    component.showNotice('First', { onHide });

    component.showNotice('Second');
    await waitForAllAsyncOperations();

    expect(onHide).toHaveBeenCalledTimes(1);
  });

  it('should invoke onHide on unload', async () => {
    const onHide = vi.fn();
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    component.showNotice('Persistent', { onHide });

    component.unload();
    await waitForAllAsyncOperations();

    expect(onHide).toHaveBeenCalledTimes(1);
  });

  it('should invoke onHide at most once when the notice is hidden more than once', async () => {
    const onHide = vi.fn();
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    const notice = component.showNotice('First', { onHide });

    notice.hide();
    notice.hide();
    await waitForAllAsyncOperations();

    expect(onHide).toHaveBeenCalledTimes(1);
  });

  it('should support a document fragment message', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();

    const fragment = createFragment((f) => {
      f.appendText('Body text');
    });
    component.showNotice(fragment);

    const calledWith = mocks.NoticeMock.mock.calls[0]?.[0];
    expect(calledWith).toBeInstanceOf(DocumentFragment);
    expect(calledWith).toHaveProperty('textContent', 'My Plugin\nBody text');
  });
});

describe('PluginNoticeComponent.showNoticeAfterDelay', () => {
  const DELAY_IN_MILLISECONDS = 500;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.instances.length = 0;
    stateMocks.store.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should not show a notice when disposed before the delay elapses', async () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();

    const handle = component.showNoticeAfterDelay({ content: 'Working', delayInMilliseconds: DELAY_IN_MILLISECONDS });
    handle[Symbol.dispose]();
    await vi.advanceTimersByTimeAsync(DELAY_IN_MILLISECONDS);

    expect(mocks.NoticeMock).not.toHaveBeenCalled();
  });

  it('should show the notice after the delay and hide it on dispose', async () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();

    const handle = component.showNoticeAfterDelay({ content: 'Working', delayInMilliseconds: DELAY_IN_MILLISECONDS });
    await vi.advanceTimersByTimeAsync(DELAY_IN_MILLISECONDS);

    expect(mocks.NoticeMock).toHaveBeenCalledTimes(1);
    const [content, duration] = mocks.NoticeMock.mock.calls[0] ?? [];
    expect(castTo<DocumentFragment>(content).textContent).toBe('My Plugin\nWorking');
    expect(duration).toBe(0);

    handle[Symbol.dispose]();
    expect(mocks.instances[0]?.hide).toHaveBeenCalledTimes(1);
  });

  it('should use the default delay of 500 ms when none is provided', async () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();

    component.showNoticeAfterDelay({ content: 'Working' });
    await vi.advanceTimersByTimeAsync(DELAY_IN_MILLISECONDS - 1);
    expect(mocks.NoticeMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(mocks.NoticeMock).toHaveBeenCalledTimes(1);
  });

  it('should show a Cancel button that aborts the controller without dismissing the notice', async () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    const abortController = new AbortController();

    component.showNoticeAfterDelay({ abortController, content: 'Working', delayInMilliseconds: DELAY_IN_MILLISECONDS });
    await vi.advanceTimersByTimeAsync(DELAY_IN_MILLISECONDS);

    const content = castTo<DocumentFragment>(mocks.NoticeMock.mock.calls[0]?.[0]);
    const noticeElStub = createDiv();
    noticeElStub.appendChild(content);
    const dismissListener = vi.fn();
    noticeElStub.addEventListener('click', dismissListener);

    const buttonEl = ensureNonNullable(noticeElStub.querySelector('button'));
    expect(buttonEl.textContent).toBe('Cancel');

    buttonEl.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(abortController.signal.aborted).toBe(true);
    expect(dismissListener).not.toHaveBeenCalled();
  });

  it('should use a custom Cancel button text', async () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();

    component.showNoticeAfterDelay({
      abortController: new AbortController(),
      cancelButtonText: 'Stop',
      content: 'Working',
      delayInMilliseconds: DELAY_IN_MILLISECONDS
    });
    await vi.advanceTimersByTimeAsync(DELAY_IN_MILLISECONDS);

    const content = castTo<DocumentFragment>(mocks.NoticeMock.mock.calls[0]?.[0]);
    expect(content.querySelector('button')?.textContent).toBe('Stop');
  });

  it('should accept a document-fragment content', async () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();

    const contentFragment = createFragment((f) => {
      f.appendText('Body');
    });
    component.showNoticeAfterDelay({ content: contentFragment, delayInMilliseconds: DELAY_IN_MILLISECONDS });
    await vi.advanceTimersByTimeAsync(DELAY_IN_MILLISECONDS);

    const content = castTo<DocumentFragment>(mocks.NoticeMock.mock.calls[0]?.[0]);
    expect(content.textContent).toBe('My Plugin\nBody');
  });

  it('should not show the notice when disposed while the content is resolving', async () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();

    let resolveContent: (value: string) => void = noop;
    const handle = component.showNoticeAfterDelay({
      content: () =>
        new Promise<string>((resolve) => {
          resolveContent = resolve;
        }),
      delayInMilliseconds: DELAY_IN_MILLISECONDS
    });

    await vi.advanceTimersByTimeAsync(DELAY_IN_MILLISECONDS);
    handle[Symbol.dispose]();
    resolveContent('late');
    await vi.advanceTimersByTimeAsync(0);

    expect(mocks.NoticeMock).not.toHaveBeenCalled();
  });

  it('should cancel a pending delayed notice on unload', async () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();

    component.showNoticeAfterDelay({ content: 'Working', delayInMilliseconds: DELAY_IN_MILLISECONDS });
    component.unload();
    await vi.advanceTimersByTimeAsync(DELAY_IN_MILLISECONDS);

    expect(mocks.NoticeMock).not.toHaveBeenCalled();
  });

  it('should update the shown notice content via setContent', async () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();

    const handle = component.showNoticeAfterDelay({ content: 'Merging 1/10', delayInMilliseconds: DELAY_IN_MILLISECONDS });
    await vi.advanceTimersByTimeAsync(DELAY_IN_MILLISECONDS);

    handle.setContent('Merging 7/10');

    const setMessageMock = ensureNonNullable(mocks.instances[0]).setMessage;
    expect(setMessageMock).toHaveBeenCalledTimes(1);
    const updatedContent = castTo<DocumentFragment>(setMessageMock.mock.calls[0]?.[0]);
    expect(updatedContent.textContent).toBe('My Plugin\nMerging 7/10');
  });

  it('should show the latest content when setContent is called before the delay elapses', async () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();

    const handle = component.showNoticeAfterDelay({ content: 'Initial', delayInMilliseconds: DELAY_IN_MILLISECONDS });
    handle.setContent('Updated');
    await vi.advanceTimersByTimeAsync(DELAY_IN_MILLISECONDS);

    // No live notice existed yet, so setMessage was not called; the delayed notice shows the latest content.
    expect(mocks.instances[0]?.setMessage).not.toHaveBeenCalled();
    const content = castTo<DocumentFragment>(mocks.NoticeMock.mock.calls[0]?.[0]);
    expect(content.textContent).toBe('My Plugin\nUpdated');
  });

  it('should not clear a newer notice when the delayed handle is disposed after being replaced', async () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();

    const handle = component.showNoticeAfterDelay({ content: 'Working', delayInMilliseconds: DELAY_IN_MILLISECONDS });
    await vi.advanceTimersByTimeAsync(DELAY_IN_MILLISECONDS);

    component.showNotice('Newer');
    const newerNotice = mocks.instances[1];

    handle[Symbol.dispose]();

    // Disposing the delayed handle hides its own (already-replaced) notice but must not touch the newer one.
    expect(newerNotice?.hide).not.toHaveBeenCalled();
    component.unload();
    expect(newerNotice?.hide).toHaveBeenCalledTimes(1);
  });
});
