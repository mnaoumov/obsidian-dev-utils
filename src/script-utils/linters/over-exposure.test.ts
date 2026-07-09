import type {
  CompilerOptions,
  LanguageService
} from 'typescript-6';

import dedent from 'dedent';
import {
  createDocumentRegistry,
  createLanguageService,
  ModuleKind,
  ModuleResolutionKind,
  ScriptTarget,
  sys
} from 'typescript-6';
import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { ParsedTsConfig } from '../check-project-types.ts';
import type {
  OverExposureFileSystem,
  OverExposureFinding,
  OverExposureProgress
} from './over-exposure.ts';

import { strictProxy } from '../../strict-proxy.ts';
import {
  analyzeOverExposure,
  createLanguageServiceHost,
  createProjectLanguageService,
  findOverExposure,
  formatOverExposureFindings,
  LIFECYCLE_ALLOWLIST
} from './over-exposure.ts';

const { mockParseTsConfig } = vi.hoisted(() => ({
  mockParseTsConfig: vi.fn<(tsConfigPath: string) => ParsedTsConfig>()
}));

vi.mock('../check-project-types.ts', async (importOriginal) => ({
  ...await importOriginal<typeof import('../check-project-types.ts')>(),
  parseTsConfig: mockParseTsConfig
}));

interface ApplyFixesOptions {
  readonly shouldForce?: boolean;
}

interface ApplyFixesOutcome {
  readonly findings: readonly OverExposureFinding[];
  readonly writes: Map<string, string>;
}

const SRC_FOLDER = '/proj/src';

