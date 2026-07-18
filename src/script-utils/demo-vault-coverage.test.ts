import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it
} from 'vitest';

import {
  dirname,
  join,
  toPosixPath
} from '../path.ts';
import {
  DemoVaultCoverageChecker,
  registerDemoVaultCoverageSuite
} from './demo-vault-coverage.ts';

const CONTEXT_SOURCE = `export interface DemoContext {
  doThing(): void;
  doOther<T>(value: T): T;
  readonlyProp: string;
}
`;

const CONFIG_SOURCE = `export interface DemoConfig {
  optionA?: string;
  optionB?: number;
}
`;

const PROPS_SOURCE = `export interface DemoProps {
  alpha: string;
  beta: string;
}
`;

const START_NOTE = `# Start

Call demoContext.doThing() and demoContext.doOther() here.
Use demoProps.alpha and demoProps.beta.
Enable optionA and set optionB.

See [feature one](docs/feature-one.md) and [feature two](docs/feature-two.md).
`;

function createFixtureRoot(prefix: string): string {
  const root = toPosixPath(mkdtempSync(join(toPosixPath(tmpdir()), prefix)));
  populateFixture(root);
  return root;
}

function populateFixture(root: string): void {
  writeFixtureFile(root, 'src/context.ts', CONTEXT_SOURCE);
  writeFixtureFile(root, 'src/config.ts', CONFIG_SOURCE);
  writeFixtureFile(root, 'src/props.ts', PROPS_SOURCE);
  writeFixtureFile(root, 'docs/feature-one.md', '# Feature one\n');
  writeFixtureFile(root, 'docs/feature-two.md', '# Feature two\n');
  writeFixtureFile(root, 'docs/usage.md', '# Usage\n');
  writeFixtureFile(root, 'demo-vault/Start.md', START_NOTE);
  writeFixtureFile(root, 'demo-vault/nested/More.md', 'More demo content.\n');
  writeFixtureFile(root, 'demo-vault/notes.txt', 'Not a markdown file.\n');
  // A stale reference buried in node_modules must be skipped by the corpus scan.
  writeFixtureFile(root, 'demo-vault/node_modules/uuid/README.md', 'demoContext.removedMethod() should be skipped.\n');
}

function writeFixtureFile(root: string, relativePath: string, content: string): void {
  const absolutePath = join(root, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content);
}

// The suite wrapper registers tests at collection time, so its fixture must exist before collection.
const suiteRoot = createFixtureRoot('odu-dvc-suite-');

registerDemoVaultCoverageSuite({
  configInterfaces: [{ interfaceName: 'DemoConfig', sourcePath: 'src/config.ts' }],
  docs: { folder: 'docs', nonFeatureDocs: ['usage'] },
  interfaces: [{ interfaceName: 'DemoContext', kind: 'methods', receiver: 'demoContext', sourcePath: 'src/context.ts' }],
  nonTrivialGuard: {
    expectDemoNote: 'Start.md',
    expectMember: 'doThing',
    interfaceName: 'DemoContext',
    sourcePath: 'src/context.ts'
  },
  rootFolder: suiteRoot
});

// A second registration with a properties-kind interface and no docs exercises the remaining suite branches.
registerDemoVaultCoverageSuite({
  configInterfaces: [],
  interfaces: [{ interfaceName: 'DemoProps', kind: 'properties', receiver: 'demoProps', sourcePath: 'src/props.ts' }],
  nonTrivialGuard: {
    expectDemoNote: 'Start.md',
    expectMember: 'alpha',
    interfaceName: 'DemoProps',
    sourcePath: 'src/props.ts'
  },
  rootFolder: suiteRoot
});

afterAll(() => {
  rmSync(suiteRoot, { force: true, recursive: true });
});

