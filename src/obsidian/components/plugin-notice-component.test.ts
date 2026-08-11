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
import { dispose } from '../../disposable.ts';
import { noop } from '../../function.ts';
import { castTo } from '../../object-utils.ts';
import { strictProxy } from '../../strict-proxy.ts';
import { ensureNonNullable } from '../../type-guards.ts';
import { CssClass } from '../css-class.ts';
import {
  PluginNoticeComponent,
  PluginNoticeMode
} from './plugin-notice-component.ts';

interface NoticeInstance {
  containerEl: HTMLElement;
  hide: ReturnType<typeof vi.fn>;
  messageEl: HTMLElement;
  setAutoHide: ReturnType<typeof vi.fn>;
  setMessage: ReturnType<typeof vi.fn>;
}

interface StateWrapper {
  value: unknown;
}

const PERMANENT_NOTICES_STATE_KEY = 'plugin-notice-component:permanent-notices';
const PLUGIN_NAME = 'My Plugin';
// The component never dereferences the app, so a strict proxy over an empty object satisfies the
// Constructor's type.
const app = strictProxy<AppOriginal>({});

const mocks = vi.hoisted(() => {
  const instances: NoticeInstance[] = [];
  const NoticeMock = vi.fn(function noticeMock(this: NoticeInstance, ..._arguments: unknown[]) {
    this.hide = vi.fn();
    this.setAutoHide = vi.fn();
    this.setMessage = vi.fn();
    this.messageEl = createDiv();
    this.containerEl = createDiv();
    this.containerEl.append(this.messageEl);
    // A freshly constructed notice IS on screen, and the component asks `isShown()` (as Obsidian's own
    // `hide` does) before appending to it. `isShown()` reads `offsetParent`, which jsdom never computes,
    // So it is declared here — and cleared by `dismissNotice` for the notice-is-gone cases.
    Object.defineProperty(this.containerEl, 'offsetParent', { configurable: true, value: document.body });
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

// Puts a mock notice in the state a real one is in once it has expired or been dismissed: detached, so
// `isShown()` is false. That is what tells the component the slot has nothing left to append to.
function dismissNotice(notice: NoticeInstance): void {
  Object.defineProperty(notice.containerEl, 'offsetParent', { configurable: true, value: null });
}

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
    const noticeElementStub = createDiv();
    noticeElementStub.append(fragment);
    const dismissListener = vi.fn();
    noticeElementStub.addEventListener('click', dismissListener);

    const linkEl = ensureNonNullable(noticeElementStub.querySelector('a'));
    linkEl.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(dismissListener).not.toHaveBeenCalled();
  });

  it('should dismiss the notice when a non-interactive element inside it is clicked', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    component.showNotice('Something happened');

    const fragment = castTo<DocumentFragment>(mocks.NoticeMock.mock.calls[0]?.[0]);
    const noticeElementStub = createDiv();
    noticeElementStub.append(fragment);
    const dismissListener = vi.fn();
    noticeElementStub.addEventListener('click', dismissListener);

    // The plugin-name prefix is non-interactive, so its click must still reach the dismiss handler.
    const nameEl = ensureNonNullable(noticeElementStub.querySelector('span'));
    nameEl.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(dismissListener).toHaveBeenCalledTimes(1);
  });

  it('should dismiss the notice when the click target is not an element (e.g. a text node)', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    component.showNotice('Something happened');

    const fragment = castTo<DocumentFragment>(mocks.NoticeMock.mock.calls[0]?.[0]);
    const noticeElementStub = createDiv();
    noticeElementStub.append(fragment);
    const dismissListener = vi.fn();
    noticeElementStub.addEventListener('click', dismissListener);

    const contentEl = ensureNonNullable(noticeElementStub.querySelector(`.${CssClass.PluginNoticeContent}`));
    const textNode = ensureNonNullable([...contentEl.childNodes].find((node) => node.nodeType === Node.TEXT_NODE));
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
    const staleNotice: NoticeInstance = { containerEl: createDiv(), hide: vi.fn(), messageEl: createDiv(), setAutoHide: vi.fn(), setMessage: vi.fn() };
    stateMocks.store.set(PERMANENT_NOTICES_STATE_KEY, { value: new Map([[PLUGIN_NAME, staleNotice]]) });

    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();

    expect(staleNotice.hide).toHaveBeenCalledTimes(1);
    expect(getPermanentNotices().has(PLUGIN_NAME)).toBe(false);
  });

  it('should not hide a separate notice when a slot notice is shown', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    component.showNotice('Standalone', { mode: PluginNoticeMode.Separate });
    const standaloneNotice = mocks.instances[0];

    component.showNotice('Reusable');

    expect(standaloneNotice?.hide).not.toHaveBeenCalled();
  });

  it('should not hide the current slot notice when a separate notice is shown', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    component.showNotice('Reusable');
    const reusableNotice = mocks.instances[0];

    component.showNotice('Standalone', { mode: PluginNoticeMode.Separate });

    expect(reusableNotice?.hide).not.toHaveBeenCalled();
  });

  it('should let multiple separate notices coexist', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    component.showNotice('First', { mode: PluginNoticeMode.Separate });
    const firstNotice = mocks.instances[0];

    component.showNotice('Second', { mode: PluginNoticeMode.Separate });

    expect(firstNotice?.hide).not.toHaveBeenCalled();
    expect(mocks.NoticeMock).toHaveBeenCalledTimes(2);
  });

  it('should hide separate notices on unload', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    component.showNotice('Standalone', { mode: PluginNoticeMode.Separate });
    const standaloneNotice = mocks.instances[0];

    component.unload();

    expect(standaloneNotice?.hide).toHaveBeenCalledTimes(1);
  });

  it('should append to the current notice instead of replacing it', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    const firstNotice = component.showNotice('alpha');
    const currentNotice = ensureNonNullable(mocks.instances[0]);

    const returnedNotice = component.showNotice('bravo', { mode: PluginNoticeMode.Append });

    // No second notice was constructed: both messages live in the one that was already up.
    expect(mocks.NoticeMock).toHaveBeenCalledTimes(1);
    expect(currentNotice.hide).not.toHaveBeenCalled();
    expect(returnedNotice).toBe(firstNotice);
    expect(currentNotice.messageEl.textContent).toBe('bravo');
  });

  it('should not repeat the plugin name on an appended message', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    component.showNotice('alpha');
    const currentNotice = ensureNonNullable(mocks.instances[0]);

    component.showNotice('bravo', { mode: PluginNoticeMode.Append });

    // The notice already opens with the plugin name; repeating it per line is noise.
    expect(currentNotice.messageEl.querySelector(`.${CssClass.PluginNoticeName}`)).toBeNull();
    expect(currentNotice.messageEl.textContent).not.toContain(PLUGIN_NAME);
  });

  it('should wrap an appended message so an interactive element keeps the notice open', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    component.showNotice('alpha');
    const currentNotice = ensureNonNullable(mocks.instances[0]);
    const messageFragment = createFragment((f) => {
      f.createEl('a', { text: 'Link' });
    });

    component.showNotice(messageFragment, { mode: PluginNoticeMode.Append });

    const dismissListener = vi.fn();
    currentNotice.containerEl.addEventListener('click', dismissListener);
    const linkEl = ensureNonNullable(currentNotice.messageEl.querySelector('a'));
    linkEl.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(dismissListener).not.toHaveBeenCalled();
  });

  it('should restart the countdown when appending', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    component.showNotice('alpha');
    const currentNotice = ensureNonNullable(mocks.instances[0]);

    component.showNotice('bravo', { mode: PluginNoticeMode.Append });

    // Obsidian's own default duration, so the appended message is readable for a full duration rather
    // Than inheriting what was left of the current one.
    expect(currentNotice.setAutoHide).toHaveBeenCalledWith(4000);
  });

  it('should keep an appended permanent notice from expiring', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    component.showNotice('alpha');
    const currentNotice = ensureNonNullable(mocks.instances[0]);

    component.showNotice('bravo', { isPermanent: true, mode: PluginNoticeMode.Append });

    expect(currentNotice.setAutoHide).toHaveBeenCalledWith(0);
    expect(getPermanentNotices().get(PLUGIN_NAME)).toBe(currentNotice);
  });

  it('should keep the permanent registration of the notice it appends to', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    component.showNotice('alpha', { isPermanent: true });
    const currentNotice = ensureNonNullable(mocks.instances[0]);

    component.showNotice('bravo', { mode: PluginNoticeMode.Append });

    // A later appended line is no reason to forget that this is the plugin's permanent notice.
    expect(getPermanentNotices().get(PLUGIN_NAME)).toBe(currentNotice);
  });

  it('should show a new notice when appending with nothing on screen', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();

    component.showNotice('alpha', { mode: PluginNoticeMode.Append });

    expect(mocks.NoticeMock).toHaveBeenCalledTimes(1);
    const [content] = mocks.NoticeMock.mock.calls[0] ?? [];
    // Opening a notice, so it carries the plugin name like any other first message.
    expect(castTo<DocumentFragment>(content).textContent).toBe('My Plugin\nalpha');
  });

  it('should show a new notice when appending to a notice that has been dismissed', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    component.showNotice('alpha');
    const dismissedNotice = ensureNonNullable(mocks.instances[0]);
    dismissNotice(dismissedNotice);

    component.showNotice('bravo', { mode: PluginNoticeMode.Append });

    expect(mocks.NoticeMock).toHaveBeenCalledTimes(2);
    expect(dismissedNotice.messageEl.textContent).toBe('');
  });

  it('should invoke onHide of an appending call when the notice is hidden', async () => {
    const onHide = vi.fn();
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    const notice = component.showNotice('alpha');
    component.showNotice('bravo', { mode: PluginNoticeMode.Append, onHide });

    notice.hide();
    await waitForAllAsyncOperations();

    expect(onHide).toHaveBeenCalledTimes(1);
  });

  it('should throw when an appending notice also does not hide on click', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();

    expect(() => {
      component.showNotice('Bad', { mode: PluginNoticeMode.Append, shouldHideOnClick: false });
    }).toThrow();
  });

  it('should throw when a permanent notice is asked to be separate', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();

    expect(() => {
      component.showNotice('Bad', { isPermanent: true, mode: PluginNoticeMode.Separate });
    }).toThrow();
  });

  it('should show a requires-explicit-close notice with an infinite duration', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    component.showNotice('Locked', { shouldHideOnClick: false });

    const [, duration] = mocks.NoticeMock.mock.calls[0] ?? [];
    expect(duration).toBe(0);
  });

  it('should make a requires-explicit-close notice standalone by default', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    component.showNotice('Reusable');
    const reusableNotice = mocks.instances[0];

    component.showNotice('Locked', { shouldHideOnClick: false });

    expect(reusableNotice?.hide).not.toHaveBeenCalled();
  });

  it('should stop any click from dismissing a requires-explicit-close notice', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    component.showNotice('Locked', { shouldHideOnClick: false });

    const fragment = castTo<DocumentFragment>(mocks.NoticeMock.mock.calls[0]?.[0]);
    const noticeElementStub = createDiv();
    noticeElementStub.append(fragment);
    const dismissListener = vi.fn();
    noticeElementStub.addEventListener('click', dismissListener);

    // Even a non-interactive element (the plugin-name prefix) must not dismiss it.
    const nameEl = ensureNonNullable(noticeElementStub.querySelector('span'));
    nameEl.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(dismissListener).not.toHaveBeenCalled();
  });

  it('should render a close button on a requires-explicit-close notice', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    component.showNotice('Locked', { shouldHideOnClick: false });

    const fragment = castTo<DocumentFragment>(mocks.NoticeMock.mock.calls[0]?.[0]);
    const closeButton = fragment.querySelector(`.${CssClass.PluginNoticeCloseButton}`);
    expect(closeButton).not.toBeNull();
  });

  it('should mark the notice container with the requires-explicit-close class', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    component.showNotice('Locked', { shouldHideOnClick: false });

    const notice = ensureNonNullable(mocks.instances[0]);
    expect(notice.containerEl.classList.contains(CssClass.PluginNoticeRequiresExplicitClose)).toBe(true);
  });

  it('should stop a click on the notice container from reaching the dismiss handler', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    component.showNotice('Locked', { shouldHideOnClick: false });

    const notice = ensureNonNullable(mocks.instances[0]);
    const outerStub = createDiv();
    outerStub.append(notice.containerEl);
    const dismissListener = vi.fn();
    outerStub.addEventListener('click', dismissListener);

    notice.containerEl.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(dismissListener).not.toHaveBeenCalled();
  });

  it('should let a click on the close button pass through the container guard and hide the notice', async () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    component.showNotice('Locked', { shouldHideOnClick: false });
    const notice = ensureNonNullable(mocks.instances[0]);

    // Simulate Obsidian inserting the notice content into the container, so the close button becomes a
    // Descendant of the container's capture-phase guard.
    const fragment = castTo<DocumentFragment>(mocks.NoticeMock.mock.calls[0]?.[0]);
    notice.messageEl.append(fragment);

    const closeButton = ensureNonNullable(notice.containerEl.querySelector(`.${CssClass.PluginNoticeCloseButton}`));
    closeButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await waitForAllAsyncOperations();

    expect(notice.hide).toHaveBeenCalledTimes(1);
  });

  it('should style the close button with the Obsidian modal close-button classes', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    component.showNotice('Locked', { shouldHideOnClick: false });

    const fragment = castTo<DocumentFragment>(mocks.NoticeMock.mock.calls[0]?.[0]);
    const closeButton = ensureNonNullable(fragment.querySelector(`.${CssClass.PluginNoticeCloseButton}`));
    expect(closeButton.classList.contains(CssClass.ClickableIcon)).toBe(true);
    expect(closeButton.classList.contains(CssClass.ModalHeaderButton)).toBe(true);
  });

  it('should not render a close button when shouldShowCloseButton is false', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    component.showNotice('Locked', { shouldHideOnClick: false, shouldShowCloseButton: false });

    const fragment = castTo<DocumentFragment>(mocks.NoticeMock.mock.calls[0]?.[0]);
    expect(fragment.querySelector(`.${CssClass.PluginNoticeCloseButton}`)).toBeNull();
  });

  it('should let a click on an interactive button in the message run its handler without dismissing the notice', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();

    // A consumer embeds an action button in the message fragment. Its click is wired via
    // `addEventListener` so a dispatched DOM click drives it directly.
    const message = createFragment();
    const actionButton = message.createEl('button', { text: 'Action' });
    const buttonClickListener = vi.fn();
    actionButton.addEventListener('click', buttonClickListener);

    component.showNotice(message, { shouldHideOnClick: false });
    const notice = ensureNonNullable(mocks.instances[0]);

    // Simulate Obsidian inserting the notice content into the container, so the button becomes a
    // Descendant of the container's capture-phase guard.
    const fragment = castTo<DocumentFragment>(mocks.NoticeMock.mock.calls[0]?.[0]);
    notice.messageEl.append(fragment);

    const outerStub = createDiv();
    outerStub.append(notice.containerEl);
    const dismissListener = vi.fn();
    outerStub.addEventListener('click', dismissListener);

    actionButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(buttonClickListener).toHaveBeenCalledTimes(1);
    expect(dismissListener).not.toHaveBeenCalled();
  });

  it('should stop a non-element click target on the container from dismissing the notice', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    component.showNotice('Locked', { shouldHideOnClick: false });
    const notice = ensureNonNullable(mocks.instances[0]);

    const outerStub = createDiv();
    outerStub.append(notice.containerEl);
    const dismissListener = vi.fn();
    outerStub.addEventListener('click', dismissListener);

    // A text node is not an `Element`, exercising the guard's non-element branch.
    // eslint-disable-next-line unicorn/prefer-dom-node-append -- The appended node is needed back, and `append` returns `undefined`.
    const textNode = notice.messageEl.appendChild(document.createTextNode('text'));
    textNode.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(dismissListener).not.toHaveBeenCalled();
  });

  it('should hide the notice and report a close-button user action to onHide when the close button is clicked', async () => {
    const onHide = vi.fn();
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    component.showNotice('Locked', { onHide, shouldHideOnClick: false });
    const notice = ensureNonNullable(mocks.instances[0]);

    const fragment = castTo<DocumentFragment>(mocks.NoticeMock.mock.calls[0]?.[0]);
    const closeButton = ensureNonNullable(fragment.querySelector(`.${CssClass.PluginNoticeCloseButton}`));
    closeButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await waitForAllAsyncOperations();

    expect(notice.hide).toHaveBeenCalledTimes(1);
    expect(onHide).toHaveBeenCalledWith({ isCloseButtonClicked: true, isUserAction: true });
  });

  it('should fire onCloseClick and hide the notice when it does not cancel', async () => {
    let onCloseClickCount = 0;
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    component.showNotice('Locked', {
      onCloseClick: () => {
        onCloseClickCount += 1;
      },
      shouldHideOnClick: false
    });
    const notice = ensureNonNullable(mocks.instances[0]);

    const fragment = castTo<DocumentFragment>(mocks.NoticeMock.mock.calls[0]?.[0]);
    const closeButton = ensureNonNullable(fragment.querySelector(`.${CssClass.PluginNoticeCloseButton}`));
    closeButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await waitForAllAsyncOperations();

    expect(onCloseClickCount).toBe(1);
    expect(notice.hide).toHaveBeenCalledTimes(1);
  });

  it('should not hide the notice when onCloseClick cancels the close', async () => {
    let onCloseClickCount = 0;
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    component.showNotice('Locked', {
      onCloseClick: (event) => {
        onCloseClickCount += 1;
        event.cancel();
      },
      shouldHideOnClick: false
    });
    const notice = ensureNonNullable(mocks.instances[0]);

    const fragment = castTo<DocumentFragment>(mocks.NoticeMock.mock.calls[0]?.[0]);
    const closeButton = ensureNonNullable(fragment.querySelector(`.${CssClass.PluginNoticeCloseButton}`));
    closeButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await waitForAllAsyncOperations();

    expect(onCloseClickCount).toBe(1);
    expect(notice.hide).not.toHaveBeenCalled();
  });

  it('should report a user action to onHide when a dismissible notice is clicked', async () => {
    const onHide = vi.fn();
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    const notice = component.showNotice('Normal', { onHide });

    // A user click on the notice (which Obsidian would dismiss on), then the resulting hide.
    notice.containerEl.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    notice.hide();
    await waitForAllAsyncOperations();

    expect(onHide).toHaveBeenCalledWith({ isCloseButtonClicked: false, isUserAction: true });
  });

  it('should report no user action to onHide when the notice is hidden programmatically', async () => {
    const onHide = vi.fn();
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    const notice = component.showNotice('Normal', { onHide });

    notice.hide();
    await waitForAllAsyncOperations();

    expect(onHide).toHaveBeenCalledWith({ isCloseButtonClicked: false, isUserAction: false });
  });

  it('should throw when a slot notice also does not hide on click', () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();

    expect(() => {
      component.showNotice('Bad', { mode: PluginNoticeMode.Replace, shouldHideOnClick: false });
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
    dispose(handle);
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

    dispose(handle);
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
    const noticeElementStub = createDiv();
    noticeElementStub.append(content);
    const dismissListener = vi.fn();
    noticeElementStub.addEventListener('click', dismissListener);

    const buttonEl = ensureNonNullable(noticeElementStub.querySelector('button'));
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
    dispose(handle);
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

    // The content handed to `Notice`. The real Obsidian moves it into the notice; the mock leaves it
    // Here, and either way the handle's message element is the thing rewritten in place.
    const content = castTo<DocumentFragment>(mocks.NoticeMock.mock.calls[0]?.[0]);
    expect(content.textContent).toBe('My Plugin\nMerging 1/10');

    handle.setContent('Merging 7/10');

    expect(content.textContent).toBe('My Plugin\nMerging 7/10');
    // The message element is swapped rather than the whole notice message rewritten, so a notice this
    // Handle merely joined keeps the messages that are not its own.
    expect(mocks.instances[0]?.setMessage).not.toHaveBeenCalled();
  });

  // A progress notice in the shared slot is hidden by any ordinary notice raised while the operation
  // Runs — and it never comes back, because the handle then updates a notice that is no longer shown.
  it('should keep a separate delayed notice alive when another notice is shown', async () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();

    const handle = component.showNoticeAfterDelay({
      content: 'Working',
      delayInMilliseconds: DELAY_IN_MILLISECONDS,
      mode: PluginNoticeMode.Separate
    });
    await vi.advanceTimersByTimeAsync(DELAY_IN_MILLISECONDS);
    const progressNotice = ensureNonNullable(mocks.instances[0]);

    component.showNotice('Unrelated');

    expect(progressNotice.hide).not.toHaveBeenCalled();

    dispose(handle);
    expect(progressNotice.hide).toHaveBeenCalledTimes(1);
    // Dropped from the standalone tracking too, so unloading does not hide it a second time.
    component.unload();
    expect(progressNotice.hide).toHaveBeenCalledTimes(1);
  });

  it('should append a delayed notice to the current notice', async () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    component.showNotice('alpha');
    const currentNotice = ensureNonNullable(mocks.instances[0]);

    component.showNoticeAfterDelay({
      content: 'Working',
      delayInMilliseconds: DELAY_IN_MILLISECONDS,
      mode: PluginNoticeMode.Append
    });
    await vi.advanceTimersByTimeAsync(DELAY_IN_MILLISECONDS);

    expect(mocks.NoticeMock).toHaveBeenCalledTimes(1);
    expect(currentNotice.hide).not.toHaveBeenCalled();
    expect(currentNotice.messageEl.textContent).toBe('Working');
  });

  it('should rewrite only its own message when an appended delayed notice updates', async () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    component.showNotice('alpha');
    const currentNotice = ensureNonNullable(mocks.instances[0]);

    const handle = component.showNoticeAfterDelay({
      content: 'Merging 1/10',
      delayInMilliseconds: DELAY_IN_MILLISECONDS,
      mode: PluginNoticeMode.Append
    });
    await vi.advanceTimersByTimeAsync(DELAY_IN_MILLISECONDS);
    component.showNotice('bravo', { mode: PluginNoticeMode.Append });

    handle.setContent('Merging 7/10');

    // Its own message is updated; the message appended after it is untouched.
    expect(currentNotice.messageEl.textContent).toBe('Merging 7/10bravo');
  });

  it('should remove only its own message when an appended delayed notice is disposed', async () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();
    component.showNotice('alpha');
    const currentNotice = ensureNonNullable(mocks.instances[0]);

    const handle = component.showNoticeAfterDelay({
      content: 'Working',
      delayInMilliseconds: DELAY_IN_MILLISECONDS,
      mode: PluginNoticeMode.Append
    });
    await vi.advanceTimersByTimeAsync(DELAY_IN_MILLISECONDS);

    dispose(handle);

    // The notice belongs to whoever opened it, so it stays up — only the progress message goes.
    expect(currentNotice.hide).not.toHaveBeenCalled();
    expect(currentNotice.messageEl.textContent).toBe('');
  });

  // Resolving the content is asynchronous, so an operation reporting progress can call `setContent`
  // While the notice is still being built. There is no notice to rewrite at that point, so the update
  // Would be lost and the notice would open showing the message it started with — the newer message
  // Replaced by the older one.
  it('should open with the latest content when setContent lands while the content is resolving', async () => {
    const component = new PluginNoticeComponent({ app, pluginName: PLUGIN_NAME });
    component.load();

    let releaseContent = noop;
    const contentGate = new Promise<void>((resolve) => {
      releaseContent = resolve;
    });

    const handle = component.showNoticeAfterDelay({
      content: async (): Promise<string> => {
        await contentGate;
        return 'Opening';
      },
      delayInMilliseconds: DELAY_IN_MILLISECONDS
    });

    await vi.advanceTimersByTimeAsync(DELAY_IN_MILLISECONDS);
    // The delay has elapsed but the content is still resolving, so nothing is on screen to update.
    expect(mocks.NoticeMock).not.toHaveBeenCalled();

    handle.setContent('Downloading');
    releaseContent();
    await waitForAllAsyncOperations();

    const content = castTo<DocumentFragment>(mocks.NoticeMock.mock.calls[0]?.[0]);
    expect(content.textContent).toBe('My Plugin\nDownloading');
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

    dispose(handle);

    // Disposing the delayed handle hides its own (already-replaced) notice but must not touch the newer one.
    expect(newerNotice?.hide).not.toHaveBeenCalled();
    component.unload();
    expect(newerNotice?.hide).toHaveBeenCalledTimes(1);
  });
});
