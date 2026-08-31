import {
  describe,
  expect,
  it
} from 'vitest';

import { ModalCommandBuilder } from './modal-command-builder.ts';
// eslint-disable-next-line import-x/no-deprecated -- The deprecated alias IS the subject: this file exists to prove it still resolves to the live class.
import { SuggestModalCommandBuilder } from './suggest-modal-command-builder.ts';

describe('SuggestModalCommandBuilder', () => {
  it('should be the very same class as ModalCommandBuilder, not a copy', () => {
    /* eslint-disable @typescript-eslint/no-deprecated, import-x/no-deprecated -- The deprecated alias IS the subject here. */
    // A copy would drift; a consumer still importing the old specifier has to get the class the rest of
    // These tests cover.
    expect(SuggestModalCommandBuilder).toBe(ModalCommandBuilder);
    expect(new SuggestModalCommandBuilder()).toBeInstanceOf(ModalCommandBuilder);
    /* eslint-enable @typescript-eslint/no-deprecated, import-x/no-deprecated -- The deprecated alias IS the subject here. */
  });
});
