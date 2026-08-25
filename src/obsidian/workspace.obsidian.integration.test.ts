/**
 * @file
 *
 * Integration tests for the window-switching helpers in `workspace.ts`.
 *
 * Obsidian opens Settings in a POPOUT WINDOW and points the `activeWindow` / `activeDocument` globals at
 * it while it is open, so window-sensitive UI built then lands in the settings window and disappears
 * with it. Only a real Obsidian has that popout — jsdom has a single window — so `switchToMainWindow` is
 * verified here, against a real settings window and a real `Notice`.
 */

/// <reference types="obsidian-integration-testing/vitest/typings" />

import { evalInObsidian } from 'obsidian-integration-testing';
import {
  describe,
  expect,
  it
} from 'vitest';

// Where each of the two notices was built, plus the settings-window state the answers only mean
// Something against.
interface NoticeWindowsResult {
  readonly isPinnedNoticeInMainWindow: boolean;
  readonly isPlainNoticeInSettingsWindow: boolean;
  readonly isSettingsWindowSeparate: boolean;
  readonly wasMainWindowRestored: boolean;
}

const TEST_TIMEOUT_IN_MILLISECONDS = 60_000;

describe('switchToMainWindow', () => {
  it('should build a notice in the main window while the settings window is active', async () => {
    const result = await evalInObsidian<Record<string, never>, NoticeWindowsResult>({
      async callback({ app, lib: { getMainWindow, switchToMainWindow, waitUntil }, obsidianModule: { Notice } }): Promise<NoticeWindowsResult> {
        const SETTINGS_WINDOW_TIMEOUT_IN_MILLISECONDS = 15_000;
        // `0` keeps a notice up until it is clicked; both probes are hidden explicitly below.
        const PERMANENT_NOTICE_DURATION_IN_MILLISECONDS = 0;

        app.setting.open();
        try {
          // Obsidian builds the popout and focuses it asynchronously, and the focus is what moves
          // `activeWindow` — which is the whole condition under test.
          await waitUntil({
            message: 'the settings window to become the active window',
            predicate: (): boolean => activeWindow !== window,
            timeoutInMilliseconds: SETTINGS_WINDOW_TIMEOUT_IN_MILLISECONDS
          });
          const settingsWindow = activeWindow;

          // The control: a plain notice goes wherever Obsidian is pointing, which is what put the
          // Demo-vault sandbox notice in the settings window. Without it a passing test could mean the
          // Settings window was never active in the first place.
          const plainNotice = new Notice('Plain probe', PERMANENT_NOTICE_DURATION_IN_MILLISECONDS);
          const plainNoticeDocument = plainNotice.containerEl.ownerDocument;
          plainNotice.hide();

          const mainWindowSwitch = switchToMainWindow(app);
          let pinnedNoticeDocument: Document;
          try {
            const pinnedNotice = new Notice('Pinned probe', PERMANENT_NOTICE_DURATION_IN_MILLISECONDS);
            pinnedNoticeDocument = pinnedNotice.containerEl.ownerDocument;
            pinnedNotice.hide();
          } finally {
            mainWindowSwitch.dispose();
          }

          return {
            isPinnedNoticeInMainWindow: pinnedNoticeDocument === document,
            isPlainNoticeInSettingsWindow: plainNoticeDocument === settingsWindow.document,
            isSettingsWindowSeparate: settingsWindow !== window,
            wasMainWindowRestored: activeWindow === settingsWindow
          };
        } finally {
          app.setting.close();
          // Closing the popout is NOT enough. Obsidian moves the `activeWindow` / `activeDocument`
          // Globals on window FOCUS, and this owned test window is hidden off-screen — so nothing ever
          // Focuses it back and the globals stay pinned to the settings window that was just destroyed.
          // Every later test in this SHARED instance builds its UI in `activeDocument`, so leaving them
          // There makes unrelated modal and popover files render into a dead window and time out (T600).
          const mainWindow = getMainWindow(app);
          window.activeWindow = mainWindow;
          window.activeDocument = mainWindow.document;
        }
      }
    });

    expect(result.isSettingsWindowSeparate).toBe(true);
    expect(result.isPlainNoticeInSettingsWindow).toBe(true);
    expect(result.isPinnedNoticeInMainWindow).toBe(true);
    // The switch is scoped to what it wraps: the settings window is active again once it is disposed.
    expect(result.wasMainWindowRestored).toBe(true);
  }, TEST_TIMEOUT_IN_MILLISECONDS);
});
