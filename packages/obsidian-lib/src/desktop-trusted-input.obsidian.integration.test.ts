/**
 * @file
 *
 * Integration tests for the trusted CLICK helpers, against a live Obsidian instance.
 *
 * The unit tests assert the `sendInputEvent` payloads; only a real renderer can prove the point these
 * helpers exist for — that Chromium synthesizes a DOM event carrying `isTrusted === true`, which
 * `element.dispatchEvent(new MouseEvent(...))` never does and which Obsidian's own listeners gate on.
 */

/// <reference types="obsidian-integration-testing/vitest/typings" />

import { evalInObsidian } from 'obsidian-integration-testing';
import {
  describe,
  expect,
  it
} from 'vitest';

/**
 * Holds the observed event across the listener callback, so the closure can report it back.
 */
interface ObservedEventCapture {
  value: null | TrustedClickResult;
}

/**
 * What a trusted click reports back: the DOM event it produced, and whether the renderer trusted it.
 */
interface TrustedClickResult {
  readonly isTrusted: boolean;
  readonly type: string;
}

describe('trusted click helpers', () => {
  it('should make clickElement produce a click the renderer trusts', async () => {
    const result = await evalInObsidian<Record<string, never>, TrustedClickResult>({
      async callback({ app, lib: { clickElement, waitUntil } }) {
        const OBSERVED_EVENT_TIMEOUT_IN_MILLISECONDS = 5000;

        const target = app.workspace.containerEl.createDiv();
        target.setCssStyles({
          height: '40px',
          left: '10px',
          position: 'fixed',
          top: '10px',
          width: '80px',
          zIndex: '9999'
        });

        const capture: ObservedEventCapture = { value: null };
        target.addEventListener('click', (event: MouseEvent) => {
          capture.value = { isTrusted: event.isTrusted, type: event.type };
        });

        try {
          await clickElement({ element: target });
          await waitUntil({
            message: 'a trusted click to reach the target element',
            predicate: () => capture.value !== null,
            timeoutInMilliseconds: OBSERVED_EVENT_TIMEOUT_IN_MILLISECONDS
          });
        } finally {
          target.detach();
        }

        if (!capture.value) {
          throw new Error('No click event was observed.');
        }

        return capture.value;
      }
    });

    expect(result).toEqual({ isTrusted: true, type: 'click' });
  });

  it('should make a right clickMouse produce a contextmenu the renderer trusts', async () => {
    const result = await evalInObsidian<Record<string, never>, TrustedClickResult>({
      async callback({ app, lib: { clickMouse, waitUntil } }) {
        const OBSERVED_EVENT_TIMEOUT_IN_MILLISECONDS = 5000;
        const TARGET_X = 40;
        const TARGET_Y = 40;

        const target = app.workspace.containerEl.createDiv();
        target.setCssStyles({
          height: '80px',
          left: '0',
          position: 'fixed',
          top: '0',
          width: '80px',
          zIndex: '9999'
        });

        const capture: ObservedEventCapture = { value: null };
        target.addEventListener('contextmenu', (event: MouseEvent) => {
          capture.value = { isTrusted: event.isTrusted, type: event.type };
          // A real menu would otherwise open and leak into the next test.
          event.preventDefault();
        });

        try {
          await clickMouse({ button: 'right', x: TARGET_X, y: TARGET_Y });
          await waitUntil({
            message: 'a trusted right click to reach the target element',
            predicate: () => capture.value !== null,
            timeoutInMilliseconds: OBSERVED_EVENT_TIMEOUT_IN_MILLISECONDS
          });
        } finally {
          target.detach();
          // `querySelectorAll` returns a static list, so detaching while iterating is safe.
          for (const menuEl of activeDocument.querySelectorAll('.menu')) {
            menuEl.detach();
          }
        }

        if (!capture.value) {
          throw new Error('No contextmenu event was observed.');
        }

        return capture.value;
      }
    });

    expect(result).toEqual({ isTrusted: true, type: 'contextmenu' });
  });

  it('should leave a dispatched MouseEvent untrusted, which is why these helpers exist', async () => {
    const result = await evalInObsidian<Record<string, never>, TrustedClickResult>({
      callback({ app }) {
        const target = app.workspace.containerEl.createDiv();

        const capture: ObservedEventCapture = { value: null };
        target.addEventListener('click', (event: MouseEvent) => {
          capture.value = { isTrusted: event.isTrusted, type: event.type };
        });

        try {
          // The one deliberate untrusted dispatch in the codebase: it is the control case this whole
          // suite is contrasted against, so it must never be converted to a trusted helper.
          // eslint-disable-next-line obsidian-dev-utils/no-untrusted-input-events -- This IS the untrusted control case the trusted helpers are measured against; converting it would delete the assertion.
          target.dispatchEvent(new MouseEvent('click'));
        } finally {
          target.detach();
        }

        if (!capture.value) {
          throw new Error('No click event was observed.');
        }

        return capture.value;
      }
    });

    expect(result).toEqual({ isTrusted: false, type: 'click' });
  });

  /*
   * Every Obsidian popout is its own Electron web contents, so input sent through the main window's never
   * reaches it. `lib` here is this library's own flat barrel, so these cases drive THIS library's copies of
   * the helpers, not the harness's. Each case opens its own popout and detaches its leaf afterwards, which
   * closes the window.
   */
  describe('popout windows', () => {
    it('should press a key in the window it is given, and the main window by default', async () => {
      const result = await evalInObsidian<Record<string, never>, Record<string, string[]>>({
        async callback({ app, lib: { pressKey, waitUntil } }) {
          const leaf = app.workspace.openPopoutLeaf();
          try {
            const popoutWindow = leaf.getContainer().win;
            await waitUntil({ message: 'the popout to load', predicate: () => popoutWindow.document.readyState === 'complete' });

            const keys: Record<string, string[]> = { main: [], popout: [] };
            function recordMain(event: KeyboardEvent): void {
              keys['main']?.push(`${event.key}:${String(event.isTrusted)}`);
            }
            function recordPopout(event: KeyboardEvent): void {
              keys['popout']?.push(`${event.key}:${String(event.isTrusted)}`);
            }

            document.addEventListener('keydown', recordMain, { capture: true });
            popoutWindow.document.addEventListener('keydown', recordPopout, { capture: true });
            try {
              await pressKey({ key: 'Escape', window: popoutWindow });
              await waitUntil({ message: 'the key in the popout', predicate: () => keys['popout']?.length === 1 });
              await pressKey({ key: 'Escape' });
              await waitUntil({ message: 'the key in the main window', predicate: () => keys['main']?.length === 1 });
              return keys;
            } finally {
              document.removeEventListener('keydown', recordMain, { capture: true });
              popoutWindow.document.removeEventListener('keydown', recordPopout, { capture: true });
            }
          } finally {
            leaf.detach();
          }
        }
      });

      expect(result).toStrictEqual({ main: ['Escape:true'], popout: ['Escape:true'] });
    });

    it('should type into an editor in a popout', async () => {
      const content = await evalInObsidian<Record<string, never>, string>({
        async callback({ app, lib: { typeIntoEditor, waitUntil }, obsidianModule: { MarkdownView } }) {
          const path = `desktop-trusted-input-popout-${String(Date.now())}.md`;
          const file = await app.vault.create(path, '# note\n');
          const leaf = app.workspace.openPopoutLeaf();
          try {
            await leaf.openFile(file);
            const view = leaf.view;
            if (!(view instanceof MarkdownView)) {
              throw new TypeError(`The popout opened a ${view.getViewType()} view, not a markdown one.`);
            }

            await waitUntil({ message: 'the popout to load', predicate: () => leaf.getContainer().doc.readyState === 'complete' });
            await typeIntoEditor({ editor: view.editor, text: 'typed' });
            return view.editor.getValue();
          } finally {
            leaf.detach();
            await app.fileManager.trashFile(file);
          }
        }
      });

      expect(content).toBe('# note\ntyped');
    });

    it('should click an element in a popout in that popout', async () => {
      const result = await evalInObsidian<Record<string, never>, TrustedClickResult[]>({
        async callback({ app, lib: { clickElement, waitUntil } }) {
          const leaf = app.workspace.openPopoutLeaf();
          try {
            const popoutDocument = leaf.getContainer().doc;
            await waitUntil({ message: 'the popout to load', predicate: () => popoutDocument.readyState === 'complete' });

            const target = popoutDocument.body.createDiv();
            target.setCssStyles({ height: '80px', left: '24px', position: 'fixed', top: '120px', width: '160px', zIndex: '2147483647' });
            const observed: TrustedClickResult[] = [];
            target.addEventListener('click', (event: MouseEvent) => {
              observed.push({ isTrusted: event.isTrusted, type: event.type });
            });

            await clickElement({ element: target });
            await waitUntil({ message: 'the click in the popout', predicate: () => observed.length > 0 });
            return observed;
          } finally {
            leaf.detach();
          }
        }
      });

      expect(result).toStrictEqual([{ isTrusted: true, type: 'click' }]);
    });

    // An iframe's window has no Electron bridge, so there is no web contents to inject into. Saying so beats
    // delivering the key to the main window, which is what the helper would otherwise have done.
    it('should refuse a window that has no Electron bridge', async () => {
      const message = await evalInObsidian<Record<string, never>, string>({
        async callback({ lib: { pressKey } }) {
          const frame = document.body.createEl('iframe');
          try {
            const frameWindow = frame.contentWindow;
            if (!frameWindow) {
              throw new Error('The iframe has no window.');
            }

            await pressKey({ key: 'Escape', window: frameWindow });
            return '';
          } catch (error) {
            return error instanceof Error ? error.message : String(error);
          } finally {
            frame.remove();
          }
        }
      });

      expect(message).toContain('no Electron bridge');
    });
  });
});
