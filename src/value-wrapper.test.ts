import {
  describe,
  expect,
  it
} from 'vitest';

import { ValueWrapper } from './value-wrapper.ts';

describe('ValueWrapper', () => {
  it('should store a number value', () => {
    const wrapper = new ValueWrapper(42);
    expect(wrapper.value).toBe(42);
  });

  it('should store a string value', () => {
    const wrapper = new ValueWrapper('hello');
    expect(wrapper.value).toBe('hello');
  });

  it('should store an object value', () => {
    const obj = { key: 'val' };
    const wrapper = new ValueWrapper(obj);
    expect(wrapper.value).toBe(obj);
  });

  it('should store null', () => {
    const wrapper = new ValueWrapper(null);
    expect(wrapper.value).toBeNull();
  });

  it('should store undefined', () => {
    const wrapper = new ValueWrapper(undefined);
    expect(wrapper.value).toBeUndefined();
  });

  it('should allow the value to be overwritten', () => {
    const wrapper = new ValueWrapper(1);
    wrapper.value = 99;
    expect(wrapper.value).toBe(99);
  });
});
