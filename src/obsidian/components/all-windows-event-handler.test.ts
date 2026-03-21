import type {
  App,
  Component,
  EventRef,
  Workspace,
  WorkspaceContainer,
  WorkspaceLeaf
} from 'obsidian';
import type { PartialDeep } from 'type-fest';

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { castTo } from '../../object-utils.ts';
import { strictProxy } from '../../test-helpers/mock-implementation.ts';
import { AllWindowsEventHandler } from './all-windows-event-handler.ts';

interface MockComponent {
  component: Component;
  registerDomEvent: ReturnType<typeof vi.fn>;
  registerEvent: ReturnType<typeof vi.fn>;
}

type WindowOpenCallback = (workspaceWindow: { win: Window }) => void;

function createMockApp(params: {
  domWindows?: Window[];
  onLayoutReady?: (callback: () => void) => void;
  onWindowOpen?: Workspace['on'];
}): App {
  const {
    domWindows = [],
    onLayoutReady = (cb: () => void): void => {
      cb();
    },
    onWindowOpen = vi.fn().mockReturnValue(strictProxy<EventRef>({}))
  } = params;

  const containers = domWindows.map((win) => strictProxy<WorkspaceContainer>({ win: castTo<PartialDeep<Window>>(win) }));
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

function createMockComponent(): MockComponent {
  const registerDomEvent = vi.fn();
  const registerEvent = vi.fn();
  return {
    component: castTo<Component>({ registerDomEvent, registerEvent }),
    registerDomEvent,
    registerEvent
  };
}

describe('AllWindowsEventHandler', () => {
  describe('registerAllWindowsHandler', () => {
    it('should call handler immediately with main window', () => {
      const app = createMockApp({});
      const mock = createMockComponent();
      const handler = vi.fn();

      new AllWindowsEventHandler(app, mock.component).registerAllWindowsHandler(handler);

      expect(handler).toHaveBeenCalledWith(window);
    });

    it('should call handler for existing popup windows after layout ready', () => {
      const popupWin = strictProxy<Window>({});
      const app = createMockApp({ domWindows: [window, popupWin] });
      const mock = createMockComponent();
      const handler = vi.fn();

      new AllWindowsEventHandler(app, mock.component).registerAllWindowsHandler(handler);

      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenCalledWith(popupWin);
    });

    it('should skip main window in popup windows iteration', () => {
      const app = createMockApp({ domWindows: [window] });
      const mock = createMockComponent();
      const handler = vi.fn();

      new AllWindowsEventHandler(app, mock.component).registerAllWindowsHandler(handler);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(window);
    });

    it('should call handler for future popup windows on window-open event', () => {
      let windowOpenCallback: undefined | WindowOpenCallback;
      const onWindowOpen = vi.fn().mockImplementation((_event: string, cb: WindowOpenCallback) => {
        windowOpenCallback = cb;
        return strictProxy<EventRef>({});
      }) as Workspace['on'];
      const app = createMockApp({ onWindowOpen });
      const mock = createMockComponent();
      const handler = vi.fn();

      new AllWindowsEventHandler(app, mock.component).registerAllWindowsHandler(handler);

      expect(windowOpenCallback).toBeDefined();
      const newWin = strictProxy<Window>({});
      windowOpenCallback?.({ win: newWin });
      expect(handler).toHaveBeenCalledWith(newWin);
    });

    it('should register window-open event on the component', () => {
      const app = createMockApp({});
      const mock = createMockComponent();
      const handler = vi.fn();

      new AllWindowsEventHandler(app, mock.component).registerAllWindowsHandler(handler);

      expect(mock.registerEvent).toHaveBeenCalled();
    });

    it('should defer popup window handling until layout is ready', () => {
      let layoutReadyCallback: (() => void) | undefined;
      const popupWin = strictProxy<Window>({});
      const app = createMockApp({
        domWindows: [window, popupWin],
        onLayoutReady: (cb: () => void): void => {
          layoutReadyCallback = cb;
        }
      });
      const mock = createMockComponent();
      const handler = vi.fn();

      new AllWindowsEventHandler(app, mock.component).registerAllWindowsHandler(handler);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(window);

      layoutReadyCallback?.();
      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenCalledWith(popupWin);
    });
  });

  describe('registerAllWindowsDomEvent', () => {
    it('should register DOM event on all windows', () => {
      const app = createMockApp({});
      const mock = createMockComponent();
      const callback = vi.fn();

      new AllWindowsEventHandler(app, mock.component).registerAllWindowsDomEvent('click', callback);

      expect(mock.registerDomEvent).toHaveBeenCalledWith(window, 'click', callback, undefined);
    });

    it('should pass options to registerDomEvent', () => {
      const app = createMockApp({});
      const mock = createMockComponent();
      const callback = vi.fn();
      const options = { capture: true };

      new AllWindowsEventHandler(app, mock.component).registerAllWindowsDomEvent('click', callback, options);

      expect(mock.registerDomEvent).toHaveBeenCalledWith(window, 'click', callback, options);
    });
  });

  describe('registerAllDocumentsDomEvent', () => {
    it('should register DOM event on all documents', () => {
      const app = createMockApp({});
      const mock = createMockComponent();
      const callback = vi.fn();

      new AllWindowsEventHandler(app, mock.component).registerAllDocumentsDomEvent('click', callback);

      expect(mock.registerDomEvent).toHaveBeenCalledWith(window.document, 'click', callback, undefined);
    });

    it('should pass options to registerDomEvent', () => {
      const app = createMockApp({});
      const mock = createMockComponent();
      const callback = vi.fn();
      const options = { passive: true };

      new AllWindowsEventHandler(app, mock.component).registerAllDocumentsDomEvent('click', callback, options);

      expect(mock.registerDomEvent).toHaveBeenCalledWith(window.document, 'click', callback, options);
    });
  });
});
