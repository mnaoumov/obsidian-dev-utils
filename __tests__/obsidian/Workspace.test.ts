import type {
  App,
  WorkspaceContainer,
  WorkspaceLeaf
} from 'obsidian';

import {
  describe,
  expect,
  it
} from 'vitest';

import { castTo } from '../../src/ObjectUtils.ts';
import {
  getAllContainers,
  getAllDomWindows
} from '../../src/obsidian/Workspace.ts';

function createMockContainer(win: Window): WorkspaceContainer {
  return castTo<WorkspaceContainer>({ win });
}

function createMockApp(containers: WorkspaceContainer[]): App {
  const leaves = containers.map((container) =>
    castTo<WorkspaceLeaf>({
      getContainer: (): WorkspaceContainer => container
    })
  );
  return castTo<App>({
    workspace: {
      iterateAllLeaves: (callback: (leaf: WorkspaceLeaf) => void): void => {
        for (const leaf of leaves) {
          callback(leaf);
        }
      }
    }
  });
}

describe('getAllContainers', () => {
  it('should return all unique containers', () => {
    const container1 = createMockContainer({} as Window);
    const container2 = createMockContainer({} as Window);
    const app = createMockApp([container1, container2]);
    const result = getAllContainers(app);
    expect(result).toHaveLength(2);
    expect(result).toContain(container1);
    expect(result).toContain(container2);
  });

  it('should deduplicate containers', () => {
    const container = createMockContainer({} as Window);
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
    const app = createMockApp([createMockContainer(win1), createMockContainer(win2)]);
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
