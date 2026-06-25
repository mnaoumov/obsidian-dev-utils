import type { Notice as NoticeOriginal } from 'obsidian';

import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { castTo } from '../../object-utils.ts';
import { PluginNoticeComponent } from './plugin-notice-component.ts';

interface NoticeInstance {
  hide: ReturnType<typeof vi.fn>;
}

interface StateWrapper {
  value: unknown;
}

const PERMANENT_NOTICES_STATE_KEY = 'plugin-notice-component:permanent-notices';
const PLUGIN_NAME = 'My Plugin';

const mocks = vi.hoisted(() => {
  const instances: NoticeInstance[] = [];
  const NoticeMock = vi.fn(function noticeMock(this: NoticeInstance, ..._args: unknown[]) {
    this.hide = vi.fn();
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
    const component = new PluginNoticeComponent(PLUGIN_NAME);
    component.load();
    component.showNotice('Something happened');
    expect(mocks.NoticeMock).toHaveBeenCalledWith('My Plugin\nSomething happened', undefined);
  });

  it('should return the created notice', () => {
    const component = new PluginNoticeComponent(PLUGIN_NAME);
    component.load();
    const notice = component.showNotice('Something happened');
    expect(notice).toBe(mocks.instances[0]);
  });

  it('should mark the notice as unloaded when shown while not loaded', () => {
    const component = new PluginNoticeComponent(PLUGIN_NAME);
    component.showNotice('Something happened');
    expect(mocks.NoticeMock).toHaveBeenCalledWith('My Plugin (unloaded)\nSomething happened', undefined);
  });

  it('should hide previous notice when showing a new one', () => {
    const component = new PluginNoticeComponent(PLUGIN_NAME);
    component.load();

    component.showNotice('First');
    const firstNotice = mocks.instances[0];

    component.showNotice('Second');
    expect(firstNotice?.hide).toHaveBeenCalled();
    expect(mocks.NoticeMock).toHaveBeenCalledTimes(2);
  });

  it('should not call hide if no previous notice exists', () => {
    const component = new PluginNoticeComponent(PLUGIN_NAME);
    component.load();
    component.showNotice('First');
    expect(mocks.NoticeMock).toHaveBeenCalledTimes(1);
  });

  it('should hide the current notice on unload', () => {
    const component = new PluginNoticeComponent(PLUGIN_NAME);
    component.load();
    component.showNotice('Persistent');
    const notice = mocks.instances[0];

    component.unload();

    expect(notice?.hide).toHaveBeenCalled();
  });

  it('should not throw on unload when no notice was shown', () => {
    const component = new PluginNoticeComponent(PLUGIN_NAME);
    component.load();

    expect(() => {
      component.unload();
    }).not.toThrow();
  });

  it('should hide the current notice when a permanent notice is shown', () => {
    const component = new PluginNoticeComponent(PLUGIN_NAME);
    component.load();
    component.showNotice('Usual');
    const usualNotice = mocks.instances[0];

    component.showNotice('Persistent', { isPermanent: true });

    expect(usualNotice?.hide).toHaveBeenCalled();
  });

  it('should show a permanent notice with an infinite duration and store it by plugin name', () => {
    const component = new PluginNoticeComponent(PLUGIN_NAME);
    component.load();
    component.showNotice('Persistent', { isPermanent: true });
    expect(mocks.NoticeMock).toHaveBeenCalledWith('My Plugin\nPersistent', 0);
    expect(getPermanentNotices().get(PLUGIN_NAME)).toBe(mocks.instances[0]);
  });

  it('should not hide a permanent notice on unload', () => {
    const component = new PluginNoticeComponent(PLUGIN_NAME);
    component.load();
    component.showNotice('Persistent', { isPermanent: true });
    const notice = mocks.instances[0];

    component.unload();

    expect(notice?.hide).not.toHaveBeenCalled();
  });

  it('should hide the previous permanent notice when another notice is shown', () => {
    const component = new PluginNoticeComponent(PLUGIN_NAME);
    component.load();
    component.showNotice('First', { isPermanent: true });
    const firstPermanentNotice = mocks.instances[0];

    component.showNotice('Second');

    expect(firstPermanentNotice?.hide).toHaveBeenCalled();
  });

  it('should dismiss a permanent notice left over from a previous load', () => {
    const staleNotice: NoticeInstance = { hide: vi.fn() };
    stateMocks.store.set(PERMANENT_NOTICES_STATE_KEY, { value: new Map([[PLUGIN_NAME, staleNotice]]) });

    const component = new PluginNoticeComponent(PLUGIN_NAME);
    component.load();

    expect(staleNotice.hide).toHaveBeenCalledTimes(1);
    expect(getPermanentNotices().has(PLUGIN_NAME)).toBe(false);
  });

  it('should support a document fragment message', () => {
    const component = new PluginNoticeComponent(PLUGIN_NAME);
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
