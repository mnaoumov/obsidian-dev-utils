// @vitest-environment jsdom

import type {
  ButtonComponent,
  TextComponent
} from 'obsidian-test-mocks/obsidian';

import {
  ButtonComponent as ButtonComponentOriginal,
  TextComponent as TextComponentOriginal
} from 'obsidian';
import {
  beforeEach,
  describe,
  expect,
  it
} from 'vitest';

import type { PopoverAnchor } from './popover-anchor.ts';

import { castTo } from '../../object-utils.ts';
import { mockImplementation } from '../../test-helpers/mock-implementation.ts';
import { ensureNonNullable } from '../../type-guards.ts';
import { editFieldsInPopover } from './field-popover.ts';

const buttonInstances: ButtonComponentOriginal[] = [];
const textInstances: TextComponentOriginal[] = [];

const ANCHOR: PopoverAnchor = {
  bottom: 100,
  doc: document,
  left: 100
};

function clickButton(index: number): void {
  castTo<ButtonComponent>(ensureNonNullable(buttonInstances[index])).simulateClick__();
}

function clickCancel(): void {
  clickButton(1);
}

function clickOk(): void {
  clickButton(0);
}

function editField(index: number, value: string): void {
  castTo<TextComponent>(ensureNonNullable(textInstances[index])).setValue(value);
}

describe('editFieldsInPopover', () => {
  beforeEach(() => {
    buttonInstances.length = 0;
    textInstances.length = 0;
    document.body.empty();
    mockImplementation({
      impl: function impl(this: ButtonComponentOriginal, originalImplementation, containerEl: HTMLElement): ButtonComponentOriginal {
        originalImplementation.call(this, containerEl);
        buttonInstances.push(this);
        return this;
      },
      method: 'constructor2__',
      obj: ButtonComponentOriginal.prototype
    });
    mockImplementation({
      impl: function impl(this: TextComponentOriginal, originalImplementation, containerEl: HTMLElement): TextComponentOriginal {
        originalImplementation.call(this, containerEl);
        textInstances.push(this);
        return this;
      },
      method: 'constructor4__',
      obj: TextComponentOriginal.prototype
    });
  });

  it('should resolve the default values keyed by field key', async () => {
    const resultPromise = editFieldsInPopover({
      anchor: ANCHOR,
      fields: [
        { defaultValue: 'https://example.com', key: 'url', name: 'URL' },
        { defaultValue: 'Example', key: 'alias', name: 'Alias' }
      ]
    });

    clickOk();

    await expect(resultPromise).resolves.toStrictEqual({
      alias: 'Example',
      url: 'https://example.com'
    });
  });

  it('should resolve the edited values', async () => {
    const resultPromise = editFieldsInPopover({
      anchor: ANCHOR,
      fields: [
        { defaultValue: 'https://example.com', key: 'url', name: 'URL' },
        { defaultValue: 'Example', key: 'alias', name: 'Alias' }
      ]
    });

    editField(0, 'https://edited.example.com');
    editField(1, 'Edited');
    clickOk();

    await expect(resultPromise).resolves.toStrictEqual({
      alias: 'Edited',
      url: 'https://edited.example.com'
    });
  });

  it('should default a field with no default value to an empty string', async () => {
    const resultPromise = editFieldsInPopover({
      anchor: ANCHOR,
      fields: [{ key: 'alias', name: 'Alias' }]
    });

    clickOk();

    await expect(resultPromise).resolves.toStrictEqual({ alias: '' });
  });

  it('should resolve null when dismissed', async () => {
    const resultPromise = editFieldsInPopover({
      anchor: ANCHOR,
      fields: [{ defaultValue: 'Example', key: 'alias', name: 'Alias' }]
    });

    clickCancel();

    await expect(resultPromise).resolves.toBeNull();
  });

  it('should label the fields and apply their placeholders', async () => {
    const resultPromise = editFieldsInPopover({
      anchor: ANCHOR,
      fields: [
        { key: 'url', name: 'URL', placeholder: 'https://...' },
        { key: 'alias', name: 'Alias' }
      ]
    });

    const popoverEl = ensureNonNullable(document.body.querySelector('.popover'));
    const inputEls = Array.from(popoverEl.querySelectorAll('input'));

    expect(popoverEl.textContent).toContain('URL');
    expect(popoverEl.textContent).toContain('Alias');
    expect(inputEls).toHaveLength(2);
    expect(inputEls[0]?.placeholder).toBe('https://...');
    expect(inputEls[1]?.placeholder).toBe('');
    expect(inputEls[0]?.classList.contains('text-box')).toBe(true);

    clickCancel();
    await resultPromise;
  });

  it('should forward the optional popover parameters', async () => {
    const resultPromise = editFieldsInPopover({
      anchor: ANCHOR,
      cancelButtonText: 'Dismiss',
      cssClasses: ['link-editor'],
      fields: [{ key: 'alias', name: 'Alias' }],
      okButtonText: 'Apply'
    });

    const popoverEl = ensureNonNullable(document.body.querySelector('.popover'));

    expect(popoverEl.classList.contains('link-editor')).toBe(true);
    expect(popoverEl.querySelector('.ok-button')?.textContent).toBe('Apply');
    expect(popoverEl.querySelector('.cancel-button')?.textContent).toBe('Dismiss');

    clickCancel();
    await resultPromise;
  });

  it('should resolve an empty record when there are no fields', async () => {
    const resultPromise = editFieldsInPopover({
      anchor: ANCHOR,
      fields: []
    });

    clickOk();

    await expect(resultPromise).resolves.toStrictEqual({});
  });
});