const COMPILER_OPTIONS: CompilerOptions = {
  allowImportingTsExtensions: true,
  module: ModuleKind.ESNext,
  moduleResolution: ModuleResolutionKind.Bundler,
  noLib: true,
  skipLibCheck: true,
  target: ScriptTarget.ES2022
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('analyzeOverExposure', () => {
  it('should return empty when the language service has no program', () => {
    const languageService = strictProxy<LanguageService>({
      getProgram: () => undefined
    });
    expect(analyzeOverExposure({ languageService, srcFolder: SRC_FOLDER })).toEqual([]);
  });

  it('should flag a protected member referenced only inside its own class as private', () => {
    const findings = analyze({
      '/proj/src/a.ts': `
        export class A {
          protected helper(): number {
            return 1;
          }
          public run(): number {
            return this.helper();
          }
        }
      `
    });
    const helper = findFinding(findings, 'helper');
    expect(helper.currentExposure).toBe('protected');
    expect(helper.suggestedExposure).toBe('private');
    expect(helper.isMember).toBe(true);
    expect(helper.isForcedByTestOnly).toBe(false);
    expect(helper.hasNoReferences).toBe(false);
  });

  it('should flag a public member referenced only inside its own class as private', () => {
    const findings = analyze({
      '/proj/src/a.ts': `
        export class A {
          public helper(): number {
            return 1;
          }
          public run(): number {
            return this.helper();
          }
        }
      `
    });
    expect(findFinding(findings, 'helper').suggestedExposure).toBe('private');
  });

  it('should flag a public member with no references at all', () => {
    const findings = analyze({
      '/proj/src/a.ts': `
        export class A {
          public unused(): number {
            return 1;
          }
        }
      `
    });
    const unused = findFinding(findings, 'unused');
    expect(unused.suggestedExposure).toBe('private');
    expect(unused.hasNoReferences).toBe(true);
  });

  it('should not flag a member documented with a TSDoc comment', () => {
    const findings = analyze({
      '/proj/src/a.ts': `
        export class A {
          /**
           * Helper.
           *
           * @returns A number.
           */
          public helper(): number {
            return 1;
          }
          public run(): number {
            return this.helper();
          }
        }
      `
    });
    expect(hasFinding(findings, 'helper')).toBe(false);
  });

  it('should still flag an undocumented member alongside a documented one', () => {
    const findings = analyze({
      '/proj/src/a.ts': `
        export class A {
          /** Documented. */
          public documented(): number {
            return 1;
          }
          public undocumented(): number {
            return 2;
          }
          public run(): number {
            return this.documented() + this.undocumented();
          }
        }
      `
    });
    expect(hasFinding(findings, 'documented')).toBe(false);
    expect(findFinding(findings, 'undocumented').suggestedExposure).toBe('private');
  });

  it('should not flag an ECMAScript hard-private member', () => {
    const findings = analyze({
      '/proj/src/a.ts': `
        export class A {
          readonly #hidden = 1;
          public run(): number {
            return this.#hidden;
          }
        }
      `
    });
    expect(hasFinding(findings, '#hidden')).toBe(false);
  });

  it('should still flag a member whose only leading comments are not TSDoc', () => {
    const findings = analyze({
      '/proj/src/a.ts': `
        export class A {
          // line comment
          /* block comment */
          /**/
          public helper(): number {
            return 1;
          }
          public run(): number {
            return this.helper();
          }
        }
      `
    });
    expect(findFinding(findings, 'helper').suggestedExposure).toBe('private');
  });

  it('should suggest protected for a public member used only in a subclass', () => {
    const findings = analyze({
      '/proj/src/a.ts': `
        export class Base {
          public shared(): number {
            return 1;
          }
        }
        export class Derived extends Base {
          public use(): number {
            return this.shared();
          }
        }
      `
    });
    const shared = findFinding(findings, 'shared');
    expect(shared.currentExposure).toBe('public');
    expect(shared.suggestedExposure).toBe('protected');
  });

  it('should suggest protected via a transitive subclass', () => {
    const findings = analyze({
      '/proj/src/a.ts': `
        export class A {
          public shared(): number {
            return 1;
          }
        }
        export class B extends A {}
        export class C extends B {
          public use(): number {
            return this.shared();
          }
        }
      `
    });
    expect(findFinding(findings, 'shared').suggestedExposure).toBe('protected');
  });

  it('should not flag a protected member already used in a subclass', () => {
    const findings = analyze({
      '/proj/src/a.ts': `
        export class Base {
          protected shared(): number {
            return 1;
          }
        }
        export class Derived extends Base {
          public use(): number {
            return this.shared();
          }
        }
      `
    });
    expect(hasFinding(findings, 'shared')).toBe(false);
  });

  it('should not flag a public member used outside its class hierarchy', () => {
    const findings = analyze({
      '/proj/src/a.ts': `
        export class A {
          public api(): number {
            return 1;
          }
        }
        export function consume(a: A): number {
          return a.api();
        }
      `
    });
    expect(hasFinding(findings, 'api')).toBe(false);
  });

  it('should not flag a public member used by an unrelated class', () => {
    const findings = analyze({
      '/proj/src/a.ts': `
        export class A {
          public api(): number {
            return 1;
          }
        }
        export class Unrelated {
          public use(a: A): number {
            return a.api();
          }
        }
      `
    });
    expect(hasFinding(findings, 'api')).toBe(false);
  });

  it('should not flag a public member used by a class that only implements an interface', () => {
    const findings = analyze({
      '/proj/src/a.ts': `
        export interface Marker {
          mark(): void;
        }
        export class A {
          public api(): number {
            return 1;
          }
        }
        export class Implementor implements Marker {
          public mark(): void {
            void 0;
          }
          public use(a: A): number {
            return a.api();
          }
        }
      `
    });
    expect(hasFinding(findings, 'api')).toBe(false);
  });

  it('should not flag a public member when the base reference cannot be resolved to a class symbol', () => {
    const findings = analyze({
      '/proj/src/a.ts': `
        export class A {
          public api(): number {
            return 1;
          }
        }
        export class Weird extends (null as any) {
          public use(a: A): number {
            return a.api();
          }
        }
      `
    });
    expect(hasFinding(findings, 'api')).toBe(false);
  });

  it('should not flag a public member when the extends target is not a class declaration', () => {
    const findings = analyze({
      '/proj/src/a.ts': `
        export class A {
          public api(): number {
            return 1;
          }
        }
        interface Mixin {
          tag: string;
        }
        declare const Mixin: { new (): Mixin; };
        export class FromMixin extends Mixin {
          public use(a: A): number {
            return a.api();
          }
        }
      `
    });
    expect(hasFinding(findings, 'api')).toBe(false);
  });

  it('should flag a member exposed only for tests', () => {
    const findings = analyze({
      '/proj/src/a.test.ts': `
        import { A } from './a.ts';
        const value = new A().probe();
        void value;
      `,
      '/proj/src/a.ts': `
        export class A {
          public probe(): number {
            return 1;
          }
        }
      `
    });
    const probe = findFinding(findings, 'probe');
    expect(probe.suggestedExposure).toBe('private');
    expect(probe.isForcedByTestOnly).toBe(true);
    expect(probe.hasNoReferences).toBe(false);
  });

  it('should skip private, static, override, and lifecycle members', () => {
    const findings = analyze({
      '/proj/src/a.ts': `
        export class Base {
          public onload(): void {
            void 0;
          }
          protected hook(): void {
            void 0;
          }
        }
        export class A extends Base {
          private secret(): number {
            return 1;
          }
          public static factory(): A {
            return new A();
          }
          public override onload(): void {
            void 0;
          }
          protected override hook(): void {
            void 0;
          }
        }
      `
    });
    expect(hasFinding(findings, 'secret')).toBe(false);
    expect(hasFinding(findings, 'factory')).toBe(false);
    expect(findings.filter((finding) => finding.name === 'onload')).toEqual([]);
    expect(findings.filter((finding) => finding.name === 'hook')).toEqual([]);
  });

  it('should flag property, getter, and setter members', () => {
    const findings = analyze({
      '/proj/src/a.ts': `
        export class A {
          public field = 1;
          public get value(): number {
            return this.field;
          }
          public set value(next: number) {
            this.field = next;
          }
          public run(): number {
            this.value = this.field;
            return this.value;
          }
        }
      `
    });
    expect(findFinding(findings, 'field').suggestedExposure).toBe('private');
    expect(hasFinding(findings, 'value')).toBe(true);
  });

  it('should ignore object-literal methods and accessors that have no enclosing class', () => {
    const findings = analyze({
      '/proj/src/a.ts': `
        export const obj = {
          method(): number {
            return 1;
          },
          get value(): number {
            return 2;
          }
        };
        const used = obj.method() + obj.value;
        void used;
      `
    });
    expect(hasFinding(findings, 'method')).toBe(false);
    expect(hasFinding(findings, 'value')).toBe(false);
  });

  it('should ignore object-literal accessors nested inside a class method (property descriptors)', () => {
    const findings = analyze({
      '/proj/src/a.ts': `
        export class A {
          public define(target: object): void {
            Object.defineProperty(target, 'stack', {
              get(): number {
                return 1;
              },
              set(next: number): void {
                void next;
              }
            });
          }
        }
      `
    });
    expect(hasFinding(findings, 'get')).toBe(false);
    expect(hasFinding(findings, 'set')).toBe(false);
  });

  it('should tolerate a member whose name yields no reference symbols (computed name)', () => {
    const findings = analyze({
      '/proj/src/a.ts': `
        const key = 'dynamic';
        export class A {
          public [key](): number {
            return 1;
          }
        }
      `
    });
    expect(Array.isArray(findings)).toBe(true);
  });

  it('should report progress once per analyzed source file, skipping test files', () => {
    const files = {
      '/proj/src/a.test.ts': `
        import { helper } from './a.ts';
        export const value = helper();
      `,
      '/proj/src/a.ts': `
        export function helper(): number {
          return 1;
        }
      `,
      '/proj/src/b.ts': `
        export function other(): number {
          return 2;
        }
      `
    };
    const fileSystem = createSpyFileSystem(files);
    const host = createLanguageServiceHost({ compilerOptions: COMPILER_OPTIONS, fileNames: Object.keys(files), fileSystem });
    const languageService = createLanguageService(host, createDocumentRegistry());

    const progressEvents: OverExposureProgress[] = [];
    analyzeOverExposure({
      languageService,
      onProgress: (progress) => progressEvents.push(progress),
      srcFolder: SRC_FOLDER
    });

    expect(progressEvents).toHaveLength(2);
    expect(new Set(progressEvents.map((event) => event.currentFilePath))).toEqual(new Set(['/proj/src/a.ts', '/proj/src/b.ts']));
    expect(progressEvents.map((event) => event.analyzedFileCount)).toEqual([0, 1]);
    expect(progressEvents.map((event) => event.totalFileCount)).toEqual([2, 2]);
  });

  it('should report a member of an anonymous class expression used externally as public', () => {
    const findings = analyze({
      '/proj/src/a.ts': `
        const Holder = class {
          public solo(): number {
            return 1;
          }
        };
        export class User {
          public use(): number {
            return new Holder().solo();
          }
        }
      `
    });
    expect(hasFinding(findings, 'solo')).toBe(false);
  });

  it('should not flag a member referenced via a string-literal key whose contextual type is a single literal', () => {
    const findings = analyze({
      '/proj/src/a.ts': `
        type ConditionalKeys<Base, Condition> = {
          [Key in keyof Base]-?: Base[Key] extends Condition ? Key : never;
        }[keyof Base];
        export class Settings {
          public included = '';
          public count = 0;
        }
        export class Tab {
          public bind<Value>(value: Value, key: ConditionalKeys<Settings, Value>): void {
            void value;
            void key;
          }
          public render(): void {
            this.bind<string>('', 'included');
          }
        }
      `
    });
    expect(hasFinding(findings, 'included')).toBe(false);
  });

  it('should not flag a member used in production via a string-literal key even when only tests reference it directly', () => {
    const findings = analyze({
      '/proj/src/settings.test.ts': `
        import { Settings } from './settings.ts';
        const settings = new Settings();
        settings.included = 'x';
        void settings;
      `,
      '/proj/src/settings.ts': `
        type ConditionalKeys<Base, Condition> = {
          [Key in keyof Base]-?: Base[Key] extends Condition ? Key : never;
        }[keyof Base];
        export class Settings {
          public included = '';
        }
        export class Tab {
          public bind<Value>(value: Value, key: ConditionalKeys<Settings, Value>): void {
            void value;
            void key;
          }
          public render(): void {
            this.bind<string>('', 'included');
          }
        }
      `
    });
    expect(hasFinding(findings, 'included')).toBe(false);
  });

  it('should not flag a member referenced via a keyof string-literal key argument', () => {
    const findings = analyze({
      '/proj/src/a.ts': `
        export class Settings {
          public alpha = 1;
          public beta = 2;
        }
        export class Reader {
          public read(key: keyof Settings): void {
            void key;
          }
          public run(): void {
            this.read('alpha');
          }
        }
      `
    });
    expect(hasFinding(findings, 'alpha')).toBe(false);
  });

  it('should still flag a member when a same-named string literal has no contextual type', () => {
    const findings = analyze({
      '/proj/src/a.ts': `
        export class A {
          public helper(): number {
            return 1;
          }
        }
        export const label = 'helper';
      `
    });
    expect(findFinding(findings, 'helper').suggestedExposure).toBe('private');
  });

  it('should still flag a member when a same-named string literal is contextually typed as a plain string', () => {
    const findings = analyze({
      '/proj/src/a.ts': `
        export class A {
          public helper(): number {
            return 1;
          }
        }
        export function log(message: string): void {
          void message;
        }
        log('helper');
      `
    });
    expect(findFinding(findings, 'helper').suggestedExposure).toBe('private');
  });

  it('should still flag a member when the key argument also accepts a non-string-literal type', () => {
    const findings = analyze({
      '/proj/src/a.ts': `
        export class A {
          public helper(): number {
            return 1;
          }
        }
        export function take(key: 'helper' | number): void {
          void key;
        }
        take('helper');
      `
    });
    expect(findFinding(findings, 'helper').suggestedExposure).toBe('private');
  });

  it('should still flag a member when the string-literal key argument expects keys of a different shape', () => {
    const findings = analyze({
      '/proj/src/a.ts': `
        export class A {
          public helper(): number {
            return 1;
          }
        }
        export function take(key: 'helper' | 'other'): void {
          void key;
        }
        take('helper');
      `
    });
    expect(findFinding(findings, 'helper').suggestedExposure).toBe('private');
  });

  it('should resolve the key set of an anonymous class via its instance type', () => {
    const findings = analyze({
      '/proj/src/a.ts': `
        const Holder = class {
          public solo(): number {
            return 1;
          }
        };
        void Holder;
        export const label = 'solo';
      `
    });
    expect(findFinding(findings, 'solo').suggestedExposure).toBe('private');
  });

  it('should not index string literals declared in declaration files', () => {
    const findings = analyze({
      '/proj/src/a.d.ts': `
        export type HelperKey = 'helper';
      `,
      '/proj/src/a.ts': `
        export class A {
          public helper(): number {
            return 1;
          }
        }
      `
    });
    expect(findFinding(findings, 'helper').suggestedExposure).toBe('private');
  });
});

describe('analyzeOverExposure exports', () => {
  it('should flag an export referenced only within its own file', () => {
    const findings = analyze({
      '/proj/src/a.ts': `
        export function helper(): number {
          return 1;
        }
        export function main(): number {
          return helper();
        }
      `,
      '/proj/src/b.ts': `
        import { main } from './a.ts';
        export const result = main();
      `
    });
    const helper = findFinding(findings, 'helper');
    expect(helper.currentExposure).toBe('export');
    expect(helper.suggestedExposure).toBe('file-local');
    expect(helper.isMember).toBe(false);
    expect(helper.hasNoReferences).toBe(false);
    expect(hasFinding(findings, 'main')).toBe(false);
  });

  it('should not flag a documented export referenced only within its own file', () => {
    const findings = analyze({
      '/proj/src/a.ts': `
        /**
         * A documented helper.
         *
         * @returns A number.
         */
        export function helper(): number {
          return 1;
        }
        export function main(): number {
          return helper();
        }
      `
    });
    expect(hasFinding(findings, 'helper')).toBe(false);
  });

  it('should not flag a documented exported interface, type, enum, or const', () => {
    const findings = analyze({
      '/proj/src/a.ts': `
        /** A documented shape. */
        export interface LocalShape {
          tag: string;
        }
        /** A documented alias. */
        export type LocalAlias = number;
        /** A documented enum. */
        export enum LocalEnum {
          A,
          B
        }
        /** A documented value. */
        export const localValue = 1;
        const shape: LocalShape = { tag: 'x' };
        const alias: LocalAlias = 1;
        const fromEnum = LocalEnum.A;
        const fromValue = localValue;
        void shape;
        void alias;
        void fromEnum;
        void fromValue;
      `
    });
    expect(hasFinding(findings, 'LocalShape')).toBe(false);
    expect(hasFinding(findings, 'LocalAlias')).toBe(false);
    expect(hasFinding(findings, 'LocalEnum')).toBe(false);
    expect(hasFinding(findings, 'localValue')).toBe(false);
  });

  it('should still flag a documented export whose only leading comment is not TSDoc', () => {
    const findings = analyze({
      '/proj/src/a.ts': `
        // line comment
        /* block comment */
        export function helper(): number {
          return 1;
        }
        export function main(): number {
          return helper();
        }
      `
    });
    expect(findFinding(findings, 'helper').suggestedExposure).toBe('file-local');
  });

  it('should flag an export with no references at all', () => {
    const findings = analyze({
      '/proj/src/a.ts': `
        export function orphan(): number {
          return 1;
        }
      `
    });
    expect(findFinding(findings, 'orphan').hasNoReferences).toBe(true);
  });

  it('should flag an export used only from a test file', () => {
    const findings = analyze({
      '/proj/src/a.test.ts': `
        import { probe } from './a.ts';
        export const value = probe();
      `,
      '/proj/src/a.ts': `
        export function probe(): number {
          return 1;
        }
      `
    });
    const probe = findFinding(findings, 'probe');
    expect(probe.suggestedExposure).toBe('file-local');
    expect(probe.isForcedByTestOnly).toBe(true);
  });

  it('should flag exported interfaces, types, enums, and const declarations', () => {
    const findings = analyze({
      '/proj/src/a.ts': `
        export interface LocalShape {
          tag: string;
        }
        export type LocalAlias = number;
        export enum LocalEnum {
          A,
          B
        }
        export const localValue = 1;
        const shape: LocalShape = { tag: 'x' };
        const alias: LocalAlias = 1;
        const fromEnum = LocalEnum.A;
        const fromValue = localValue;
        void shape;
        void alias;
        void fromEnum;
        void fromValue;
      `
    });
    expect(hasFinding(findings, 'LocalShape')).toBe(true);
    expect(hasFinding(findings, 'LocalAlias')).toBe(true);
    expect(hasFinding(findings, 'LocalEnum')).toBe(true);
    expect(hasFinding(findings, 'localValue')).toBe(true);
  });

  it('should flag each name in a multi-declarator export but skip destructured bindings', () => {
    const findings = analyze({
      '/proj/src/a.ts': `
        export const usedHere = 1, alsoUsed = 2;
        const source = { picked: 3 };
        export const { picked } = source;
        const sum = usedHere + alsoUsed + picked;
        void sum;
      `
    });
    expect(hasFinding(findings, 'usedHere')).toBe(true);
    expect(hasFinding(findings, 'alsoUsed')).toBe(true);
    expect(hasFinding(findings, 'picked')).toBe(false);
  });

  it('should ignore exported declarations without an analyzable name (namespace)', () => {
    const findings = analyze({
      '/proj/src/a.ts': `
        export namespace Helpers {
          export const inner = 1;
        }
        const used = Helpers.inner;
        void used;
      `
    });
    expect(findings.every((finding) => finding.name !== 'Helpers')).toBe(true);
  });

  it('should ignore a default export class without a name', () => {
    const findings = analyze({
      '/proj/src/a.ts': `
        export default class {
          public solo(): number {
            return 1;
          }
        }
      `
    });
    expect(findings.every((finding) => finding.currentExposure === 'export')).toBe(false);
  });

  it('should not flag an export used in another source file', () => {
    const findings = analyze({
      '/proj/src/a.ts': `
        export function shared(): number {
          return 1;
        }
      `,
      '/proj/src/b.ts': `
        import { shared } from './a.ts';
        export const value = shared();
      `
    });
    expect(hasFinding(findings, 'shared')).toBe(false);
  });
});

describe('formatOverExposureFindings', () => {
  it('should report when there are no findings', () => {
    expect(formatOverExposureFindings([])).toBe('No over-exposed declarations found.\n');
  });

  it('should group findings by file, sort by line, and describe each reason', () => {
    const report = formatOverExposureFindings([
      buildFinding({ filePath: '/proj/src/b.ts', line: 9, name: 'late', suggestedExposure: 'private' }),
      buildFinding({ currentExposure: 'export', filePath: '/proj/src/a.ts', isMember: false, line: 5, name: 'exp', suggestedExposure: 'file-local' }),
      buildFinding({ filePath: '/proj/src/b.ts', line: 2, name: 'early', suggestedExposure: 'protected' }),
      buildFinding({ filePath: '/proj/src/a.ts', isForcedByTestOnly: true, line: 8, name: 'tested', suggestedExposure: 'private' }),
      buildFinding({ filePath: '/proj/src/a.ts', hasNoReferences: true, line: 12, name: 'dead', suggestedExposure: 'private' })
    ]);

    expect(report).toContain('within its own file');
    expect(report).toContain('inside its own class');
    expect(report).toContain('inside its class + subclasses');
    expect(report).toContain('(exposed only for tests)');
    expect(report).toContain('(no references at all)');
    expect(report).toContain('5 finding(s).');
    expect(report.indexOf('early')).toBeLessThan(report.indexOf('late'));
  });

  it('should render each file as a path header followed by indented clickable line:column rows, then a blank line', () => {
    const report = formatOverExposureFindings([
      buildFinding({ column: 8, filePath: '/proj/src/a.ts', line: 22, name: 'helper', suggestedExposure: 'private' })
    ]);

    expect(report).toBe(`${dedent`
      /proj/src/a.ts
        22:8  public helper -> private -- referenced only inside its own class

      1 finding(s).
    `}\n`);
  });

  it('should align the line:column column within a file group', () => {
    const report = formatOverExposureFindings([
      buildFinding({ column: 8, filePath: '/proj/src/a.ts', line: 2, name: 'early', suggestedExposure: 'private' }),
      buildFinding({ column: 8, filePath: '/proj/src/a.ts', line: 120, name: 'late', suggestedExposure: 'private' })
    ]);

    expect(report).toBe(`${dedent`
      /proj/src/a.ts
        2:8    public early -> private -- referenced only inside its own class
        120:8  public late -> private -- referenced only inside its own class

      2 finding(s).
    `}\n`);
  });

  it('should render paths relative to baseFolder when provided', () => {
    const report = formatOverExposureFindings([
      buildFinding({ column: 8, filePath: '/proj/src/a.ts', line: 22, name: 'helper', suggestedExposure: 'private' })
    ], { baseFolder: '/proj' });

    expect(report).toContain('src/a.ts\n');
    expect(report).toContain('22:8');
    expect(report).not.toContain('/proj/src/a.ts');
  });

  it('should keep paths outside baseFolder absolute', () => {
    const report = formatOverExposureFindings([
      buildFinding({ column: 8, filePath: '/other/b.ts', line: 3, name: 'helper', suggestedExposure: 'private' })
    ], { baseFolder: '/proj' });

    expect(report).toContain('/other/b.ts\n');
    expect(report).toContain('3:8');
  });

  it('should canonicalize a backslash baseFolder (Windows process.cwd()) before matching posix finding paths', () => {
    const report = formatOverExposureFindings([
      buildFinding({ column: 8, filePath: '/proj/sub/a.ts', line: 22, name: 'helper', suggestedExposure: 'private' })
    ], { baseFolder: '\\proj\\sub' });

    expect(report).toContain('a.ts\n');
    expect(report).toContain('22:8');
    expect(report).not.toContain('/proj/sub/a.ts');
  });
});

describe('createLanguageServiceHost', () => {
  it('should delegate file-system operations and serve script snapshots', () => {
    const fileSystem = createSpyFileSystem({ '/proj/src/a.ts': 'export const a = 1;' });
    const host = createLanguageServiceHost({ compilerOptions: COMPILER_OPTIONS, fileNames: ['/proj/src/a.ts'], fileSystem });

    expect(host.getScriptFileNames()).toEqual(['/proj/src/a.ts']);
    expect(host.getScriptVersion('/proj/src/a.ts')).toBe('0');
    expect(host.getCompilationSettings()).toBe(COMPILER_OPTIONS);
    expect(host.getCurrentDirectory()).toBe('/proj');
    expect(host.fileExists('/proj/src/a.ts')).toBe(true);
    expect(host.readFile('/proj/src/a.ts')).toBe('export const a = 1;');
    expect(host.directoryExists?.('/proj/src')).toBe(true);
    expect(host.getDirectories?.('/proj/src')).toEqual([]);
    expect(host.readDirectory?.('/proj/src')).toEqual(['/proj/src/a.ts']);
    expect(host.getDefaultLibFileName(COMPILER_OPTIONS)).toContain('lib');
    expect(host.getScriptSnapshot('/proj/src/a.ts')?.getText(0, 19)).toBe('export const a = 1;');
    expect(host.getScriptSnapshot('/proj/src/missing.ts')).toBeUndefined();
  });
});

describe('createProjectLanguageService', () => {
  it('should build a language service from a parsed tsconfig', () => {
    mockParseTsConfig.mockReturnValue({ fileNames: [], options: COMPILER_OPTIONS });
    const languageService = createProjectLanguageService({ tsConfigPath: '/proj/tsconfig.json' });
    expect(mockParseTsConfig).toHaveBeenCalledWith('/proj/tsconfig.json');
    expect(languageService.getProgram()).toBeDefined();
  });
});

describe('findOverExposure', () => {
  it('should parse the project tsconfig and analyze it', () => {
    mockParseTsConfig.mockReturnValue({ fileNames: [], options: COMPILER_OPTIONS });
    const findings = findOverExposure({ projectFolder: '/proj' });
    expect(mockParseTsConfig).toHaveBeenCalledWith('/proj/tsconfig.json');
    expect(findings).toEqual([]);
  });

  it('should forward the onProgress callback to the analyzer', () => {
    mockParseTsConfig.mockReturnValue({ fileNames: [], options: COMPILER_OPTIONS });
    const onProgress = vi.fn<(progress: OverExposureProgress) => void>();
    const findings = findOverExposure({ onProgress, projectFolder: '/proj' });
    expect(findings).toEqual([]);
    expect(onProgress).not.toHaveBeenCalled();
  });
});

describe('analyzeOverExposure with shouldFix', () => {
  it('should return no findings when the language service has no program', () => {
    const languageService = strictProxy<LanguageService>({
      getProgram: () => undefined
    });
    const writes = new Map<string, string>();
    const findings = analyzeOverExposure({
      languageService,
      shouldFix: true,
      srcFolder: SRC_FOLDER,
      writeFile: (path, content) => {
        writes.set(path, content);
      }
    });
    expect(findings).toEqual([]);
    expect(writes.size).toBe(0);
  });

  it('should replace an explicit public member modifier with private', () => {
    const { findings, writes } = applyFixes({
      '/proj/src/a.ts': `
        export class A {
          public helper(): number {
            return this.run();
          }
          public run(): number {
            return 1;
          }
        }
      `,
      '/proj/src/b.ts': `
        import { A } from './a.ts';
        const value = new A().helper();
        void value;
      `
    });
    expect(fixedNames(findings)).toContain('run');
    const fixed = writes.get('/proj/src/a.ts') ?? '';
    expect(fixed).toContain('private run(): number');
    expect(fixed).not.toContain('public run(): number');
    expect(fixed).toContain('public helper(): number');
  });

  it('should apply multiple edits to a single file from last to first', () => {
    const { findings, writes } = applyFixes({
      '/proj/src/a.ts': `
        export class A {
          public first(): number {
            return this.entry();
          }
          public second(): number {
            return this.first();
          }
          public entry(): number {
            return this.second();
          }
        }
      `,
      '/proj/src/b.ts': `
        import { A } from './a.ts';
        const value = new A().entry();
        void value;
      `
    });
    expect(fixedNames(findings).sort()).toEqual(['first', 'second']);
    const fixed = writes.get('/proj/src/a.ts') ?? '';
    expect(fixed).toContain('private first(): number');
    expect(fixed).toContain('private second(): number');
    expect(fixed).toContain('public entry(): number');
  });

  it('should insert a private modifier on an implicitly public member', () => {
    const { writes } = applyFixes({
      '/proj/src/a.ts': `
        export class A {
          helper(): number {
            return this.run();
          }
          run(): number {
            return 1;
          }
        }
      `,
      '/proj/src/b.ts': `
        import { A } from './a.ts';
        const value = new A().helper();
        void value;
      `
    });
    const fixed = writes.get('/proj/src/a.ts') ?? '';
    expect(fixed).toContain('private run(): number');
    expect(fixed).toContain('helper(): number');
    expect(fixed).not.toContain('private helper');
  });

  it('should insert a private modifier before a non-visibility modifier', () => {
    const { writes } = applyFixes({
      '/proj/src/a.ts': `
        export class A {
          async run(): Promise<number> {
            return this.helper();
          }
          async helper(): Promise<number> {
            return 1;
          }
        }
      `,
      '/proj/src/b.ts': `
        import { A } from './a.ts';
        const value = new A().run();
        void value;
      `
    });
    expect(writes.get('/proj/src/a.ts') ?? '').toContain('private async helper(): Promise<number>');
  });

  it('should insert a private modifier before the get keyword of an accessor', () => {
    const { writes } = applyFixes({
      '/proj/src/a.ts': `
        export class A {
          get secret(): number {
            return 1;
          }
          run(): number {
            return this.secret;
          }
        }
      `,
      '/proj/src/b.ts': `
        import { A } from './a.ts';
        const value = new A().run();
        void value;
      `
    });
    expect(writes.get('/proj/src/a.ts') ?? '').toContain('private get secret(): number');
  });

  it('should tighten a public member used only in a subclass to protected', () => {
    const { writes } = applyFixes({
      '/proj/src/a.ts': `
        export class Base {
          shared(): number {
            return 1;
          }
        }
        export class Derived extends Base {
          use(): number {
            return this.shared();
          }
        }
      `,
      '/proj/src/b.ts': `
        import { Base, Derived } from './a.ts';
        const instance: Base = new Derived();
        void instance;
        const value = new Derived().use();
        void value;
      `
    });
    expect(writes.get('/proj/src/a.ts') ?? '').toContain('protected shared(): number');
  });

  it('should replace a protected member modifier with private', () => {
    const { writes } = applyFixes({
      '/proj/src/a.ts': `
        export class A {
          protected helper(): number {
            return 1;
          }
          run(): number {
            return this.helper();
          }
        }
      `,
      '/proj/src/b.ts': `
        import { A } from './a.ts';
        const value = new A().run();
        void value;
      `
    });
    const fixed = writes.get('/proj/src/a.ts') ?? '';
    expect(fixed).toContain('private helper(): number');
    expect(fixed).not.toContain('protected helper');
  });

  it('should drop the export keyword from a file-local export', () => {
    const { writes } = applyFixes({
      '/proj/src/a.ts': `
        export function helper(): number {
          return 1;
        }
        export function main(): number {
          return helper();
        }
      `,
      '/proj/src/b.ts': `
        import { main } from './a.ts';
        const value = main();
        void value;
      `
    });
    const fixed = writes.get('/proj/src/a.ts') ?? '';
    expect(fixed).toContain('function helper(): number');
    expect(fixed).not.toContain('export function helper');
    expect(fixed).toContain('export function main(): number');
  });

  it('should drop a shared export keyword once when every declarator is file-local', () => {
    const { findings, writes } = applyFixes({
      '/proj/src/a.ts': `
        export const first = 1, second = 2;
        const sum = first + second;
        void sum;
      `
    });
    expect(fixedNames(findings)).toEqual(['first', 'second']);
    const fixed = writes.get('/proj/src/a.ts') ?? '';
    expect(fixed).toContain('const first = 1, second = 2;');
    expect(fixed).not.toContain('export const');
  });

  it('should skip dropping an export shared with a still-exported sibling', () => {
    const { findings, writes } = applyFixes({
      '/proj/src/a.ts': `
        export const local = 1, shared = 2;
        const sum = local;
        void sum;
      `,
      '/proj/src/b.ts': `
        import { shared } from './a.ts';
        const value = shared;
        void value;
      `
    });
    expect(fixedNames(findings)).toHaveLength(0);
    expect(skipReasonFor(findings, 'local')).toBe('shared-export');
    expect(writes.has('/proj/src/a.ts')).toBe(false);
  });

  it('should skip a member exposed only for tests', () => {
    const { findings, writes } = applyFixes({
      '/proj/src/a.test.ts': `
        import { A } from './a.ts';
        const value = new A().probe();
        void value;
      `,
      '/proj/src/a.ts': `
        export class A {
          probe(): number {
            return 1;
          }
        }
      `
    });
    expect(fixedNames(findings)).toHaveLength(0);
    expect(skipReasonFor(findings, 'probe')).toBe('test-only');
    expect(writes.has('/proj/src/a.ts')).toBe(false);
  });

  it('should skip a decorated member', () => {
    const { findings, writes } = applyFixes({
      '/proj/src/a.ts': `
        function deco(_target: unknown, _context: unknown): void {
          void 0;
        }
        export class A {
          @deco
          helper(): number {
            return 1;
          }
          run(): number {
            return this.helper();
          }
        }
      `,
      '/proj/src/b.ts': `
        import { A } from './a.ts';
        const value = new A().run();
        void value;
      `
    });
    expect(skipReasonFor(findings, 'helper')).toBe('decorated');
    expect(writes.has('/proj/src/a.ts')).toBe(false);
  });

  it('should forward the onProgress callback to the analyzer', () => {
    const files = {
      '/proj/src/a.ts': `
        export function helper(): number {
          return 1;
        }
      `
    };
    const fileSystem = createSpyFileSystem(files);
    const host = createLanguageServiceHost({ compilerOptions: COMPILER_OPTIONS, fileNames: Object.keys(files), fileSystem });
    const languageService = createLanguageService(host, createDocumentRegistry());
    const onProgress = vi.fn<(progress: OverExposureProgress) => void>();
    analyzeOverExposure({
      languageService,
      onProgress,
      shouldFix: true,
      srcFolder: SRC_FOLDER,
      writeFile: () => {
        // No-op.
      }
    });
    expect(onProgress).toHaveBeenCalledTimes(1);
  });
});

describe('analyzeOverExposure with shouldForce', () => {
  it('should tighten a member exposed only for tests instead of skipping it', () => {
    const { findings, writes } = applyFixes({
      '/proj/src/a.test.ts': `
        import { A } from './a.ts';
        const value = new A().probe();
        void value;
      `,
      '/proj/src/a.ts': `
        export class A {
          probe(): number {
            return 1;
          }
        }
      `
    }, { shouldForce: true });
    expect(fixedNames(findings)).toContain('probe');
    expect(skipReasonFor(findings, 'probe')).toBeNull();
    const fixed = writes.get('/proj/src/a.ts') ?? '';
    expect(fixed).toContain('private probe(): number');
  });

  it('should drop the export keyword from a declaration used only from tests', () => {
    const { findings, writes } = applyFixes({
      '/proj/src/a.test.ts': `
        import { probe } from './a.ts';
        export const value = probe();
      `,
      '/proj/src/a.ts': `
        export function probe(): number {
          return 1;
        }
      `
    }, { shouldForce: true });
    expect(fixedNames(findings)).toContain('probe');
    const fixed = writes.get('/proj/src/a.ts') ?? '';
    expect(fixed).toContain('function probe(): number');
    expect(fixed).not.toContain('export function probe');
  });

  it('should still skip a decorated member', () => {
    const { findings, writes } = applyFixes({
      '/proj/src/a.test.ts': `
        import { A } from './a.ts';
        const value = new A().helper();
        void value;
      `,
      '/proj/src/a.ts': `
        function deco(_target: unknown, _context: unknown): void {
          void 0;
        }
        export class A {
          @deco
          helper(): number {
            return 1;
          }
        }
      `,
      '/proj/src/b.ts': `
        import { A } from './a.ts';
        const instance = new A();
        void instance;
      `
    }, { shouldForce: true });
    expect(skipReasonFor(findings, 'helper')).toBe('decorated');
    expect(writes.has('/proj/src/a.ts')).toBe(false);
  });

  it('should still skip an export shared with a still-exported sibling', () => {
    const { findings, writes } = applyFixes({
      '/proj/src/a.test.ts': `
        import { local } from './a.ts';
        export const value = local;
      `,
      '/proj/src/a.ts': `
        export const local = 1, shared = 2;
        const sum = local;
        void sum;
      `,
      '/proj/src/b.ts': `
        import { shared } from './a.ts';
        const value = shared;
        void value;
      `
    }, { shouldForce: true });
    expect(skipReasonFor(findings, 'local')).toBe('shared-export');
    expect(writes.has('/proj/src/a.ts')).toBe(false);
  });
});

describe('findOverExposure with shouldFix', () => {
  it('should parse the project tsconfig and rewrite files on disk via ts.sys', () => {
    const files: Record<string, string> = {
      '/proj/src/a.ts': 'export function helper(): number {\n  return 1;\n}\nexport function main(): number {\n  return helper();\n}\n',
      '/proj/src/b.ts': 'import { main } from \'./a.ts\';\nconst value = main();\nvoid value;\n'
    };
    mockParseTsConfig.mockReturnValue({ fileNames: Object.keys(files), options: COMPILER_OPTIONS });
    const fileMap = new Map<string, string>(Object.entries(files));
    const writes = new Map<string, string>();
    vi.spyOn(sys, 'readFile').mockImplementation((path: string) => fileMap.get(path));
    vi.spyOn(sys, 'fileExists').mockImplementation((path: string) => fileMap.has(path));
    vi.spyOn(sys, 'directoryExists').mockImplementation((path: string) => path === '/proj' || [...fileMap.keys()].some((fileName) => fileName.startsWith(`${path}/`)));
    vi.spyOn(sys, 'getDirectories').mockReturnValue([]);
    vi.spyOn(sys, 'readDirectory').mockReturnValue([...fileMap.keys()]);
    vi.spyOn(sys, 'getCurrentDirectory').mockReturnValue('/proj');
    vi.spyOn(sys, 'writeFile').mockImplementation((path: string, data: string) => {
      writes.set(path, data);
    });

    const findings = findOverExposure({ projectFolder: '/proj', shouldFix: true });
    expect(mockParseTsConfig).toHaveBeenCalledWith('/proj/tsconfig.json');
    expect(fixedNames(findings)).toContain('helper');
    const fixed = writes.get('/proj/src/a.ts') ?? '';
    expect(fixed).toContain('function helper(): number');
    expect(fixed).not.toContain('export function helper');
  });
});

describe('formatOverExposureFindings in fix mode', () => {
  it('should suffix a fixed finding with [fixed] and append the fix counts', () => {
    const report = formatOverExposureFindings([
      buildFinding({ filePath: '/proj/src/a.ts', line: 2, name: 'helper', suggestedExposure: 'private', wasFixed: true })
    ]);
    expect(report).toContain('public helper -> private -- referenced only inside its own class [fixed]');
    expect(report).toContain('1 finding(s). 1 fixed, 0 skipped.');
  });

  it('should suffix skipped findings with their reason and append the skip count', () => {
    const report = formatOverExposureFindings([
      buildFinding({ filePath: '/proj/src/a.ts', line: 2, name: 'tested', skipReason: 'test-only', suggestedExposure: 'private' }),
      buildFinding({ filePath: '/proj/src/a.ts', line: 3, name: 'decorated', skipReason: 'decorated', suggestedExposure: 'private' }),
      buildFinding({ currentExposure: 'export', filePath: '/proj/src/a.ts', isMember: false, line: 4, name: 'shared', skipReason: 'shared-export', suggestedExposure: 'file-local' })
    ]);
    expect(report).toContain('[skipped: exposed only for tests]');
    expect(report).toContain('[skipped: decorated member]');
    expect(report).toContain('[skipped: export shared with a still-exported sibling]');
    expect(report).toContain('3 finding(s). 0 fixed, 3 skipped.');
  });
});

describe('LIFECYCLE_ALLOWLIST', () => {
  it('should contain the Obsidian lifecycle hooks', () => {
    expect(LIFECYCLE_ALLOWLIST.has('onload')).toBe(true);
    expect(LIFECYCLE_ALLOWLIST.has('onLayoutReady')).toBe(true);
  });
});

function analyze(files: Record<string, string>): OverExposureFinding[] {
  const fileSystem = createSpyFileSystem(files);
  const host = createLanguageServiceHost({ compilerOptions: COMPILER_OPTIONS, fileNames: Object.keys(files), fileSystem });
  const languageService = createLanguageService(host, createDocumentRegistry());
  return analyzeOverExposure({ languageService, srcFolder: SRC_FOLDER });
}

function applyFixes(files: Record<string, string>, options?: ApplyFixesOptions): ApplyFixesOutcome {
  const fileSystem = createSpyFileSystem(files);
  const host = createLanguageServiceHost({ compilerOptions: COMPILER_OPTIONS, fileNames: Object.keys(files), fileSystem });
  const languageService = createLanguageService(host, createDocumentRegistry());
  const writes = new Map<string, string>();
  const findings = analyzeOverExposure({
    languageService,
    shouldFix: true,
    shouldForce: options?.shouldForce ?? false,
    srcFolder: SRC_FOLDER,
    writeFile: (path, content) => {
      writes.set(path, content);
    }
  });
  return { findings, writes };
}

function buildFinding(overrides: Partial<OverExposureFinding>): OverExposureFinding {
  return {
    column: 1,
    currentExposure: 'public',
    filePath: '/proj/src/a.ts',
    hasNoReferences: false,
    isForcedByTestOnly: false,
    isMember: true,
    line: 1,
    name: 'member',
    skipReason: null,
    suggestedExposure: 'private',
    wasFixed: false,
    ...overrides
  };
}

function createSpyFileSystem(files: Record<string, string>): OverExposureFileSystem {
  const fileMap = new Map(Object.entries(files));
  return {
    directoryExists: (path) => path === '/proj' || [...fileMap.keys()].some((fileName) => fileName.startsWith(`${path}/`)),
    fileExists: (path) => fileMap.has(path),
    getCurrentDirectory: () => '/proj',
    getDirectories: () => [],
    readDirectory: () => [...fileMap.keys()],
    readFile: (path) => fileMap.get(path)
  };
}

function findFinding(findings: readonly OverExposureFinding[], name: string): OverExposureFinding {
  const finding = findings.find((candidate) => candidate.name === name);
  if (!finding) {
    throw new Error(`No finding for ${name}. Found: ${findings.map((candidate) => candidate.name).join(', ')}`);
  }
  return finding;
}

function fixedNames(findings: readonly OverExposureFinding[]): string[] {
  return findings.filter((finding) => finding.wasFixed).map((finding) => finding.name);
}

function hasFinding(findings: readonly OverExposureFinding[], name: string): boolean {
  return findings.some((finding) => finding.name === name);
}

function skipReasonFor(findings: readonly OverExposureFinding[], name: string): OverExposureFinding['skipReason'] {
  const finding = findings.find((candidate) => candidate.name === name);
  if (!finding) {
    throw new Error(`No finding for ${name}.`);
  }
  return finding.skipReason;
}
