/**
 * @file
 *
 * Tests for {@link DisposableComponent}, {@link asDisposableComponent}, and {@link isDisposable}.
 */

import { Component } from 'obsidian';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { noop } from '../../function.ts';
import {
  asDisposableComponent,
  isDisposable
} from './disposable-component.ts';

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

describe('isDisposable', () => {
  it('should return true for objects with Symbol.dispose', () => {
    const obj = { [Symbol.dispose]: noop };
    expect(isDisposable(obj)).toBe(true);
  });

  it('should return false for objects without Symbol.dispose', () => {
    expect(isDisposable({})).toBe(false);
  });
});
