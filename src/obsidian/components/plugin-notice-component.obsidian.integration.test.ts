/**
 * @file
 *
 * Integration test verifying that a real notice rendered by {@link PluginNoticeComponent} shows the
 * plugin name with the library's accent styling (accent color + bold weight) in a live Obsidian
 * instance, visually distinct from the message body. The unit test only asserts the DOM structure;
 * this test confirms the injected library stylesheet actually applies to the notice.
 */

/// <reference types="obsidian-integration-testing/vitest/typings" />

import { evalInObsidian } from 'obsidian-integration-testing';
import {
  describe,
  expect,
  it
} from 'vitest';

describe('PluginNoticeComponent styling', () => {
  it('should render the plugin name with the accent color and bold weight, distinct from the body', async () => {
    const result = await evalInObsidian({
      callback({ app, lib: { PluginNoticeComponent } }) {
        const component = new PluginNoticeComponent({ app, pluginName: 'My Test Plugin' });
        const notice = component.showNotice('Body text');

        try {
          const nameEl = activeDocument.querySelector('.obsidian-dev-utils.plugin-notice-name');
          if (!nameEl) {
            throw new Error('plugin name element not found in the rendered notice');
          }

          const nameStyle = activeWindow.getComputedStyle(nameEl);

          // Probe resolving the same theme variables the CSS rule uses (compare computed rgb / weight).
          const probeEl = activeDocument.body.createSpan();
          probeEl.setCssStyles({ color: 'var(--text-accent)', fontWeight: 'var(--font-bold)' });
          const probeStyle = activeWindow.getComputedStyle(probeEl);

          // Plain element inheriting the default text color, to prove the name color is distinct.
          const plainEl = activeDocument.body.createSpan();
          const defaultColor = activeWindow.getComputedStyle(plainEl).color;

          const measurement = {
            accentColor: probeStyle.color,
            boldFontWeight: probeStyle.fontWeight,
            defaultColor,
            hasLibClass: nameEl.classList.contains('obsidian-dev-utils'),
            hasNameClass: nameEl.classList.contains('plugin-notice-name'),
            nameColor: nameStyle.color,
            nameFontWeight: nameStyle.fontWeight,
            text: nameEl.textContent
          };

          probeEl.remove();
          plainEl.remove();
          return measurement;
        } finally {
          notice.hide();
        }
      }
    });

    expect(result.hasLibClass).toBe(true);
    expect(result.hasNameClass).toBe(true);
    expect(result.text).toBe('My Test Plugin');

    // The accent color is actually applied (matches `--text-accent`) and differs from the body text color.
    expect(result.nameColor).toBe(result.accentColor);
    expect(result.nameColor).not.toBe(result.defaultColor);

    // The bold weight is actually applied (matches `--font-bold`) and is not the normal weight.
    expect(result.nameFontWeight).toBe(result.boldFontWeight);
    expect(result.nameFontWeight).not.toBe('400');
  });
});