describe('DemoVaultCoverageChecker', () => {
  let root: string;

  beforeEach(() => {
    root = createFixtureRoot('odu-dvc-');
  });

  afterEach(() => {
    rmSync(root, { force: true, recursive: true });
  });

  it('parses interface methods and properties', () => {
    const checker = new DemoVaultCoverageChecker({ rootFolder: root });
    const members = checker.getInterfaceMembers({ interfaceName: 'DemoContext', sourcePath: 'src/context.ts' });
    expect(members.methods).toEqual(['doThing', 'doOther']);
    expect(members.properties).toEqual(['readonlyProp']);
    expect(members.all).toEqual(['doThing', 'doOther', 'readonlyProp']);
  });

  it('throws when the interface cannot be found', () => {
    const checker = new DemoVaultCoverageChecker({ rootFolder: root });
    expect(() => checker.getInterfaceMembers({ interfaceName: 'Missing', sourcePath: 'src/context.ts' }))
      .toThrow('Could not find interface Missing');
  });

  it('reads and caches the demo corpus, skipping node_modules', () => {
    const checker = new DemoVaultCoverageChecker({ rootFolder: root });
    const corpus = checker.readCorpus();
    expect(corpus).toContain('demoContext.doThing');
    expect(corpus).toContain('More demo content.');
    expect(corpus).not.toContain('removedMethod');
    // The corpus is cached, so a second read returns the same reference.
    expect(checker.readCorpus()).toBe(corpus);
  });

  it('collects demo note relative paths, excluding node_modules and non-markdown files', () => {
    const checker = new DemoVaultCoverageChecker({ rootFolder: root });
    const notes = checker.collectDemoNoteRelativePaths();
    expect(notes).toContain('Start.md');
    expect(notes).toContain('nested/More.md');
    expect(notes).not.toContain('notes.txt');
    expect(notes.some((note) => note.includes('node_modules'))).toBe(false);
  });

  it('finds undemonstrated members addressed on a receiver', () => {
    const checker = new DemoVaultCoverageChecker({ rootFolder: root });
    expect(checker.findUndemonstratedMembers({ members: ['doThing', 'missingMethod'], receiver: 'demoContext' }))
      .toEqual(['missingMethod']);
  });

  it('finds undemonstrated config options addressed by bare name', () => {
    const checker = new DemoVaultCoverageChecker({ rootFolder: root });
    expect(checker.findUndemonstratedMembers({ members: ['optionA', 'optionMissing'] }))
      .toEqual(['optionMissing']);
  });

  it('reports no undemonstrated members when all are present', () => {
    const checker = new DemoVaultCoverageChecker({ rootFolder: root });
    expect(checker.findUndemonstratedMembers({ members: ['doThing', 'doOther'], receiver: 'demoContext' }))
      .toEqual([]);
  });

  it('catches stale receiver references and de-duplicates them', () => {
    writeFixtureFile(
      root,
      'demo-vault/Start.md',
      'demoContext.doThing() then demoContext.replaceCodeBlock() and demoContext.replaceCodeBlock() again.'
    );
    const checker = new DemoVaultCoverageChecker({ rootFolder: root });
    const members = checker.getInterfaceMembers({ interfaceName: 'DemoContext', sourcePath: 'src/context.ts' });
    expect(checker.findStaleReferences({ receiver: 'demoContext', validMembers: members.all }))
      .toEqual(['replaceCodeBlock']);
  });

  it('reports no stale references when every referenced member exists', () => {
    const checker = new DemoVaultCoverageChecker({ rootFolder: root });
    const members = checker.getInterfaceMembers({ interfaceName: 'DemoContext', sourcePath: 'src/context.ts' });
    expect(checker.findStaleReferences({ receiver: 'demoContext', validMembers: members.all })).toEqual([]);
  });

  it('finds feature docs not linked from any demo note, honoring the allowlist', () => {
    writeFixtureFile(root, 'docs/feature-three.md', '# Feature three\n');
    const checker = new DemoVaultCoverageChecker({ rootFolder: root });
    expect(checker.findUnlinkedFeatureDocs({ docsFolder: 'docs', nonFeatureDocs: ['usage'] }))
      .toEqual(['feature-three']);
  });

  it('reports no unlinked feature docs when all are linked', () => {
    const checker = new DemoVaultCoverageChecker({ rootFolder: root });
    expect(checker.findUnlinkedFeatureDocs({ docsFolder: 'docs', nonFeatureDocs: ['usage'] })).toEqual([]);
  });
});
