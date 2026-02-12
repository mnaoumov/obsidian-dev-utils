import {
  describe,
  expect,
  it
} from 'vitest';

import {
  CliTaskResult,
  toCommandLine
} from '../../src/ScriptUtils/CliUtils.ts';

describe('toCommandLine', () => {
  it.each([
    [['simple'], 'simple'],
    [['arg1', 'arg2'], 'arg1 arg2'],
    [['hello world'], '"hello world"'],
    [['say "hi"'], '"say \\"hi\\""'],
    [['line1\nline2'], '"line1\\nline2"'],
    [['no-special'], 'no-special'],
    [[''], ''],
    [['a', 'b c', 'd'], 'a "b c" d']
  ])('should convert %j to %j', (args: string[], expected: string) => {
    expect(toCommandLine(args)).toBe(expected);
  });
});

describe('CliTaskResult', () => {
  describe('factory methods', () => {
    it('should create Success without throwing', () => {
      expect(() => CliTaskResult.Success()).not.toThrow();
    });

    it('should create Failure without throwing', () => {
      expect(() => CliTaskResult.Failure()).not.toThrow();
    });

    it('should create FromExitCode without throwing', () => {
      expect(() => CliTaskResult.FromExitCode(0)).not.toThrow();
    });

    it('should create DoNotExit without throwing', () => {
      expect(() => CliTaskResult.DoNotExit()).not.toThrow();
    });
  });

  describe('DoNotExit', () => {
    it('should not throw when exit is called', () => {
      expect(() => {
        CliTaskResult.DoNotExit().exit();
      }).not.toThrow();
    });
  });

  describe('chain', () => {
    it('should return success when all tasks succeed', async () => {
      const results: string[] = [];
      await CliTaskResult.chain([
        (): CliTaskResult => {
          results.push('first');
          return CliTaskResult.Success();
        },
        (): CliTaskResult => {
          results.push('second');
          return CliTaskResult.Success();
        },
        (): CliTaskResult => {
          results.push('third');
          return CliTaskResult.Success();
        }
      ]);

      expect(results).toEqual(['first', 'second', 'third']);
    });

    it('should continue chain when Success is returned', async () => {
      const results: string[] = [];
      await CliTaskResult.chain([
        (): CliTaskResult => {
          results.push('first');
          return CliTaskResult.Success();
        },
        (): CliTaskResult => {
          results.push('second');
          return CliTaskResult.Success();
        }
      ]);

      expect(results).toEqual(['first', 'second']);
    });

    it('should stop at first failure', async () => {
      const results: string[] = [];
      await CliTaskResult.chain([
        (): CliTaskResult => {
          results.push('first');
          return CliTaskResult.Success();
        },
        (): CliTaskResult => {
          results.push('second');
          return CliTaskResult.Failure();
        },
        (): CliTaskResult => {
          results.push('third');
          return CliTaskResult.Success();
        }
      ]);

      expect(results).toEqual(['first', 'second']);
    });

    it('should treat Failure as not successful via chain', async () => {
      const results: string[] = [];
      await CliTaskResult.chain([
        (): CliTaskResult => {
          results.push('before');
          return CliTaskResult.Failure();
        },
        (): CliTaskResult => {
          results.push('after');
          return CliTaskResult.Success();
        }
      ]);

      expect(results).toEqual(['before']);
    });

    it('should treat FromExitCode(0) as successful via chain', async () => {
      const results: string[] = [];
      await CliTaskResult.chain([
        (): CliTaskResult => {
          results.push('first');
          return CliTaskResult.FromExitCode(0);
        },
        (): CliTaskResult => {
          results.push('second');
          return CliTaskResult.Success();
        }
      ]);

      expect(results).toEqual(['first', 'second']);
    });

    it('should treat FromExitCode(1) as not successful via chain', async () => {
      const results: string[] = [];
      await CliTaskResult.chain([
        (): CliTaskResult => {
          results.push('first');
          return CliTaskResult.FromExitCode(1);
        },
        (): CliTaskResult => {
          results.push('second');
          return CliTaskResult.Success();
        }
      ]);

      expect(results).toEqual(['first']);
    });

    it('should return success for empty task array', async () => {
      const result = await CliTaskResult.chain([]);
      const results: string[] = [];
      await CliTaskResult.chain([
        (): CliTaskResult => {
          results.push('after-empty');
          return result;
        },
        (): CliTaskResult => {
          results.push('continued');
          return CliTaskResult.Success();
        }
      ]);

      expect(results).toEqual(['after-empty', 'continued']);
    });
  });
});
