import type {
  App,
  WorkspaceContainer,
  WorkspaceLeaf,
  WorkspaceRoot
} from 'obsidian';

import {
  describe,
  expect,
  it
} from 'vitest';

import { strictProxy } from '../strict-proxy.ts';
import {
  ensureLayoutReady,
  getAllContainers,
  getAllDomWindows,
  getMainWindow,
  switchToMainWindow,
  switchToWindow
} from './workspace.ts';

function createMockApp(containers: WorkspaceContainer[]): App {
  const leaves = containers.map((container) =>
    strictProxy<WorkspaceLeaf>({
      getContainer: (): WorkspaceContainer => container
    })
  );
  return strictProxy<App>({
    workspace: {
      iterateAllLeaves: (callback: (leaf: WorkspaceLeaf) => void): void => {
        for (const leaf of leaves) {
          callback(leaf);
        }
      }
    }
  });
}

function createMockAppWithMainWindow(mainWindow: Window): App {
  return strictProxy<App>({
    workspace: {
      rootSplit: strictProxy<WorkspaceRoot>({ win: mainWindow })
    }
  });
}

function createMockContainer(win: Window): WorkspaceContainer {
  return strictProxy<WorkspaceContainer>({ win });
}

// A stand-in for a window Obsidian could make active. Only `document` is reachable: that is all the
// Window-switching helpers read, and the strict proxy turns any other access into a failure.
function createMockWindow(): Window {
  return strictProxy<Window>({ document: strictProxy<Document>({}) });
}

describe('ensureLayoutReady', () => {
  it('should resolve once the layout-ready callback fires', async () => {
    let layoutReadyCallback: (() => void) | undefined;
    const app = strictProxy<App>({
      workspace: {
        onLayoutReady: (callback: () => void): void => {
          layoutReadyCallback = callback;
        }
      }
    });

    let isResolved = false;
    const promise = ensureLayoutReady(app).then(() => {
      isResolved = true;
    });

    expect(isResolved).toBe(false);
    layoutReadyCallback?.();
    await promise;
    expect(isResolved).toBe(true);
  });

  it('should resolve when the layout is already ready', async () => {
    const app = strictProxy<App>({
      workspace: {
        onLayoutReady: (callback: () => void): void => {
          callback();
        }
      }
    });

    await expect(ensureLayoutReady(app)).resolves.toBeUndefined();
  });
});

describe('getAllContainers', () => {
  it('should return all unique containers', () => {
    const container1 = createMockContainer(strictProxy<Window>({}));
    const container2 = createMockContainer(strictProxy<Window>({}));
    const app = createMockApp([container1, container2]);
    const result = getAllContainers(app);
    expect(result).toHaveLength(2);
    expect(result).toContain(container1);
    expect(result).toContain(container2);
  });

  it('should deduplicate containers', () => {
    const container = createMockContainer(strictProxy<Window>({}));
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
    const win1 = strictProxy<Window>({});
    const win2 = strictProxy<Window>({});
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

describe('getMainWindow', () => {
  it('should return the root split window', () => {
    const mainWindow = createMockWindow();
    expect(getMainWindow(createMockAppWithMainWindow(mainWindow))).toBe(mainWindow);
  });
});

describe('switchToMainWindow', () => {
  it('should activate the main window even while a popout window is active', () => {
    const mainWindow = createMockWindow();
    const app = createMockAppWithMainWindow(mainWindow);

    const popoutSwitch = switchToWindow(createMockWindow());
    const mainWindowSwitch = switchToMainWindow(app);
    expect(activeWindow).toBe(mainWindow);
    expect(activeDocument).toBe(mainWindow.document);

    mainWindowSwitch.dispose();
    popoutSwitch.dispose();
  });
});

describe('switchToWindow', () => {
  it('should activate the window until disposed, then restore the previous one', () => {
    const previousActiveWindow = activeWindow;
    const previousActiveDocument = activeDocument;
    const otherWindow = createMockWindow();

    const windowSwitch = switchToWindow(otherWindow);
    expect(activeWindow).toBe(otherWindow);
    expect(activeDocument).toBe(otherWindow.document);

    windowSwitch.dispose();
    expect(activeWindow).toBe(previousActiveWindow);
    expect(activeDocument).toBe(previousActiveDocument);
  });

  // Each switch remembers the window that was active when IT was made, so unwinding nested switches in
  // Reverse order walks back through them rather than jumping straight to the outermost one.
  it('should restore nested switches one level at a time', () => {
    const previousActiveWindow = activeWindow;
    const outerWindow = createMockWindow();
    const innerWindow = createMockWindow();

    const outerSwitch = switchToWindow(outerWindow);
    const innerSwitch = switchToWindow(innerWindow);
    expect(activeWindow).toBe(innerWindow);

    innerSwitch.dispose();
    expect(activeWindow).toBe(outerWindow);

    outerSwitch.dispose();
    expect(activeWindow).toBe(previousActiveWindow);
  });

  // A second dispose must not re-apply the restore: it would overwrite whatever window became active in
  // The meantime with a stale one.
  it('should ignore a repeated dispose', () => {
    const windowSwitch = switchToWindow(createMockWindow());
    windowSwitch.dispose();

    const laterWindow = createMockWindow();
    const laterSwitch = switchToWindow(laterWindow);
    windowSwitch.dispose();
    expect(activeWindow).toBe(laterWindow);

    laterSwitch.dispose();
  });
});
