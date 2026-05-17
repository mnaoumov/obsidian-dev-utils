import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { PluginNoticeComponent } from './plugin-notice-component.ts';

interface NoticeInstance {
  hide: ReturnType<typeof vi.fn>;
}

const mocks = vi.hoisted(() => {
  const instances: NoticeInstance[] = [];
  const NoticeMock = vi.fn(function noticeMock(this: NoticeInstance) {
    this.hide = vi.fn();
    instances.push(this);
  }) as never;
  return { instances, NoticeMock };
});

vi.mock('obsidian', async (importOriginal) => {
  const actual = await importOriginal<typeof import('obsidian')>();
  return {
    ...actual,
    Notice: mocks.NoticeMock
  };
});

describe('PluginNoticeComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.instances.length = 0;
  });

  it('should show a notice with plugin name prefix', () => {
    const component = new PluginNoticeComponent('My Plugin');
    component.showNotice('Something happened');
    expect(mocks.NoticeMock).toHaveBeenCalledWith('My Plugin\nSomething happened');
  });

  it('should hide previous notice when showing a new one', () => {
    const component = new PluginNoticeComponent('My Plugin');

    component.showNotice('First');
    const firstNotice = mocks.instances[0];

    component.showNotice('Second');
    expect(firstNotice?.hide).toHaveBeenCalled();
    expect(mocks.NoticeMock).toHaveBeenCalledTimes(2);
  });

  it('should not call hide if no previous notice exists', () => {
    const component = new PluginNoticeComponent('My Plugin');
    component.showNotice('First');
    expect(mocks.NoticeMock).toHaveBeenCalledTimes(1);
  });
});
