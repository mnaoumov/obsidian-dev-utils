// @vitest-environment jsdom

import type { UndefinedOnPartialDeep } from 'type-fest';

import { TextComponent } from 'obsidian';
import {
  describe,
  expect,
  it
} from 'vitest';

import type { TextBasedComponent } from './text-based-component.ts';

import { noop } from '../../../function.ts';
import { assertNonNullable } from '../../../type-guards.ts';
import { getTextBasedComponentValue } from './text-based-component.ts';

// Allow duck-type check in getTextBasedComponentValue to work with strictMock.
// StrictMock throws on access to unknown properties; setting this to undefined
// Makes `typeof tc.setPlaceholderValue === 'function'` return false instead.
(TextComponent.prototype as UndefinedOnPartialDeep<Partial<TextBasedComponent<unknown>>>).setPlaceholderValue = undefined;

describe('getTextBasedComponentValue', () => {
  it('should return null for objects without TextBasedComponent interface', () => {
    expect(getTextBasedComponentValue({})).toBeNull();
    expect(getTextBasedComponentValue({ unrelated: true })).toBeNull();
  });

  it('should return the object if it already implements TextBasedComponent', () => {
    const textBased = {
      empty: (): void => {
        noop();
      },
      isEmpty: (): boolean => false,
      setPlaceholderValue: (): unknown => textBased
    };
    const result = getTextBasedComponentValue(textBased);
    expect(result).toBe(textBased);
  });

  it('should wrap AbstractTextComponent', () => {
    const container = createDiv();
    const atc = new TextComponent(container);
    atc.setValue('hello');

    const result = getTextBasedComponentValue<string>(atc);
    expect(result).not.toBeNull();
    assertNonNullable(result);
    expect(result.isEmpty()).toBe(false);
  });

  it('should empty the wrapped AbstractTextComponent', () => {
    const container = createDiv();
    const atc = new TextComponent(container);
    atc.setValue('hello');

    const result = getTextBasedComponentValue<string>(atc);
    assertNonNullable(result);
    result.empty();
    expect(atc.getValue()).toBe('');
  });

  it('should check isEmpty on wrapped AbstractTextComponent', () => {
    const container = createDiv();
    const atc = new TextComponent(container);

    const result = getTextBasedComponentValue<string>(atc);
    assertNonNullable(result);
    expect(result.isEmpty()).toBe(true);
    atc.setValue('x');
    expect(result.isEmpty()).toBe(false);
  });

  it('should set placeholder value on wrapped AbstractTextComponent', () => {
    const container = createDiv();
    const atc = new TextComponent(container);

    const result = getTextBasedComponentValue<string>(atc);
    assertNonNullable(result);
    const returned = result.setPlaceholderValue('hint');
    expect(returned).toBe(result);
  });
});
