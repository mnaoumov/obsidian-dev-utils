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
import { castTo } from '../../object-utils.ts';
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

  it('should unload the component via the dispose() convenience method', () => {
    const component = new Component();
    const wrapped = asDisposableComponent(component);

    const unloadSpy = vi.spyOn(component, 'unload');
    wrapped.dispose();
    expect(unloadSpy).toHaveBeenCalledOnce();
  });

  it('should preserve an existing Symbol.dispose and add a delegating dispose()', () => {
    const component = new Component();
    const existingDispose = vi.fn();
    castTo<Partial<Disposable>>(component)[Symbol.dispose] = existingDispose;

    const wrapped = asDisposableComponent(component);
    wrapped.dispose();

    expect(existingDispose).toHaveBeenCalledOnce();
  });

  it('should return the same component if already disposable', () => {
    const component = new Component();
    const wrapped = asDisposableComponent(component);
    const wrappedAgain = asDisposableComponent(wrapped);

    expect(wrappedAgain).toBe(wrapped);
  });
});
