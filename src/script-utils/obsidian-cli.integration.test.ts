import type { App } from 'obsidian';

import {
  mkdtemp,
  rm
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  expectTypeOf,
  it
} from 'vitest';

import { evalObsidianCli } from './obsidian-cli.ts';

let vaultPath: string;

beforeAll(async () => {
  vaultPath = await mkdtemp(join(tmpdir(), 'obsidian-cli-test-'));
});

afterAll(async () => {
  await rm(vaultPath, { force: true, recursive: true });
});

describe('obsidian-cli integration', () => {
  it('should evaluate an anonymous arrow function', async () => {
    const result = await evalObsidianCli({
      args: [2, 3],
      fn: (_app: App, a: number, b: number): number => a + b,
      vaultPath
    });
    expect(result).toBe(5);
  });

  it('should evaluate an anonymous function expression', async () => {
    const result = await evalObsidianCli({
      args: [4, 5],
      fn(_app: App, a: number, b: number): number {
        return a * b;
      },
      vaultPath
    });
    expect(result).toBe(20);
  });

  it('should evaluate a function declaration', async () => {
    function add(_app: App, a: number, b: number): number {
      return a + b;
    }
    const result = await evalObsidianCli({ args: [10, 20], fn: add, vaultPath });
    expect(result).toBe(30);
  });

  it('should evaluate a shorthand method', async () => {
    const obj = {
      add(_app: App, a: number, b: number): number {
        return a + b;
      }
    };
    const result = await evalObsidianCli({ args: [7, 8], fn: obj.add, vaultPath });
    expect(result).toBe(15);
  });

  it('should evaluate an async function', async () => {
    async function addAsync(_app: App, a: number, b: number): Promise<number> {
      return await Promise.resolve(a + b);
    }
    const result = await evalObsidianCli({ args: [100, 200], fn: addAsync, vaultPath });
    expect(result).toBe(300);
  });

  it('should evaluate an async shorthand method', async () => {
    const obj = {
      async multiply(_app: App, a: number, b: number): Promise<number> {
        return await Promise.resolve(a * b);
      }
    };
    const result = await evalObsidianCli({ args: [6, 7], fn: obj.multiply, vaultPath });
    expect(result).toBe(42);
  });

  it('should pass string args', async () => {
    // eslint-disable-next-line func-style -- Testing arrow function form.
    const concat = (_app: App, sep: string, ...parts: string[]): string => parts.join(sep);
    const result = await evalObsidianCli({ args: ['-', 'a', 'b', 'c'], fn: concat, vaultPath });
    expect(result).toBe('a-b-c');
  });

  it('should pass args with a multi-line function declaration', async () => {
    function compute(_app: App, base: number, factor: number): number {
      const doubled = base * 2;
      const result = doubled * factor;
      return result;
    }
    const result = await evalObsidianCli({ args: [5, 3], fn: compute, vaultPath });
    expect(result).toBe(30);
  });

  it('should pass args with an async shorthand method', async () => {
    const obj = {
      async compute(_app: App, a: number, b: number): Promise<number> {
        const sum = await Promise.resolve(a + b);
        return sum * 2;
      }
    };
    const result = await evalObsidianCli({ args: [3, 4], fn: obj.compute, vaultPath });
    expect(result).toBe(14);
  });

  it('should preserve newlines in template literals', async () => {
    function withTemplate(_app: App, name: string): string {
      const text = `hello
world
${name}`;
      return text;
    }
    const result = await evalObsidianCli({ args: ['test'], fn: withTemplate, vaultPath });
    expect(result).toBe('hello\nworld\ntest');
  });

  it('should return void for a void function', async () => {
    expectTypeOf(
      // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression -- Testing void function.
      await evalObsidianCli({
        fn(_app: App): void {
          // Cannot use `noop()` here because `evalObsidianCli()` does not accept functions with external imports.
        },
        vaultPath
      })
    ).toBeVoid();
  });

  it('should return void for an async void function', async () => {
    expectTypeOf(
      // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression -- Testing void function.
      await evalObsidianCli({
        async fn(_app: App): Promise<void> {
          await Promise.resolve();
        },
        vaultPath
      })
    ).toBeVoid();
  });
});
