import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import {
  CliTaskResult,
  toCommandLine,
  wrapCliTask
} from '../../src/script-utils/cli-utils.ts';

const { mockExit } = vi.hoisted(() => ({
  mockExit: vi.fn()
}));

vi.mock('../../src/script-utils/node-modules.ts', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../src/script-utils/node-modules.ts')>();
  return {
    ...mod,
    process: { ...mod.process, exit: mockExit }
  };
});

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
  beforeEach(() => {
    mockExit.mockClear();
  });

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

  describe('exit', () => {
    it('should exit with code 0 for Success', () => {
      CliTaskResult.Success().exit();
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it('should exit with code 1 for Failure', () => {
      CliTaskResult.Failure().exit();
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should exit with code 0 for FromExitCode(0)', () => {
      CliTaskResult.FromExitCode(0).exit();
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it('should exit with the specified exit code', () => {
      CliTaskResult.FromExitCode(42).exit();
      expect(mockExit).toHaveBeenCalledWith(42);
    });

    it('should not call process.exit for DoNotExit', () => {
      CliTaskResult.DoNotExit().exit();
      expect(mockExit).not.toHaveBeenCalled();
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

    it('should catch a throwing task and return failure', async () => {
      const results: string[] = [];
      await CliTaskResult.chain([
        (): never => {
          throw new Error('task exploded');
        },
        (): CliTaskResult => {
          results.push('should-not-run');
          return CliTaskResult.Success();
        }
      ]);

      expect(results).toEqual([]);
    });

    it('should treat a task returning void as success', async () => {
      const results: string[] = [];
      await CliTaskResult.chain([
        (): void => {
          results.push('void-task');
        },
        (): CliTaskResult => {
          results.push('next');
          return CliTaskResult.Success();
        }
      ]);

      expect(results).toEqual(['void-task', 'next']);
    });

    it('should treat DoNotExit as successful in a chain', async () => {
      const results: string[] = [];
      await CliTaskResult.chain([
        (): CliTaskResult => {
          results.push('doNotExit');
          return CliTaskResult.DoNotExit();
        },
        (): CliTaskResult => {
          results.push('next');
          return CliTaskResult.Success();
        }
      ]);

      expect(results).toEqual(['doNotExit', 'next']);
    });
  });
});

describe('wrapCliTask', () => {
  beforeEach(() => {
    mockExit.mockClear();
  });

  it('should exit with code 0 for a successful task', async () => {
    await wrapCliTask(() => CliTaskResult.Success());
    expect(mockExit).toHaveBeenCalledWith(0);
  });

  it('should exit with code 1 for a failed task', async () => {
    await wrapCliTask(() => CliTaskResult.Failure());
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should exit with the task exit code', async () => {
    await wrapCliTask(() => CliTaskResult.FromExitCode(42));
    expect(mockExit).toHaveBeenCalledWith(42);
  });

  it('should exit with code 0 for FromExitCode(0)', async () => {
    await wrapCliTask(() => CliTaskResult.FromExitCode(0));
    expect(mockExit).toHaveBeenCalledWith(0);
  });

  it('should exit with code 1 when the task throws', async () => {
    await wrapCliTask((): never => {
      throw new Error('boom');
    });
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should not call process.exit for DoNotExit', async () => {
    await wrapCliTask(() => CliTaskResult.DoNotExit());
    expect(mockExit).not.toHaveBeenCalled();
  });

  it('should treat a void-returning task as success', async () => {
    await wrapCliTask((): void => {
      // No return
    });
    expect(mockExit).toHaveBeenCalledWith(0);
  });
});
