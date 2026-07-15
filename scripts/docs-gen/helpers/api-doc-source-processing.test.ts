import dedent from 'dedent';
import { Project } from 'ts-morph';
import {
  describe,
  expect,
  it
} from 'vitest';

import type { TypeInfo } from './api-doc-types.ts';

import {
  collectFunctions,
  collectVariables,
  computeNamespace,
  processSourceFile,
  registerGenericTypeParams
} from './api-doc-source-processing.ts';

describe('api-doc source processing', () => {
  it('collects exported declarations and skips private implementation details', () => {
    const sourceFile = new Project({ useInMemoryFileSystem: true }).createSourceFile('alpha.ts', dedent`
      /** A function.
       * @param value - The input.
       * @returns - The output.
       */
      export function alpha(value: string): number { return value.length; }
      /** A value. */
      export const BRAVO = 'bravo';
      function hidden(): void {}
    `);
    const types = new Map<string, TypeInfo>();

    collectFunctions(sourceFile, types, 'alpha');
    collectVariables(sourceFile, types, 'alpha');

    expect(types).toMatchObject(new Map([
      ['alpha#alpha', { kind: 'function', methods: [{ parameters: [{ description: 'The input.', name: 'value' }], returnDescription: 'The output.', returnType: 'number' }] }],
      ['alpha#BRAVO', { kind: 'variable', variableKeyword: 'const', variableType: '"bravo"' }]
    ]));
  });

  it('processes classes, interfaces, enums, aliases, and generic type parameters', () => {
    const sourceFile = new Project({ useInMemoryFileSystem: true }).createSourceFile('bravo.ts', dedent`
      export class Alpha<T> {}
      export interface Bravo {}
      export enum Charlie { Delta }
      export type Echo<T> = T;
    `);
    const types = new Map<string, TypeInfo>();

    processSourceFile(sourceFile, types, 'bravo');
    registerGenericTypeParams(types);

    expect([...types.values()].map((info) => info.kind).sort()).toEqual(['class', 'enum', 'interface', 'type']);
    expect(types.has('bravo#T')).toBe(false);
    expect(computeNamespace('F:/repo/src', 'F:/repo/src/obsidian/alpha.ts')).toBe('obsidian/alpha');
  });
});
