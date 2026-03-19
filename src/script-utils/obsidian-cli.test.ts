import type { App } from 'obsidian';

import {
  describe,
  expect,
  expectTypeOf,
  it,
  vi
} from 'vitest';

import { noop } from '../function.ts';
import { evalObsidianCli } from './obsidian-cli.ts';

const mockExec = vi.hoisted(() => vi.fn<() => Promise<string>>());

vi.mock('./exec.ts', () => ({
  exec: mockExec
}));

describe('evalObsidianCli', () => {
  it('should parse JSON result from exec output', async () => {
    mockExec.mockResolvedValue('=> {"key":"value"}');
    const result = await evalObsidianCli({
      fn: (_app: App): Record<string, string> => ({ key: 'value' }),
      vaultPath: '/tmp/vault'
    });
    expect(result).toEqual({ key: 'value' });
  });

  it('should return void when exec outputs (no output)', async () => {
    mockExec.mockResolvedValue('=> (no output)');

    expectTypeOf(
      // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression -- Testing void function.
      await evalObsidianCli({
        args: ['test-plugin'],
        async fn(_app: App, id: string): Promise<void> {
          await Promise.resolve(id);
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
        fn: (_app: App): void => {
          noop();
        },
        vaultPath: '/tmp/vault'
      })
    ).toBeVoid();
  });

  it('should pass args to the exec command', async () => {
    mockExec.mockResolvedValue('=> 5');
    const result = await evalObsidianCli({
      args: [2, 3],
      fn: (_app: App, a: number, b: number): number => a + b,
      vaultPath: '/tmp/vault'
    });
    expect(result).toBe(5);
    expect(mockExec).toHaveBeenCalledWith(
      expect.arrayContaining(['obsidian', 'eval']),
      expect.objectContaining({ cwd: '/tmp/vault', isQuiet: true })
    );
  });

  it('should handle result without => prefix', async () => {
    mockExec.mockResolvedValue('"hello"');
    const result = await evalObsidianCli({
      fn: (_app: App): string => 'hello',
      vaultPath: '/tmp/vault'
    });
    expect(result).toBe('hello');
  });
});
