import {
  describe,
  expect,
  it
} from 'vitest';

import { ValueWrapper } from './value-wrapper.ts';

describe('ValueWrapper', () => {
  describe('of', () => {
    it('should store a number value', () => {
      const wrapper = ValueWrapper.of(42);
      expect(wrapper.value).toBe(42);
    });

    it('should store a string value', () => {
      const wrapper = ValueWrapper.of('hello');
      expect(wrapper.value).toBe('hello');
    });

    it('should store an object value', () => {
      const obj = { key: 'val' };
      const wrapper = ValueWrapper.of(obj);
      expect(wrapper.value).toBe(obj);
    });

    it('should store null', () => {
      const wrapper = ValueWrapper.of(null);
      expect(wrapper.value).toBeNull();
    });

    it('should store undefined', () => {
      const wrapper = ValueWrapper.of(undefined);
      expect(wrapper.value).toBeUndefined();
    });

    it('should allow the value to be overwritten', () => {
      const wrapper = ValueWrapper.of(1);
      wrapper.value = 99;
      expect(wrapper.value).toBe(99);
    });
  });

  describe('unset', () => {
    it('should throw when reading an unset value', () => {
      const wrapper = ValueWrapper.unset<number>();
      expect(() => wrapper.value).toThrow('Value is not set');
    });

    it('should allow the value to be set after creation', () => {
      const wrapper = ValueWrapper.unset<number>();
      wrapper.value = 7;
      expect(wrapper.value).toBe(7);
    });

    it('should treat an explicitly set undefined as a set value', () => {
      const wrapper = ValueWrapper.unset<undefined>();
      wrapper.value = undefined;
      expect(wrapper.value).toBeUndefined();
    });
  });
});
