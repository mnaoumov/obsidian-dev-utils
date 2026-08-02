// @vitest-environment jsdom

import type { ButtonComponent } from 'obsidian-test-mocks/obsidian';

import { ButtonComponent as ButtonComponentOriginal } from 'obsidian';
import {
  beforeEach,
  describe,
  expect,
  it
} from 'vitest';

import type { PopoverAnchor } from './popover-anchor.ts';
import type { ShowPopoverBuildParams } from './popover.ts';

import { castTo } from '../../object-utils.ts';
import { mockImplementation } from '../../test-helpers/mock-implementation.ts';
import { ensureNonNullable } from '../../type-guards.ts';
import { showPopover } from './popover.ts';

const buttonInstances: ButtonComponentOriginal[] = [];

function clickButton(index: number): void {
  castTo<ButtonComponent>(ensureNonNullable(buttonInstances[index])).simulateClick__();
}

function clickCancel(): void {
  clickButton(1);
}

function clickOk(): void {
  clickButton(0);
}

function createAnchor(bottom = 100, left = 100): PopoverAnchor {
  return {
    bottom,
    doc: document,
    left
  };
}

function getPopoverElement(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>('.popover');
}

function pressKey(key: string): void {
  requirePopoverElement().dispatchEvent(new KeyboardEvent('keydown', { key }));
}

function requirePopoverElement(): HTMLElement {
  return ensureNonNullable(getPopoverElement(), 'The popover is not open');
}

function showTextPopover(text = 'value', anchor = createAnchor()): Promise<null | string> {
  return showPopover<string>({
    anchor,
    build: () => (): string => text
  });
}

function startPointerGestureOn(element: EventTarget): void {
  element.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
}

