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

const mocks = vi.hoisted(() => {
  const instances: NoticeInstance[] = [];
  const NoticeMock = vi.fn(function noticeMock(this: NoticeInstance) {
    this.hide = vi.fn();
    instances.push(this);
  });
  return { instances, NoticeMock };
});

vi.mock('obsidian', async (importOriginal) => {
  const actual = await importOriginal<typeof import('obsidian')>();
  return {
    ...actual,
    Notice: castTo<typeof NoticeOriginal>(mocks.NoticeMock)
  };
});

describe('PluginNoticeComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.instances.length = 0;
  });

  it('should show a notice with plugin name prefix', () => {
    const component = new PluginNoticeComponent('My Plugin');
    component.load();
    component.showNotice('Something happened');
    expect(mocks.NoticeMock).toHaveBeenCalledWith('My Plugin\nSomething happened');
  });

  it('should hide previous notice when showing a new one', () => {
    const component = new PluginNoticeComponent('My Plugin');
    component.load();

    component.showNotice('First');
    const firstNotice = mocks.instances[0];

    component.showNotice('Second');
    expect(firstNotice?.hide).toHaveBeenCalled();
    expect(mocks.NoticeMock).toHaveBeenCalledTimes(2);
  });

  it('should not call hide if no previous notice exists', () => {
    const component = new PluginNoticeComponent('My Plugin');
    component.load();
    component.showNotice('First');
    expect(mocks.NoticeMock).toHaveBeenCalledTimes(1);
  });

  it('should hide the current notice on unload', () => {
    const component = new PluginNoticeComponent('My Plugin');
    component.load();
    component.showNotice('Persistent');
    const notice = mocks.instances[0];

    component.unload();

    expect(notice?.hide).toHaveBeenCalled();
  });

  it('should not throw on unload when no notice was shown', () => {
    const component = new PluginNoticeComponent('My Plugin');
    component.load();

    expect(() => {
      component.unload();
    }).not.toThrow();
  });
});
