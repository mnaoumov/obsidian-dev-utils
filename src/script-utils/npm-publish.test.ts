import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { publish } from './npm-publish.ts';

const { mockExecFromRoot } = vi.hoisted(() => ({
  mockExecFromRoot: vi.fn()
}));

vi.mock('../script-utils/root.ts', () => ({
  execFromRoot: mockExecFromRoot
}));

beforeEach(() => {
  vi.resetAllMocks();
  mockExecFromRoot.mockResolvedValue('');
});

describe('publish', () => {
  it('should publish with latest tag', async () => {
    await publish();
    expect(mockExecFromRoot).toHaveBeenCalledWith(['npm', 'publish', '--tag', 'latest']);
  });

  it('should publish with beta tag when isBeta is true', async () => {
    await publish(true);
    expect(mockExecFromRoot).toHaveBeenCalledWith(['npm', 'publish', '--tag', 'beta']);
  });

  it('should not configure any auth token, as the publish authenticates via trusted publishing', async () => {
    await publish();
    expect(mockExecFromRoot).toHaveBeenCalledTimes(1);
  });
});
