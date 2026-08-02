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

import { dispose } from '../../disposable.ts';

describe('PluginNoticeComponent styling', () => {
  it('should render the plugin name with the accent color and bold weight, distinct from the body', async () => {
    const result = await evalInObsidian({
      fn({ app, lib: { PluginNoticeComponent } }) {
        const component = new PluginNoticeComponent({ app, pluginName: 'My Test Plugin' });
        const notice = component.showNotice('Body text');

        try {
          const nameElement = activeDocument.querySelector('.obsidian-dev-utils.plugin-notice-name');
          if (!nameElement) {
            throw new Error('plugin name element not found in the rendered notice');
          }

          const nameStyle = activeWindow.getComputedStyle(nameElement);

          // Probe resolving the same theme variables the CSS rule uses (compare computed rgb / weight).
          const probeElement = activeDocument.body.createSpan();
          probeElement.setCssStyles({ color: 'var(--text-accent)', fontWeight: 'var(--font-bold)' });
          const probeStyle = activeWindow.getComputedStyle(probeElement);

          // Plain element inheriting the default text color, to prove the name color is distinct.
          const plainElement = activeDocument.body.createSpan();
          const defaultColor = activeWindow.getComputedStyle(plainElement).color;

          const measurement = {
            accentColor: probeStyle.color,
            boldFontWeight: probeStyle.fontWeight,
            defaultColor,
            hasLibClass: nameElement.classList.contains('obsidian-dev-utils'),
            hasNameClass: nameElement.classList.contains('plugin-notice-name'),
            nameColor: nameStyle.color,
            nameFontWeight: nameStyle.fontWeight,
            text: nameElement.textContent
          };

          probeElement.remove();
          plainElement.remove();
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
      async fn({ app, lib: { PluginNoticeComponent, waitUntil } }) {
        const SETTLE_IN_MILLISECONDS = 250;
        const WAIT_TIMEOUT_IN_MILLISECONDS = 5000;

        function findLockedContentElement(): HTMLElement | null {
          const els = Array.from(activeDocument.querySelectorAll<HTMLElement>('.obsidian-dev-utils.plugin-notice-content'));
          return els.find((element) => element.textContent.includes('Locked action')) ?? null;
        }

        const component = new PluginNoticeComponent({ app, pluginName: 'My Test Plugin' });
        let onHideCallCount = 0;
        let onHideIsUserAction = false;
        let onHideIsCloseButtonClicked = false;
        const notice = component.showNotice('Locked action', {
          onHide: (info) => {
            onHideIsUserAction = info.isUserAction;
            onHideIsCloseButtonClicked = info.isCloseButtonClicked;
            onHideCallCount += 1;
          },
          shouldHideOnClick: false
        });

        try {
          await waitUntil({
            message: 'the hard-to-close notice should render',
            predicate: () => findLockedContentElement() !== null,
            timeoutInMilliseconds: WAIT_TIMEOUT_IN_MILLISECONDS
          });

          const contentElement = findLockedContentElement();
          const { containerEl, messageEl } = notice;
          const closeButtonElement = contentElement?.querySelector<HTMLElement>('.obsidian-dev-utils.plugin-notice-close-button') ?? null;
          const hasCloseButton = closeButtonElement !== null;
          const hasRequiresExplicitCloseClass = containerEl.classList.contains('plugin-notice-requires-explicit-close');

          // A stray click on the notice body must NOT dismiss it.
          contentElement?.click();
          await sleep(SETTLE_IN_MILLISECONDS);
          const isShownAfterBodyClick = findLockedContentElement() !== null;

          // A click on the inner message element (a descendant) must NOT dismiss it — the capture-phase
          // Guard on the container stops it before Obsidian's dismiss handler runs.
          messageEl.click();
          await sleep(SETTLE_IN_MILLISECONDS);
          const isShownAfterMessageClick = findLockedContentElement() !== null;

          // A real click at the notice's very corner (where the padding used to be) must land on the
          // Guarded content and NOT dismiss it.
          const rect = containerEl.getBoundingClientRect();
          const cornerElement = activeDocument.elementFromPoint(rect.left + 2, rect.top + 2);
          cornerElement?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          await sleep(SETTLE_IN_MILLISECONDS);
          const isShownAfterPaddingClick = findLockedContentElement() !== null;

          // A following ordinary notice must NOT hide the standalone hard-to-close notice.
          const ordinaryNotice = component.showNotice('Ordinary notice');
          await sleep(SETTLE_IN_MILLISECONDS);
          const isShownAfterOtherNotice = findLockedContentElement() !== null;
          ordinaryNotice.hide();

          // Clicking the close button hides the notice directly — no confirmation modal.
          closeButtonElement?.click();
          await waitUntil({
            message: 'the notice should be gone after clicking the close button',
            predicate: () => findLockedContentElement() === null,
            timeoutInMilliseconds: WAIT_TIMEOUT_IN_MILLISECONDS
          });
          const isShownAfterClose = findLockedContentElement() !== null;
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
            onHideIsCloseButtonClicked,
            onHideIsUserAction
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
      async fn({ app, lib: { PluginNoticeComponent, waitUntil } }) {
        const SETTLE_IN_MILLISECONDS = 250;
        const WAIT_TIMEOUT_IN_MILLISECONDS = 5000;

        function findActionContentElement(): HTMLElement | null {
          const els = Array.from(activeDocument.querySelectorAll<HTMLElement>('.obsidian-dev-utils.plugin-notice-content'));
          return els.find((element) => element.textContent.includes('Action notice')) ?? null;
        }

        const component = new PluginNoticeComponent({ app, pluginName: 'My Test Plugin' });

        // A consumer embeds an action button in the message fragment.
        const message = createFragment();
        message.appendText('Action notice');
        const actionButtonElement = message.createEl('button', { attr: { 'data-action-button': 'true' }, text: 'Do it' });
        let buttonClickCount = 0;
        actionButtonElement.addEventListener('click', () => {
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
            predicate: () => Boolean(findActionContentElement()?.querySelector('[data-action-button]')),
            timeoutInMilliseconds: WAIT_TIMEOUT_IN_MILLISECONDS
          });

          const renderedButtonElement = findActionContentElement()?.querySelector<HTMLElement>('[data-action-button]') ?? null;
          const hasButton = renderedButtonElement !== null;

          // Clicking the action button must run its own handler AND leave the notice shown — the
          // Capture-phase guard lets the click reach the button, and the content wrapper's bubble
          // Guard then stops it from reaching Obsidian's dismiss handler.
          renderedButtonElement?.click();
          await sleep(SETTLE_IN_MILLISECONDS);
          const isShownAfterButtonClick = findActionContentElement() !== null;

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
      async fn({ app, lib: { PluginNoticeComponent } }) {
        const DELAY_IN_MILLISECONDS = 50;
        const SETTLE_IN_MILLISECONDS = 250;

        async function wait(milliseconds: number): Promise<void> {
          await new Promise<void>((resolve) => {
            window.setTimeout(resolve, milliseconds);
          });
        }

        // Scope the lookup to this notice by its text, so a previous test's notice still fading out
        // (same class) is never mistaken for ours.
        function findContentElement(textIncludes: string): Element | null {
          const els = Array.from(activeDocument.querySelectorAll('.obsidian-dev-utils.plugin-notice-content'));
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
          const isShownBeforeDelay = findContentElement('Working') !== null;

          await wait(DELAY_IN_MILLISECONDS + SETTLE_IN_MILLISECONDS);
          const contentElement = findContentElement('Working');
          const isShownAfterDelay = contentElement !== null;
          const initialText = contentElement?.textContent ?? '';
          const buttonElement = contentElement?.querySelector('button') ?? null;
          const cancelButtonText = buttonElement?.textContent ?? '';

          // Clicking the Cancel button must abort the controller AND not dismiss the notice (the
          // Interactive-click guard stops the click from reaching the notice's dismiss handler).
          buttonElement?.click();
          await wait(SETTLE_IN_MILLISECONDS);
          const isAbortedAfterCancel = abortController.signal.aborted;
          const isConnectedAfterCancel = buttonElement?.isConnected ?? false;

          // Updating the content of the shown notice.
          handle.setContent('Updated 5/10');
          const updatedText = findContentElement('Updated 5/10')?.textContent ?? '';

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
          dispose(handle);
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
