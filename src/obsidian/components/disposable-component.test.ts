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
  DisposableComponent,
  isDisposable
} from './disposable-component.ts';

describe('DisposableComponent', () => {
  it('should call unload when Symbol.dispose is invoked', () => {
    const component = new DisposableComponent();
    const unloadSpy = vi.spyOn(component, 'unload');

    component[Symbol.dispose]();

    expect(unloadSpy).toHaveBeenCalledOnce();
  });

  it('should implement Disposable interface', () => {
    const component = new DisposableComponent();
    expect(isDisposable(component)).toBe(true);
  });
});

describe('asDisposableComponent', () => {
  it('should add Symbol.dispose to a plain Component', () => {
    const component = new Component();
    const wrapped = asDisposableComponent(component);

    expect(isDisposable(wrapped)).toBe(true);

    const unloadSpy = vi.spyOn(component, 'unload');
    wrapped[Symbol.dispose]();
    expect(unloadSpy).toHaveBeenCalledOnce();
  });

  it('should return the same object if already disposable', () => {
    const component = new DisposableComponent();
    const result = asDisposableComponent(component);
    expect(result).toBe(component);
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