describe('PluginNoticeComponent hard-to-close notice', () => {
  it('should not dismiss on stray clicks and close directly via the close button', async () => {
    const result = await evalInObsidian({
      async callback({ app, lib: { clickMouse, PluginNoticeComponent, waitUntil } }) {
        const SETTLE_IN_MILLISECONDS = 250;
        const WAIT_TIMEOUT_IN_MILLISECONDS = 5000;

        function findLockedContentEl(): HTMLElement | null {
          const els = [...activeDocument.querySelectorAll<HTMLElement>('.obsidian-dev-utils.plugin-notice-content')];
          return els.find((element) => element.textContent.includes('Locked action')) ?? null;
        }

        const component = new PluginNoticeComponent({ app, pluginName: 'My Test Plugin' });
        let onHideCallCount = 0;
        let isOnHideUserAction = false;
        let isOnHideCloseButtonClicked = false;
        const notice = component.showNotice('Locked action', {
          onHide: (info) => {
            isOnHideUserAction = info.isUserAction;
            isOnHideCloseButtonClicked = info.isCloseButtonClicked;
            onHideCallCount += 1;
          },
          shouldHideOnClick: false
        });

        try {
          await waitUntil({
            message: 'the hard-to-close notice should render',
            predicate: () => findLockedContentEl() !== null,
            timeoutInMilliseconds: WAIT_TIMEOUT_IN_MILLISECONDS
          });

          const contentEl = findLockedContentEl();
          const { containerEl, messageEl } = notice;
          const closeButtonEl = contentEl?.querySelector<HTMLElement>('.obsidian-dev-utils.plugin-notice-close-button') ?? null;
          const hasCloseButton = closeButtonEl !== null;
          const hasRequiresExplicitCloseClass = containerEl.classList.contains('plugin-notice-requires-explicit-close');

          // A stray click on the notice body must NOT dismiss it.
          contentEl?.click();
          await sleep(SETTLE_IN_MILLISECONDS);
          const isShownAfterBodyClick = findLockedContentEl() !== null;

          // A click on the inner message element (a descendant) must NOT dismiss it — the capture-phase
          // Guard on the container stops it before Obsidian's dismiss handler runs.
          messageEl.click();
          await sleep(SETTLE_IN_MILLISECONDS);
          const isShownAfterMessageClick = findLockedContentEl() !== null;

          // A real click at the notice's very corner (where the padding used to be) must land on the
          // Guarded content and NOT dismiss it. It is a genuine trusted click at that point, so the
          // Renderer hit-tests it exactly as it would a user's.
          const rect = containerEl.getBoundingClientRect();
          clickMouse({ x: rect.left + 2, y: rect.top + 2 });
          await sleep(SETTLE_IN_MILLISECONDS);
          const isShownAfterPaddingClick = findLockedContentEl() !== null;

          // A following ordinary notice must NOT hide the standalone hard-to-close notice.
          const ordinaryNotice = component.showNotice('Ordinary notice');
          await sleep(SETTLE_IN_MILLISECONDS);
          const isShownAfterOtherNotice = findLockedContentEl() !== null;
          ordinaryNotice.hide();

          // Clicking the close button hides the notice directly — no confirmation modal.
          closeButtonEl?.click();
          await waitUntil({
            message: 'the notice should be gone after clicking the close button',
            predicate: () => findLockedContentEl() === null,
            timeoutInMilliseconds: WAIT_TIMEOUT_IN_MILLISECONDS
          });
          const isShownAfterClose = findLockedContentEl() !== null;
          const hasConfirmModal = activeDocument.querySelector('.obsidian-dev-utils.confirm-modal') !== null;
          // Let the fire-and-forget onHide callback settle after the notice was hidden.
          await sleep(SETTLE_IN_MILLISECONDS);

          return {
            hasCloseButton,
            hasConfirmModal,
            hasRequiresExplicitCloseClass,
            isShownAfterBodyClick,
            isShownAfterClose,
            isShownAfterMessageClick,
            isShownAfterOtherNotice,
            isShownAfterPaddingClick,
            onHideCallCount,
            onHideIsCloseButtonClicked: isOnHideCloseButtonClicked,
            onHideIsUserAction: isOnHideUserAction
          };
        } finally {
          notice.hide();
        }
      }
    });

    expect(result.hasCloseButton).toBe(true);
    expect(result.hasRequiresExplicitCloseClass).toBe(true);

    // Stray clicks (body, inner message, corner) and a following ordinary notice all leave it shown.
    expect(result.isShownAfterBodyClick).toBe(true);
    expect(result.isShownAfterMessageClick).toBe(true);
    expect(result.isShownAfterPaddingClick).toBe(true);
    expect(result.isShownAfterOtherNotice).toBe(true);

    // Clicking the close button hides it directly, with no confirmation modal...
    expect(result.hasConfirmModal).toBe(false);
    expect(result.isShownAfterClose).toBe(false);

    // ...and onHide fires exactly once, reporting a close-button user action.
    expect(result.onHideCallCount).toBe(1);
    expect(result.onHideIsUserAction).toBe(true);
    expect(result.onHideIsCloseButtonClicked).toBe(true);
  });

  it('should run an interactive button handler in the message without dismissing the notice', async () => {
    const result = await evalInObsidian({
      async callback({ app, lib: { PluginNoticeComponent, waitUntil } }) {
        const SETTLE_IN_MILLISECONDS = 250;
        const WAIT_TIMEOUT_IN_MILLISECONDS = 5000;

        function findActionContentEl(): HTMLElement | null {
          const els = [...activeDocument.querySelectorAll<HTMLElement>('.obsidian-dev-utils.plugin-notice-content')];
          return els.find((element) => element.textContent.includes('Action notice')) ?? null;
        }

        const component = new PluginNoticeComponent({ app, pluginName: 'My Test Plugin' });

        // A consumer embeds an action button in the message fragment.
        const message = createFragment();
        message.appendText('Action notice');
        const actionButtonEl = message.createEl('button', { attr: { 'data-action-button': 'true' }, text: 'Do it' });
        let buttonClickCount = 0;
        actionButtonEl.addEventListener('click', () => {
          buttonClickCount += 1;
        });

        let onHideCallCount = 0;
        const notice = component.showNotice(message, {
          onHide: () => {
            onHideCallCount += 1;
          },
          shouldHideOnClick: false
        });

        try {
          await waitUntil({
            message: 'the hard-to-close notice with the action button should render',
            predicate: () => Boolean(findActionContentEl()?.querySelector('[data-action-button]')),
            timeoutInMilliseconds: WAIT_TIMEOUT_IN_MILLISECONDS
          });

          const renderedButtonEl = findActionContentEl()?.querySelector<HTMLElement>('[data-action-button]') ?? null;
          const hasButton = renderedButtonEl !== null;

          // Clicking the action button must run its own handler AND leave the notice shown — the
          // Capture-phase guard lets the click reach the button, and the content wrapper's bubble
          // Guard then stops it from reaching Obsidian's dismiss handler.
          renderedButtonEl?.click();
          await sleep(SETTLE_IN_MILLISECONDS);
          const isShownAfterButtonClick = findActionContentEl() !== null;

          return {
            buttonClickCount,
            hasButton,
            isShownAfterButtonClick,
            onHideCallCount
          };
        } finally {
          notice.hide();
        }
      }
    });

    expect(result.hasButton).toBe(true);

    // The button's own handler ran exactly once...
    expect(result.buttonClickCount).toBe(1);

    // ...and its click did not dismiss the hard-to-close notice.
    expect(result.isShownAfterButtonClick).toBe(true);
    expect(result.onHideCallCount).toBe(0);
  });
});

