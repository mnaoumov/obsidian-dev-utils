import type {
  CompilerOptions,
  LanguageService
} from 'typescript';

import {
  createDocumentRegistry,
  createLanguageService,
  ModuleKind,
  ModuleResolutionKind,
  ScriptTarget
} from 'typescript';
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
    expect(report.indexOf('/proj/src/b.ts:2:')).toBeLessThan(report.indexOf('/proj/src/b.ts:9:'));
  });

  it('should prefix each finding with a clickable path:line:column location', () => {
    const report = formatOverExposureFindings([
      buildFinding({ column: 8, filePath: '/proj/src/a.ts', line: 22, name: 'helper', suggestedExposure: 'private' })
    ]);

    expect(report).toContain('/proj/src/a.ts:22:8 public helper -> private');
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
    suggestedExposure: 'private',
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

function hasFinding(findings: readonly OverExposureFinding[], name: string): boolean {
  return findings.some((finding) => finding.name === name);
}
