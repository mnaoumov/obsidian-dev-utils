import {
  describe,
  expect,
  it
} from 'vitest';

import { createAggregateError } from './aggregate-error.ts';

describe('createAggregateError', () => {
  it('should hold every error it was given', () => {
    const error = new Error('the only failure');
    expect(createAggregateError([error]).errors).toEqual([error]);
  });

  it('should lend a lone failure its message, so the aggregate names it', () => {
    expect(createAggregateError([new Error('the only failure')]).message).toBe('the only failure');
  });

  it('should count several failures rather than promote one of them', () => {
    expect(createAggregateError([new Error('first'), new Error('second')]).message).toBe('2 error(s) occurred');
  });

  it('should count a lone non-Error throwable, which has no message to lend', () => {
    expect(createAggregateError(['string failure']).message).toBe('1 error(s) occurred');
  });

  it('should count a lone failure whose own message is empty, so the result never is', () => {
    expect(createAggregateError([new Error('')]).message).toBe('1 error(s) occurred');
  });

  it('should read the same at every level of a nested chain', () => {
    const inner = createAggregateError([new Error('the root failure')]);
    expect(createAggregateError([inner]).message).toBe('the root failure');
  });
});