describe('showPopover', () => {
  beforeEach(() => {
    buttonInstances.length = 0;
    document.body.empty();
    mockImplementation({
      impl: function impl(this: ButtonComponentOriginal, originalImplementation, containerElement: HTMLElement): ButtonComponentOriginal {
        originalImplementation.call(this, containerElement);
        buttonInstances.push(this);
        return this;
      },
      method: 'constructor2__',
      obj: ButtonComponentOriginal.prototype
    });
  });

  it('should resolve the built value when the OK button is clicked', async () => {
    const resultPromise = showTextPopover('built');
    clickOk();

    await expect(resultPromise).resolves.toBe('built');
  });

  it('should resolve null when the Cancel button is clicked', async () => {
    const resultPromise = showTextPopover();
    clickCancel();

    await expect(resultPromise).resolves.toBeNull();
  });

  it('should resolve the built value when Enter is pressed', async () => {
    const resultPromise = showTextPopover('typed');
    pressKey('Enter');

    await expect(resultPromise).resolves.toBe('typed');
  });

  it('should resolve null when Escape is pressed', async () => {
    const resultPromise = showTextPopover();
    pressKey('Escape');

    await expect(resultPromise).resolves.toBeNull();
  });

  it('should stay open when any other key is pressed', async () => {
    const resultPromise = showTextPopover();
    pressKey('a');
    expect(getPopoverElement()).not.toBeNull();

    clickCancel();
    await expect(resultPromise).resolves.toBeNull();
  });

  it('should resolve null when a pointer gesture starts outside the popover', async () => {
    const outsideElement = document.body.createDiv();
    const resultPromise = showTextPopover();

    startPointerGestureOn(outsideElement);

    await expect(resultPromise).resolves.toBeNull();
  });

  it('should stay open when a pointer gesture starts inside the popover', async () => {
    const resultPromise = showTextPopover();

    startPointerGestureOn(requirePopoverElement());
    expect(getPopoverElement()).not.toBeNull();

    clickCancel();
    await expect(resultPromise).resolves.toBeNull();
  });

  it('should resolve only once even when confirmed repeatedly', async () => {
    let value = 'first';
    const resultPromise = showPopover<string>({
      anchor: createAnchor(),
      build: () => (): string => value
    });

    clickOk();
    value = 'second';
    clickOk();

    await expect(resultPromise).resolves.toBe('first');
  });

  it('should remove the popover and stop listening for outside gestures once closed', async () => {
    const outsideElement = document.body.createDiv();
    const resultPromise = showTextPopover();

    clickOk();
    await resultPromise;

    expect(getPopoverElement()).toBeNull();
    // A gesture after the close must not reach the removed handler, which would throw on the settled promise.
    expect(() => {
      startPointerGestureOn(outsideElement);
    }).not.toThrow();
  });

  it('should let the built content confirm and cancel the popover itself', async () => {
    let buildParams: null | ShowPopoverBuildParams = null;
    const resultPromise = showPopover<string>({
      anchor: createAnchor(),
      build: (params) => {
        buildParams = params;
        return (): string => 'from-content';
      }
    });

    ensureNonNullable<null | ShowPopoverBuildParams>(buildParams).confirm();

    await expect(resultPromise).resolves.toBe('from-content');
  });

  it('should let the built content cancel the popover itself', async () => {
    let buildParams: null | ShowPopoverBuildParams = null;
    const resultPromise = showPopover<string>({
      anchor: createAnchor(),
      build: (params) => {
        buildParams = params;
        return (): string => 'unused';
      }
    });

    ensureNonNullable<null | ShowPopoverBuildParams>(buildParams).cancel();

    await expect(resultPromise).resolves.toBeNull();
  });

  it('should place the popover just below the anchor', async () => {
    const resultPromise = showTextPopover('value', createAnchor(200, 120));
    const popoverElement = requirePopoverElement();

    expect(popoverElement.style.left).toBe('120px');
    expect(popoverElement.style.top).toBe('204px');

    clickCancel();
    await resultPromise;
  });

  it('should clamp a popover anchored past the far edges back into the window', async () => {
    const resultPromise = showTextPopover('value', createAnchor(5000, 5000));
    const popoverElement = requirePopoverElement();

    expect(popoverElement.style.left).toBe(`${String(window.innerWidth - 8)}px`);
    expect(popoverElement.style.top).toBe(`${String(window.innerHeight - 8)}px`);

    clickCancel();
    await resultPromise;
  });

  it('should clamp a popover anchored past the near edges back into the window', async () => {
    const resultPromise = showTextPopover('value', createAnchor(-500, -500));
    const popoverElement = requirePopoverElement();

    expect(popoverElement.style.left).toBe('8px');
    expect(popoverElement.style.top).toBe('8px');

    clickCancel();
    await resultPromise;
  });

  it('should ride the menu class and apply the extra CSS classes', async () => {
    const resultPromise = showPopover<string>({
      anchor: createAnchor(),
      build: () => (): string => 'value',
      cssClasses: ['my-popover']
    });
    const popoverElement = requirePopoverElement();

    expect(popoverElement.classList.contains('menu')).toBe(true);
    expect(popoverElement.classList.contains('obsidian-dev-utils')).toBe(true);
    expect(popoverElement.classList.contains('my-popover')).toBe(true);

    clickCancel();
    await resultPromise;
  });

  it('should use the default button texts', async () => {
    const resultPromise = showTextPopover();
    const popoverElement = requirePopoverElement();

    expect(popoverElement.querySelector('.ok-button')?.textContent).toBe('OK');
    expect(popoverElement.querySelector('.cancel-button')?.textContent).toBe('Cancel');

    clickCancel();
    await resultPromise;
  });

  it('should use the custom button texts', async () => {
    const resultPromise = showPopover<string>({
      anchor: createAnchor(),
      build: () => (): string => 'value',
      cancelButtonText: 'Dismiss',
      okButtonText: 'Apply'
    });
    const popoverElement = requirePopoverElement();

    expect(popoverElement.querySelector('.ok-button')?.textContent).toBe('Apply');
    expect(popoverElement.querySelector('.cancel-button')?.textContent).toBe('Dismiss');

    clickCancel();
    await resultPromise;
  });

  it('should focus and select the first input of the built content', async () => {
    const resultPromise = showPopover<string>({
      anchor: createAnchor(),
      build({ contentEl }) {
        const inputElement = contentEl.createEl('input');
        inputElement.value = 'preset';
        return (): string => inputElement.value;
      }
    });

    const inputElement = ensureNonNullable(requirePopoverElement().querySelector('input'));
    expect(document.activeElement).toBe(inputElement);
    expect(inputElement.selectionStart).toBe(0);
    expect(inputElement.selectionEnd).toBe('preset'.length);

    clickCancel();
    await resultPromise;
  });

  it('should not fail when the built content has no input to focus', async () => {
    const resultPromise = showTextPopover();

    expect(requirePopoverElement().querySelector('input')).toBeNull();

    clickCancel();
    await expect(resultPromise).resolves.toBeNull();
  });
});