describe('PluginNoticeComponent.showNoticeAfterDelay', () => {
  it('shows a cancellable notice after the delay whose interactive click does not dismiss it', async () => {
    const result = await evalInObsidian({
      async callback({ app, lib: { PluginNoticeComponent } }) {
        const DELAY_IN_MILLISECONDS = 50;
        const SETTLE_IN_MILLISECONDS = 250;

        async function wait(milliseconds: number): Promise<void> {
          await new Promise<void>((resolve) => {
            window.setTimeout(resolve, milliseconds);
          });
        }

        // Scope the lookup to this notice by its text, so a previous test's notice still fading out
        // (same class) is never mistaken for ours.
        function findContentEl(textIncludes: string): Element | null {
          const els = [...activeDocument.querySelectorAll('.obsidian-dev-utils.plugin-notice-content')];
          return els.find((element) => element.textContent.includes(textIncludes)) ?? null;
        }

        const component = new PluginNoticeComponent({ app, pluginName: 'My Test Plugin' });
        const abortController = new AbortController();
        const handle = component.showNoticeAfterDelay({
          abortController,
          content: 'Working',
          delayInMilliseconds: DELAY_IN_MILLISECONDS
        });

        try {
          const isShownBeforeDelay = findContentEl('Working') !== null;

          await wait(DELAY_IN_MILLISECONDS + SETTLE_IN_MILLISECONDS);
          const contentEl = findContentEl('Working');
          const isShownAfterDelay = contentEl !== null;
          const initialText = contentEl?.textContent ?? '';
          const buttonEl = contentEl?.querySelector('button') ?? null;
          const cancelButtonText = buttonEl?.textContent ?? '';

          // Clicking the Cancel button must abort the controller AND not dismiss the notice (the
          // Interactive-click guard stops the click from reaching the notice's dismiss handler).
          buttonEl?.click();
          await wait(SETTLE_IN_MILLISECONDS);
          const isAbortedAfterCancel = abortController.signal.aborted;
          const isConnectedAfterCancel = buttonEl?.isConnected ?? false;

          // Updating the content of the shown notice.
          handle.setContent('Updated 5/10');
          const updatedText = findContentEl('Updated 5/10')?.textContent ?? '';

          return {
            cancelButtonText,
            initialText,
            isAbortedAfterCancel,
            isConnectedAfterCancel,
            isShownAfterDelay,
            isShownBeforeDelay,
            updatedText
          };
        } finally {
          handle[Symbol.dispose]();
        }
      }
    });

    // Delayed show: nothing before the delay, visible after.
    expect(result.isShownBeforeDelay).toBe(false);
    expect(result.isShownAfterDelay).toBe(true);
    expect(result.initialText).toContain('Working');

    // Abort-wired Cancel button.
    expect(result.cancelButtonText).toBe('Cancel');
    expect(result.isAbortedAfterCancel).toBe(true);
    // The interactive guard kept the notice open when the Cancel button was clicked.
    expect(result.isConnectedAfterCancel).toBe(true);

    // Live content update.
    expect(result.updatedText).toContain('Updated 5/10');
  });
});

