import {
  describe,
  expect,
  it
} from 'vitest';

import {
  getEnumKey,
  getEnumValue
} from '../src/Enum.ts';

const TestEnum = {
  Foo: 'foo',
  Bar: 'bar',
  Baz: 'baz'
} as const;

describe('Enum', () => {
  describe('getEnumKey', () => {
    it.each([
      ['foo', 'Foo'],
      ['bar', 'Bar'],
      ['baz', 'Baz']
    ])('should return the key for enum value %s -> %s', (value: string, expectedKey: string) => {
      expect(getEnumKey(TestEnum, value as typeof TestEnum[keyof typeof TestEnum])).toBe(expectedKey);
    });

    it('should throw for an invalid enum value', () => {
      expect(() => getEnumKey(TestEnum, 'invalid' as never)).toThrow('Invalid enum value: invalid');
    });

    it('should throw with the value in the error message', () => {
      expect(() => getEnumKey(TestEnum, 'nope' as never)).toThrow('nope');
    });
  });

  describe('getEnumValue', () => {
    it.each([
      ['Foo', 'foo'],
      ['Bar', 'bar'],
      ['Baz', 'baz']
    ])('should return the value for enum key %s -> %s', (key: string, expectedValue: string) => {
      expect(getEnumValue(TestEnum, key)).toBe(expectedValue);
    });

    it('should throw for an invalid enum key', () => {
      expect(() => getEnumValue(TestEnum, 'Invalid')).toThrow('Invalid enum key: Invalid');
    });

    it('should throw with the key in the error message', () => {
      expect(() => getEnumValue(TestEnum, 'Unknown')).toThrow('Unknown');
    });

    it.each([
      ['foo', 'Invalid enum key: foo'],
      ['FOO', 'Invalid enum key: FOO']
    ])('should be case-sensitive and throw for key %s', (key: string, expectedMessage: string) => {
      expect(() => getEnumValue(TestEnum, key)).toThrow(expectedMessage);
    });
  });
});
