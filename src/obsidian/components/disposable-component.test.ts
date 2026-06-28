/**
 * @file
 *
 * Tests for {@link asDisposableComponent}.
 */

import { Component } from 'obsidian';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { isDisposable } from '../../disposable.ts';
import { asDisposableComponent } from './disposable-component.ts';

describe('asDisposableComponent', () => {
  it('should add Symbol.dispose to a plain Component', () => {
    const component = new Component();
    const wrapped = asDisposableComponent(component);

    expect(isDisposable(wrapped)).toBe(true);

    const unloadSpy = vi.spyOn(component, 'unload');
    wrapped[Symbol.dispose]();
    expect(unloadSpy).toHaveBeenCalledOnce();
  });

  it('should return the same component if already disposable', () => {
    const component = new Component();
    const wrapped = asDisposableComponent(component);
    const wrappedAgain = asDisposableComponent(wrapped);

    expect(wrappedAgain).toBe(wrapped);
  });
});
