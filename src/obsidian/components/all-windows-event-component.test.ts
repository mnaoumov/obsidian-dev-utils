import type {
  App,
  EventRef,
  Workspace,
  WorkspaceContainer,
  WorkspaceLeaf,
  WorkspaceWindow
} from 'obsidian';

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { strictProxy } from '../../strict-proxy.ts';
import { AllWindowsEventComponent } from './all-windows-event-component.ts';

interface CreateMockAppParams {
  readonly domWindows?: Window[];
  onLayoutReady?(callback: () => void): void;
  readonly onWindowOpen?: Workspace['on'];
}

type WindowOpenCallback = (workspaceWindow: WorkspaceWindow) => void;

function createLoadedComponent(app: App): AllWindowsEventComponent {
  const component = new AllWindowsEventComponent(app);
  component.load();
  return component;
}

function createMockApp(params: CreateMockAppParams): App {
  const {
    domWindows = [],
    onLayoutReady = (cb: () => void): void => {
      cb();
    },
    onWindowOpen = vi.fn().mockReturnValue(strictProxy<EventRef>({}))
  } = params;

  const containers = domWindows.map((win) => strictProxy<WorkspaceContainer>({ win }));
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
      },
      on: onWindowOpen,
      onLayoutReady
    }
  });
}

describe('AllWindowsEventComponent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('registerAllWindowsHandler', () => {
    it('should call handler immediately with main window', () => {
      const app = createMockApp({});
      const handler = vi.fn();

      createLoadedComponent(app).registerAllWindowsHandler(handler);

      expect(handler).toHaveBeenCalledWith(activeWindow);
    });

    it('should throw when registering a handler before the component is loaded', () => {
      const app = createMockApp({});
      const handler = vi.fn();

      expect(() => {
        new AllWindowsEventComponent(app).registerAllWindowsHandler(handler);
      }).toThrow('Component is not loaded');
    });

    it('should call handler for existing popup windows after layout ready', () => {
      const popupWin = strictProxy<Window>({});
      const app = createMockApp({ domWindows: [activeWindow, popupWin] });
      const handler = vi.fn();

      createLoadedComponent(app).registerAllWindowsHandler(handler);
      vi.runAllTimers();

      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenCalledWith(popupWin);
    });

    it('should skip main window in popup windows iteration', () => {
      const app = createMockApp({ domWindows: [activeWindow] });
      const handler = vi.fn();

      createLoadedComponent(app).registerAllWindowsHandler(handler);
      vi.runAllTimers();

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(activeWindow);
    });

    it('should call handler for future popup windows on window-open event', () => {
      let windowOpenCallback: undefined | WindowOpenCallback;
      const onWindowOpen = vi.fn().mockImplementation((_event: string, cb: WindowOpenCallback) => {
        windowOpenCallback = cb;
        return strictProxy<EventRef>({});
      }) as Workspace['on'];
      const app = createMockApp({ onWindowOpen });
      const handler = vi.fn();

      createLoadedComponent(app).registerAllWindowsHandler(handler);
      vi.runAllTimers();

      expect(windowOpenCallback).toBeDefined();
      const newWin = strictProxy<Window>({});
      const workspaceWindow = strictProxy<WorkspaceWindow>({ win: newWin });
      windowOpenCallback?.(workspaceWindow);
      expect(handler).toHaveBeenCalledWith(newWin);
    });

    it('should hand the window-open subscription to registerEvent so it is cleaned up on unload', () => {
      const eventRef = strictProxy<EventRef>({});
      const onWindowOpen = vi.fn().mockReturnValue(eventRef) as Workspace['on'];
      const app = createMockApp({ onWindowOpen });
      const component = createLoadedComponent(app);
      const registerEventSpy = vi.spyOn(component, 'registerEvent');
      const handler = vi.fn();

      component.registerAllWindowsHandler(handler);
      vi.runAllTimers();

      expect(registerEventSpy).toHaveBeenCalledWith(eventRef);
    });

    it('should register window-open event on the component', () => {
      const app = createMockApp({});
      const component = createLoadedComponent(app);
      const registerEventSpy = vi.spyOn(component, 'registerEvent');
      const handler = vi.fn();

      component.registerAllWindowsHandler(handler);
      vi.runAllTimers();

      expect(registerEventSpy).toHaveBeenCalled();
    });

    it('should defer popup window handling until layout is ready', () => {
      let layoutReadyCallback: (() => void) | undefined;
      const popupWin = strictProxy<Window>({});
      const app = createMockApp({
        domWindows: [activeWindow, popupWin],
        onLayoutReady: (cb: () => void): void => {
          layoutReadyCallback = cb;
        }
      });
      const handler = vi.fn();

      createLoadedComponent(app).registerAllWindowsHandler(handler);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(activeWindow);

      layoutReadyCallback?.();
      vi.runAllTimers();
      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenCalledWith(popupWin);
    });

    it('should skip deferred handler if component is unloaded before layout ready', () => {
      let layoutReadyCallback: (() => void) | undefined;
      const popupWin = strictProxy<Window>({});
      const app = createMockApp({
        domWindows: [activeWindow, popupWin],
        onLayoutReady: (cb: () => void): void => {
          layoutReadyCallback = cb;
        }
      });
      const component = createLoadedComponent(app);
      const handler = vi.fn();

      component.registerAllWindowsHandler(handler);

      expect(handler).toHaveBeenCalledTimes(1);

      component.unload();
      layoutReadyCallback?.();
      vi.runAllTimers();

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('registerAllWindowsDomEvent', () => {
    it('should register DOM event on all windows', () => {
      const app = createMockApp({});
      const component = createLoadedComponent(app);
      const registerDomEventSpy = vi.spyOn(component, 'registerDomEvent');
      const callback = vi.fn();

      component.registerAllWindowsDomEvent('click', callback);

      expect(registerDomEventSpy).toHaveBeenCalledWith(activeWindow, 'click', callback, undefined);
    });

    it('should pass options to registerDomEvent', () => {
      const app = createMockApp({});
      const component = createLoadedComponent(app);
      const registerDomEventSpy = vi.spyOn(component, 'registerDomEvent');
      const callback = vi.fn();
      const options = { capture: true };

      component.registerAllWindowsDomEvent('click', callback, options);

      expect(registerDomEventSpy).toHaveBeenCalledWith(activeWindow, 'click', callback, options);
    });
  });

  describe('registerAllDocumentsDomEvent', () => {
    it('should register DOM event on all documents', () => {
      const app = createMockApp({});
      const component = createLoadedComponent(app);
      const registerDomEventSpy = vi.spyOn(component, 'registerDomEvent');
      const callback = vi.fn();

      component.registerAllDocumentsDomEvent('click', callback);

      expect(registerDomEventSpy).toHaveBeenCalledWith(activeWindow.document, 'click', callback, undefined);
    });

    it('should pass options to registerDomEvent', () => {
      const app = createMockApp({});
      const component = createLoadedComponent(app);
      const registerDomEventSpy = vi.spyOn(component, 'registerDomEvent');
      const callback = vi.fn();
      const options = { passive: true };

      component.registerAllDocumentsDomEvent('click', callback, options);

      expect(registerDomEventSpy).toHaveBeenCalledWith(activeWindow.document, 'click', callback, options);
    });
  });
});
