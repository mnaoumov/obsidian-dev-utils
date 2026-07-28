// @vitest-environment jsdom

import type {
  App,
  EventRef,
  WorkspaceContainer,
  WorkspaceLeaf
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
import { PointerPositionComponent } from './pointer-position-component.ts';

function createLoadedComponent(app: App): PointerPositionComponent {
  const component = new PointerPositionComponent(app);
  component.load();
  return component;
}

function createMockApp(domWindows: Window[]): App {
  const leaves = domWindows.map((win) => {
    const container = strictProxy<WorkspaceContainer>({ win });
    return strictProxy<WorkspaceLeaf>({
      getContainer: (): WorkspaceContainer => container
    });
  });

  return strictProxy<App>({
    workspace: {
      iterateAllLeaves: (callback: (leaf: WorkspaceLeaf) => void): void => {
        for (const leaf of leaves) {
          callback(leaf);
        }
      },
      on: vi.fn().mockReturnValue(strictProxy<EventRef>({})),
      onLayoutReady: (cb: () => void): void => {
        cb();
      }
    }
  });
}

function startPointerGesture(doc: Document, x: number, y: number): void {
  doc.body.dispatchEvent(
    new MouseEvent('pointerdown', {
      bubbles: true,
      clientX: x,
      clientY: y
    })
  );
}

describe('PointerPositionComponent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should have no anchor before any pointer gesture', () => {
    const component = createLoadedComponent(createMockApp([activeWindow]));

    expect(component.getLastPointerAnchor()).toBeNull();
  });

  it('should record the position of the last pointer gesture', () => {
    const component = createLoadedComponent(createMockApp([activeWindow]));

    startPointerGesture(document, 42, 84);

    expect(component.getLastPointerAnchor()).toStrictEqual({
      bottom: 84,
      doc: document,
      left: 42
    });
  });

  it('should overwrite the anchor on every subsequent gesture', () => {
    const component = createLoadedComponent(createMockApp([activeWindow]));

    startPointerGesture(document, 42, 84);
    startPointerGesture(document, 10, 20);

    expect(component.getLastPointerAnchor()).toStrictEqual({
      bottom: 20,
      doc: document,
      left: 10
    });
  });

  it('should anchor in the document of the pop-out window the gesture happened in', () => {
    const popupDoc = document.implementation.createHTMLDocument();
    const popupWin = strictProxy<Window>({ document: popupDoc });
    const component = createLoadedComponent(createMockApp([activeWindow, popupWin]));
    vi.runAllTimers();

    startPointerGesture(popupDoc, 7, 9);

    expect(component.getLastPointerAnchor()).toStrictEqual({
      bottom: 9,
      doc: popupDoc,
      left: 7
    });
  });

  it('should stop recording once unloaded', () => {
    const component = createLoadedComponent(createMockApp([activeWindow]));

    startPointerGesture(document, 42, 84);
    component.unload();
    startPointerGesture(document, 10, 20);

    expect(component.getLastPointerAnchor()).toStrictEqual({
      bottom: 84,
      doc: document,
      left: 42
    });
  });
});
