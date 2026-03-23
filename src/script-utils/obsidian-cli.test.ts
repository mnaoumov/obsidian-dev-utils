import {
  describe,
  expect,
  expectTypeOf,
  it,
  vi
} from 'vitest';

import { noop } from '../function.ts';
import { ensureNonNullable } from '../type-guards.ts';
import { evalObsidianCli } from './obsidian-cli.ts';

const mockExec = vi.hoisted(() => vi.fn<() => Promise<string>>());

vi.mock('./exec.ts', () => ({
  exec: mockExec
}));

function getLastCodeArg(): string {
  const lastCall = mockExec.mock.lastCall as unknown[];
  const cmdArgs = lastCall[0] as string[];
  const codeArg = ensureNonNullable(cmdArgs[2]);
  expect(codeArg).toMatch(/^code=/);
  return codeArg.slice('code='.length);
}

describe('evalObsidianCli', () => {
  it('should parse JSON result from exec output', async () => {
    mockExec.mockResolvedValue('=> {"key":"value"}');
    const result = await evalObsidianCli({
      fn: (): Record<string, string> => ({ key: 'value' }),
      vaultPath: '/tmp/vault'
    });
    expect(result).toEqual({ key: 'value' });
  });

  it('should return void when exec outputs (no output)', async () => {
    mockExec.mockResolvedValue('=> (no output)');

    expectTypeOf(
      // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression -- Testing void function.
      await evalObsidianCli({
        args: { pluginId: 'test-plugin' },
        async fn(args): Promise<void> {
          await Promise.resolve(args.pluginId);
        },
        vaultPath: '/tmp/vault'
      })
    ).toBeVoid();
  });

  it('should handle (no output) without => prefix', async () => {
    mockExec.mockResolvedValue('(no output)');

    expectTypeOf(
      // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression -- Testing void function.
      await evalObsidianCli({
        fn(): void {
          noop();
        },
        vaultPath: '/tmp/vault'
      })
    ).toBeVoid();
  });

  it('should pass args to the exec command', async () => {
    mockExec.mockResolvedValue('=> 5');
    const result = await evalObsidianCli({
      args: { a: 2, b: 3 },
      fn(args): number {
        return args.a + args.b;
      },
      vaultPath: '/tmp/vault'
    });
    expect(result).toBe(5);
    expect(mockExec).toHaveBeenCalledWith(
      expect.arrayContaining(['obsidian', 'eval']),
      expect.objectContaining({ cwd: '/tmp/vault', isQuiet: true })
    );
  });

  it('should generate syntactically valid JavaScript in the code argument', async () => {
    mockExec.mockResolvedValue('=> 5');
    await evalObsidianCli({
      args: { a: 2, b: 3 },
      fn(args): number {
        return args.a + args.b;
      },
      vaultPath: '/tmp/vault'
    });
    // eslint-disable-next-line no-new-func, @typescript-eslint/no-implied-eval -- We don't eval, we just check the syntax.
    expect(() => new Function(getLastCodeArg())).not.toThrow();
  });

  it('should generate valid JavaScript when args contain functions', async () => {
    mockExec.mockResolvedValue('=> 10');
    await evalObsidianCli({
      args: {
        transform(x: number): number {
          return x * 2;
        },
        value: 5
      },
      fn(args): number {
        return args.transform(args.value);
      },
      vaultPath: '/tmp/vault'
    });
    // eslint-disable-next-line no-new-func, @typescript-eslint/no-implied-eval -- We don't eval, we just checking the syntax.
    expect(() => new Function(getLastCodeArg())).not.toThrow();
  });

  it('should handle result without => prefix', async () => {
    mockExec.mockResolvedValue('"hello"');
    const result = await evalObsidianCli({
      fn(): string {
        return 'hello';
      },
      vaultPath: '/tmp/vault'
    });
    expect(result).toBe('hello');
  });
});
