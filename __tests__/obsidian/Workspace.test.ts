import type { App } from 'obsidian';

import {
  describe,
  expect,
  it
} from 'vitest';

import {
  getAllContainers,
  getAllDomWindows
} from '../../src/obsidian/Workspace.ts';

function createMockApp(containers: { win: Window }[]): App {
  const leaves = containers.map((container) => ({
    getContainer: (): { win: Window } => container
  }));
  return {
    workspace: {
      iterateAllLeaves: (callback: (leaf: { getContainer(): { win: Window } }) => void): void => {
        for (const leaf of leaves) {
          callback(leaf);
        }
      }
    }
  } as unknown as App;
}

describe('getAllContainers', () => {
  it('should return all unique containers', () => {
    const container1 = { win: {} as Window };
    const container2 = { win: {} as Window };
    const app = createMockApp([container1, container2]);
    const result = getAllContainers(app);
    expect(result).toHaveLength(2);
    expect(result).toContain(container1);
    expect(result).toContain(container2);
  });

  it('should deduplicate containers', () => {
    const container = { win: {} as Window };
    const app = createMockApp([container, container]);
    const result = getAllContainers(app);
    expect(result).toHaveLength(1);
  });

  it('should return empty array when no leaves exist', () => {
    const app = createMockApp([]);
    expect(getAllContainers(app)).toEqual([]);
  });
});

describe('getAllDomWindows', () => {
  it('should return windows from all containers', () => {
    const win1 = {} as Window;
    const win2 = {} as Window;
    const app = createMockApp([{ win: win1 }, { win: win2 }]);
    const result = getAllDomWindows(app);
    expect(result).toHaveLength(2);
    expect(result).toContain(win1);
    expect(result).toContain(win2);
  });

  it('should return empty array when no leaves exist', () => {
    const app = createMockApp([]);
    expect(getAllDomWindows(app)).toEqual([]);
  });
});
