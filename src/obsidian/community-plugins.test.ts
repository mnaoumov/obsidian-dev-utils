import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { getCommunityPluginRepo } from './community-plugins.ts';

const { mockRequestUrl } = vi.hoisted(() => ({
  mockRequestUrl: vi.fn()
}));

vi.mock('obsidian', async (importOriginal) => {
  const actual = await importOriginal<typeof import('obsidian')>();
  return {
    ...actual,
    requestUrl: mockRequestUrl
  };
});

const REGISTRY = [
  {
    author: 'Author A',
    description: 'Description A',
    id: 'plugin-a',
    name: 'Plugin A',
    repo: 'owner-a/plugin-a'
  },
  {
    author: 'Author B',
    description: 'Description B',
    id: 'plugin-b',
    name: 'Plugin B',
    repo: 'owner-b/plugin-b'
  }
];

beforeEach(() => {
  vi.clearAllMocks();
  mockRequestUrl.mockResolvedValue({ json: REGISTRY });
});

describe('getCommunityPluginRepo', () => {
  it('should return the repo for a listed plugin', async () => {
    expect(await getCommunityPluginRepo('plugin-b')).toBe('owner-b/plugin-b');
  });

  it('should return null for an unlisted plugin', async () => {
    expect(await getCommunityPluginRepo('missing-plugin')).toBeNull();
  });

  it('should fetch the registry only once across calls', async () => {
    await getCommunityPluginRepo('plugin-a');
    await getCommunityPluginRepo('plugin-b');
    expect(mockRequestUrl).toHaveBeenCalledTimes(1);
  });

  it('should not cache a failed fetch and retry on the next call', async () => {
    mockRequestUrl.mockRejectedValueOnce(new Error('network down'));
    await expect(getCommunityPluginRepo('plugin-a')).rejects.toThrow('network down');
    expect(await getCommunityPluginRepo('plugin-a')).toBe('owner-a/plugin-a');
    expect(mockRequestUrl).toHaveBeenCalledTimes(2);
  });
});