describe('PluginNoticeComponent notice modes', () => {
  // Raw `new Notice(...)` calls pile up; the component's slot exists so only the latest message shows.
  // Which of the three outcomes a message gets — replacing, joining, or standing alone — is a question
  // About real notice ELEMENTS on screen, so it is answered here rather than against a mocked `Notice`.
  it('should replace, append to, or stand alongside the current notice as asked', async () => {
    const result = await evalInObsidian({
      async callback({ app, lib: { PluginNoticeComponent, PluginNoticeMode, waitUntil } }) {
        const WAIT_TIMEOUT_IN_MILLISECONDS = 5000;
        const MARKER = 'mode-probe';

        // Counts the notices this test raised, ignoring anything else on screen.
        function getProbeNoticeEls(): HTMLElement[] {
          return [...activeDocument.querySelectorAll<HTMLElement>('.notice')].filter((noticeEl) => noticeEl.textContent.includes(MARKER));
        }

        const component = new PluginNoticeComponent({ app, pluginName: 'My Test Plugin' });
        // Loaded so the `unload` below actually runs: Obsidian's `Component.unload` returns early when
        // The component was never loaded, which would leave these notices on screen for the suites that
        // Run after this one — they overlay the corner of the window and swallow clicks.
        component.load();
        try {
          component.showNotice(`${MARKER} alpha`);
          await waitUntil({
            message: 'the first notice should render',
            predicate: () => getProbeNoticeEls().length === 1,
            timeoutInMilliseconds: WAIT_TIMEOUT_IN_MILLISECONDS
          });

          // Replace (the default): still one notice, and `alpha` is gone from it. Obsidian fades a
          // Replaced notice out before detaching it, so the old element lingers for a moment — hence the
          // Wait for the count to settle rather than a synchronous read.
          component.showNotice(`${MARKER} bravo`);
          await waitUntil({
            message: 'the replaced notice should fade out, leaving a single notice',
            predicate: () => getProbeNoticeEls().length === 1,
            timeoutInMilliseconds: WAIT_TIMEOUT_IN_MILLISECONDS
          });
          const afterReplaceEls = getProbeNoticeEls();
          const afterReplace = {
            noticeCount: afterReplaceEls.length,
            text: afterReplaceEls.map((noticeEl) => noticeEl.textContent).join('|')
          };

          // Append: still one notice, now carrying both messages.
          component.showNotice(`${MARKER} charlie`, { mode: PluginNoticeMode.Append });
          const afterAppendEls = getProbeNoticeEls();
          const afterAppend = {
            noticeCount: afterAppendEls.length,
            pluginNameCount: afterAppendEls[0]?.querySelectorAll('.obsidian-dev-utils.plugin-notice-name').length ?? 0,
            text: afterAppendEls.map((noticeEl) => noticeEl.textContent).join('|')
          };

          // Separate: a second notice, piled up, leaving the first alone.
          component.showNotice(`${MARKER} delta`, { mode: PluginNoticeMode.Separate });
          const afterSeparateEls = getProbeNoticeEls();
          const afterSeparate = {
            noticeCount: afterSeparateEls.length,
            text: afterSeparateEls.map((noticeEl) => noticeEl.textContent).join('|')
          };

          return { afterAppend, afterReplace, afterSeparate };
        } finally {
          component.unload();
        }
      }
    });

    // Replace: one notice, showing only the latest message.
    expect(result.afterReplace.noticeCount).toBe(1);
    expect(result.afterReplace.text).toContain('bravo');
    expect(result.afterReplace.text).not.toContain('alpha');

    // Append: still one notice, carrying both messages, with the plugin name shown once rather than
    // Repeated on the appended line.
    expect(result.afterAppend.noticeCount).toBe(1);
    expect(result.afterAppend.text).toContain('bravo');
    expect(result.afterAppend.text).toContain('charlie');
    expect(result.afterAppend.pluginNameCount).toBe(1);

    // Separate: two notices on screen at once, the appended-to one untouched.
    expect(result.afterSeparate.noticeCount).toBe(2);
    expect(result.afterSeparate.text).toContain('charlie');
    expect(result.afterSeparate.text).toContain('delta');
  });
});

