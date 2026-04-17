import {
  describe,
  expect,
  it
} from 'vitest';

import { SilentError } from '../../../error.ts';
import { AbortSignalComponent } from './abort-signal-component.ts';

describe('AbortSignalComponent', () => {
  it('should create an abort signal that is not aborted initially', () => {
    const component = new AbortSignalComponent('test-plugin');
    expect(component.abortSignal.aborted).toBe(false);
  });

  it('should abort the signal on unload with a SilentError', () => {
    const component = new AbortSignalComponent('test-plugin');
    component.onunload();
    expect(component.abortSignal.aborted).toBe(true);
    expect(component.abortSignal.reason).toBeInstanceOf(SilentError);
    expect((component.abortSignal.reason as SilentError).message).toBe('Plugin test-plugin had been unloaded');
  });
});
