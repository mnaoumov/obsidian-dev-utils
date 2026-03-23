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
      args: {
        a: 2,
        b: 3
      },
      fn: (args): number => args.a + args.b,
      vaultPath
    });
    expect(result).toBe(5);
  });

  it('should evaluate an anonymous function expression', async () => {
    const result = await evalObsidianCli({
      args: {
        a: 4,
        b: 5
      },
      fn(args): number {
        return args.a * args.b;
      },
      vaultPath
    });
    expect(result).toBe(20);
  });

  it('should evaluate a function declaration', async () => {
    interface Args {
      a: number;
      b: number;
    }
    function add(args: Args): number {
      return args.a + args.b;
    }
    const result = await evalObsidianCli({ args: { a: 10, b: 20 }, fn: add, vaultPath });
    expect(result).toBe(30);
  });

  it('should evaluate a shorthand method', async () => {
    interface Args {
      a: number;
      b: number;
    }
    const obj = {
      add(args: Args): number {
        return args.a + args.b;
      }
    };
    const result = await evalObsidianCli({ args: { a: 7, b: 8 }, fn: obj.add, vaultPath });
    expect(result).toBe(15);
  });

  it('should evaluate an async function', async () => {
    interface Args {
      a: number;
      b: number;
    }
    async function addAsync(args: Args): Promise<number> {
      return await Promise.resolve(args.a + args.b);
    }
    const result = await evalObsidianCli({ args: { a: 100, b: 200 }, fn: addAsync, vaultPath });
    expect(result).toBe(300);
  });

  it('should evaluate an async shorthand method', async () => {
    interface Args {
      a: number;
      b: number;
    }
    const obj = {
      async multiply(args: Args): Promise<number> {
        return await Promise.resolve(args.a * args.b);
      }
    };
    const result = await evalObsidianCli({
      args: {
        a: 6,
        b: 7
      },
      fn: obj.multiply,
      vaultPath
    });
    expect(result).toBe(42);
  });

  it('should pass string args', async () => {
    interface Args {
      parts: string[];
      sep: string;
    }
    const result = await evalObsidianCli({ args: { parts: ['a', 'b', 'c'], sep: '-' }, fn: concat, vaultPath });
    expect(result).toBe('a-b-c');

    function concat(args: Args): string {
      return args.parts.join(args.sep);
    }
  });

  it('should pass args with a multi-line function declaration', async () => {
    interface Args {
      base: number;
      factor: number;
    }
    function compute(args: Args): number {
      const doubled = args.base * 2;
      const result = doubled * args.factor;
      return result;
    }
    const result = await evalObsidianCli({ args: { base: 5, factor: 3 }, fn: compute, vaultPath });
    expect(result).toBe(30);
  });

  it('should pass args with an async shorthand method', async () => {
    interface Args {
      a: number;
      b: number;
    }
    const obj = {
      async compute(args: Args): Promise<number> {
        const sum = await Promise.resolve(args.a + args.b);
        return sum * 2;
      }
    };
    const result = await evalObsidianCli({ args: { a: 3, b: 4 }, fn: obj.compute, vaultPath });
    expect(result).toBe(14);
  });

  it('should preserve newlines in template literals', async () => {
    interface Args {
      name: string;
    }
    function withTemplate(args: Args): string {
      const text = `hello
world
${args.name}`;
      return text;
    }
    const result = await evalObsidianCli({ args: { name: 'test' }, fn: withTemplate, vaultPath });
    expect(result).toBe('hello\nworld\ntest');
  });

  it('should return void for a void function', async () => {
    expectTypeOf(
      // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression -- Testing void function.
      await evalObsidianCli({
        fn() {
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
        async fn(): Promise<void> {
          await Promise.resolve();
        },
        vaultPath
      })
    ).toBeVoid();
  });

  it('should provide the obsidian module via obsidianModule', async () => {
    const result = await evalObsidianCli({
      fn: (args): string => args.obsidianModule.stringifyYaml({ a: 1 }),
      vaultPath
    });
    expect(result).toBe('a: 1\n');
  });

  it('should pass function args and execute them in the Obsidian context', async () => {
    const result = await evalObsidianCli({
      args: {
        transform(x: number): number {
          return x * 2;
        },
        value: 5
      },
      fn: (args): number => args.transform(args.value),
      vaultPath
    });
    expect(result).toBe(10);
  });
});