describe('PluginNoticeComponent delayed notice modes', () => {
  // The delayed handle owns one message inside a notice, not the whole notice: it rewrites that message
  // In place and, when it merely joined a notice, takes only that message away again. Both are DOM moves
  // Inside a live notice element, so a mocked `Notice` cannot show they work.
  it('should update and remove only its own message when appended to a notice', async () => {
    const result = await evalInObsidian({
      async callback({ app, lib: { PluginNoticeComponent, PluginNoticeMode, waitUntil } }) {
        const WAIT_TIMEOUT_IN_MILLISECONDS = 5000;
        const MARKER = 'delayed-probe';

        function getProbeNoticeEl(): HTMLElement | null {
          return [...activeDocument.querySelectorAll<HTMLElement>('.notice')].find((noticeEl) => noticeEl.textContent.includes(MARKER)) ?? null;
        }

        const component = new PluginNoticeComponent({ app, pluginName: 'My Test Plugin' });
        // See the note on the other modes test: without `load`, the `unload` below is a no-op and these
        // Notices outlive the test.
        component.load();
        try {
          component.showNotice(`${MARKER} host`);
          const handle = component.showNoticeAfterDelay({
            content: `${MARKER} working`,
            delayInMilliseconds: 0,
            mode: PluginNoticeMode.Append
          });

          await waitUntil({
            message: 'the delayed message should join the notice already on screen',
            predicate: () => (getProbeNoticeEl()?.textContent ?? '').includes('working'),
            timeoutInMilliseconds: WAIT_TIMEOUT_IN_MILLISECONDS
          });
          const afterAppend = getProbeNoticeEl()?.textContent ?? '';

          handle.setContent(`${MARKER} finishing`);
          const afterUpdate = getProbeNoticeEl()?.textContent ?? '';

          handle[Symbol.dispose]();
          const afterDispose = getProbeNoticeEl()?.textContent ?? null;

          return { afterAppend, afterDispose, afterUpdate };
        } finally {
          component.unload();
        }
      }
    });

    // Both messages share the notice.
    expect(result.afterAppend).toContain('host');
    expect(result.afterAppend).toContain('working');

    // The update rewrites the handle's message and leaves the host message alone.
    expect(result.afterUpdate).toContain('host');
    expect(result.afterUpdate).toContain('finishing');
    expect(result.afterUpdate).not.toContain('working');

    // Disposing takes away only the handle's message: the notice it joined is still up, still showing
    // The message that was there first.
    expect(result.afterDispose).toContain('host');
    expect(result.afterDispose).not.toContain('finishing');
  });
});
