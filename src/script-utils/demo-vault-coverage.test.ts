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

import { ObsidianPluginRepoPaths } from '../obsidian/plugin/obsidian-plugin-repo-paths.ts';
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

const CLASS_SOURCE = `export class DemoSettings extends BaseSettings implements ISettings {
  public isFullKeyDisplayEnabled = false;
  public label: string;
  public static readonly VERSION = 1;
  private secret = 0;
  public doAction(): void {}
  protected helper(): void {}
}
`;

const ENUM_SOURCE = `export enum DemoMode {
  Fast,
  Slow = 'slow',
  Careful
}
`;

const FUNCTIONS_SOURCE = `export function doFoo(): void {}
export async function doBar(): Promise<void> {}
export function* gen(): Generator<number> {
  yield 1;
}
`;

const START_NOTE_PATH = '00 Start.md';

const APP_JSON_RELATIVE_PATH = join(
  ObsidianPluginRepoPaths.DemoVault,
  ObsidianPluginRepoPaths.DotObsidian,
  ObsidianPluginRepoPaths.AppJson
);

const START_NOTE = `# Start

Try the buttons below to see what the plugin does before you install it anywhere.

Call demoContext.doThing() and demoContext.doOther() here.
Use demoProps.alpha and demoProps.beta.
Enable optionA and set optionB.

- [Surface](<./Surface.md>)
- [More](<./nested/More.md>)

See [feature one](docs/feature-one.md) and [feature two](docs/feature-two.md).
`;

const SURFACE_NOTE = `# Surface

Lists every setting the plugin exposes, so you can see what each one changes before touching it.

The DemoSettings class exposes isFullKeyDisplayEnabled, label, and VERSION.
Call demoSettings.doAction() to run it.
Modes: DemoMode.Fast, DemoMode.Slow, DemoMode.Careful.
Helpers: doFoo(), doBar(), and gen().
`;

const MORE_NOTE = `# More

More demo content.
`;

// The vault's own readme addresses someone browsing the repo, not a reader working through the vault, so
// It is excluded from the authoring checks by default. It is written deliberately off-convention here, so
// A regression in that exclusion fails loudly.
const VAULT_README_NOTE = `[Docs](https://example.com/docs)

See [[Start]] for the tour.
`;

function createFixtureRoot(prefix: string): string {
  const temporaryDirectory = toPosixPath(tmpdir());
  const root = toPosixPath(mkdtempSync(join(temporaryDirectory, prefix)));
  populateFixture(root);
  return root;
}

function populateFixture(root: string): void {
  writeFixtureFile(root, 'src/context.ts', CONTEXT_SOURCE);
  writeFixtureFile(root, 'src/config.ts', CONFIG_SOURCE);
  writeFixtureFile(root, 'src/props.ts', PROPS_SOURCE);
  writeFixtureFile(root, 'src/settings.ts', CLASS_SOURCE);
  writeFixtureFile(root, 'src/mode.ts', ENUM_SOURCE);
  writeFixtureFile(root, 'src/functions.ts', FUNCTIONS_SOURCE);
  writeFixtureFile(root, 'docs/feature-one.md', '# Feature one\n');
  writeFixtureFile(root, 'docs/feature-two.md', '# Feature two\n');
  writeFixtureFile(root, 'docs/usage.md', '# Usage\n');
  // A demo vault may configure itself; what it may not do is commit the settings this package injects.
  writeFixtureFile(root, APP_JSON_RELATIVE_PATH, '{ "attachmentFolderPath": "_assets" }\n');
  writeFixtureFile(root, `demo-vault/${START_NOTE_PATH}`, START_NOTE);
  writeFixtureFile(root, 'demo-vault/Surface.md', SURFACE_NOTE);
  writeFixtureFile(root, 'demo-vault/nested/More.md', MORE_NOTE);
  writeFixtureFile(root, 'demo-vault/README.md', VAULT_README_NOTE);
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
    expectDemoNote: START_NOTE_PATH,
    expectMember: 'doThing',
    interfaceName: 'DemoContext',
    sourcePath: 'src/context.ts'
  },
  rootFolder: suiteRoot
});

// A second registration with a properties-kind interface and no docs exercises the remaining suite branches,
// Plus the `authoring` tuning path (an explicit start note and an extra excluded note).
registerDemoVaultCoverageSuite({
  authoring: {
    excludedNotes: ['README.md', 'nested/More.md'],
    startNote: START_NOTE_PATH
  },
  configInterfaces: [],
  interfaces: [{ interfaceName: 'DemoProps', kind: 'properties', receiver: 'demoProps', sourcePath: 'src/props.ts' }],
  nonTrivialGuard: {
    expectDemoNote: START_NOTE_PATH,
    expectMember: 'alpha',
    interfaceName: 'DemoProps',
    sourcePath: 'src/props.ts'
  },
  rootFolder: suiteRoot
});

// A third registration reflects a class (config + methods), an enum, and an exported-function module end-to-end.
registerDemoVaultCoverageSuite({
  configInterfaces: [{ interfaceName: 'DemoSettings', sourcePath: 'src/settings.ts' }],
  functionModules: [{ sourcePath: 'src/functions.ts' }],
  interfaces: [
    { interfaceName: 'DemoSettings', kind: 'methods', receiver: 'demoSettings', sourcePath: 'src/settings.ts' },
    { interfaceName: 'DemoMode', kind: 'properties', receiver: 'DemoMode', sourcePath: 'src/mode.ts' }
  ],
  nonTrivialGuard: {
    expectDemoNote: 'Surface.md',
    expectMember: 'isFullKeyDisplayEnabled',
    interfaceName: 'DemoSettings',
    sourcePath: 'src/settings.ts'
  },
  rootFolder: suiteRoot
});

// A fourth registration passes nothing but `rootFolder` — the settings-less shape, where there is no
// Config interface, no public API interface and nothing for the non-trivial guard to reflect. The
// Authoring checks must still run, which is why every other member is optional.
registerDemoVaultCoverageSuite({ rootFolder: suiteRoot });

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

  it('parses class members, tolerating modifiers and excluding non-public ones', () => {
    const checker = new DemoVaultCoverageChecker({ rootFolder: root });
    const members = checker.getInterfaceMembers({ interfaceName: 'DemoSettings', sourcePath: 'src/settings.ts' });
    expect(members.methods).toEqual(['doAction']);
    expect(members.properties).toEqual(['isFullKeyDisplayEnabled', 'label', 'VERSION']);
    expect(members.all).toEqual(['doAction', 'isFullKeyDisplayEnabled', 'label', 'VERSION']);
    expect(members.all).not.toContain('secret');
    expect(members.all).not.toContain('helper');
  });

  it('parses enum members as properties', () => {
    const checker = new DemoVaultCoverageChecker({ rootFolder: root });
    const members = checker.getInterfaceMembers({ interfaceName: 'DemoMode', sourcePath: 'src/mode.ts' });
    expect(members.methods).toEqual([]);
    expect(members.properties).toEqual(['Fast', 'Slow', 'Careful']);
    expect(members.all).toEqual(['Fast', 'Slow', 'Careful']);
  });

  it('parses exported function names, including async and generator declarations', () => {
    const checker = new DemoVaultCoverageChecker({ rootFolder: root });
    expect(checker.getExportedFunctionNames({ sourcePath: 'src/functions.ts' })).toEqual(['doFoo', 'doBar', 'gen']);
  });

  it('finds undemonstrated exported functions', () => {
    const checker = new DemoVaultCoverageChecker({ rootFolder: root });
    const functionNames = checker.getExportedFunctionNames({ sourcePath: 'src/functions.ts' });
    expect(checker.findUndemonstratedMembers({ members: functionNames })).toEqual([]);
    expect(checker.findUndemonstratedMembers({ members: [...functionNames, 'missingFn'] })).toEqual(['missingFn']);
  });

  it('catches a stale reference on a class receiver', () => {
    writeFixtureFile(root, 'demo-vault/Surface.md', 'Call demoSettings.doAction() then demoSettings.removedAction().');
    const checker = new DemoVaultCoverageChecker({ rootFolder: root });
    const members = checker.getInterfaceMembers({ interfaceName: 'DemoSettings', sourcePath: 'src/settings.ts' });
    expect(checker.findStaleReferences({ receiver: 'demoSettings', validMembers: members.all }))
      .toEqual(['removedAction']);
  });

  it('accepts a committed app.json that sets none of the injected settings', () => {
    const checker = new DemoVaultCoverageChecker({ rootFolder: root });
    expect(checker.findCommittedAppJsonSettings()).toEqual([]);
  });

  it('accepts a vault that commits no app.json at all', () => {
    rmSync(join(root, APP_JSON_RELATIVE_PATH));
    const checker = new DemoVaultCoverageChecker({ rootFolder: root });
    expect(checker.findCommittedAppJsonSettings()).toEqual([]);
  });

  it('reports the injected settings a committed app.json sets', () => {
    writeFixtureFile(root, APP_JSON_RELATIVE_PATH, '{ "defaultViewMode": "preview", "useMarkdownLinks": true }\n');
    const checker = new DemoVaultCoverageChecker({ rootFolder: root });
    expect(checker.findCommittedAppJsonSettings()).toEqual(['defaultViewMode', 'useMarkdownLinks']);
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
    expect(notes).toContain(START_NOTE_PATH);
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
      `demo-vault/${START_NOTE_PATH}`,
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

  it('reads and caches every note individually', () => {
    const checker = new DemoVaultCoverageChecker({ rootFolder: root });
    const notes = checker.collectNotes();
    expect(notes.map((note) => note.relativePath)).toContain('nested/More.md');
    expect(notes.find((note) => note.relativePath === START_NOTE_PATH)?.content).toContain('# Start');
    expect(checker.collectNotes()).toBe(notes);
  });
});

describe('DemoVaultCoverageChecker authoring checks', () => {
  let root: string;

  beforeEach(() => {
    root = createFixtureRoot('odu-dvc-authoring-');
  });

  afterEach(() => {
    rmSync(root, { force: true, recursive: true });
  });

  it('accepts a conventional vault', () => {
    const checker = new DemoVaultCoverageChecker({ rootFolder: root });
    expect(checker.findNotesWithoutH1()).toEqual([]);
    expect(checker.findNotesWithoutIntroProse()).toEqual([]);
    expect(checker.findNotesWithWikilinks()).toEqual([]);
    expect(checker.findNotesWithDocsLinks()).toEqual([]);
    expect(checker.findUnreachableNotes({ startNote: START_NOTE_PATH })).toEqual([]);
  });

  it('finds a note that does not open with an H1', () => {
    writeFixtureFile(root, 'demo-vault/Headless.md', 'Straight into the prose, with no title.\n');
    writeFixtureFile(root, 'demo-vault/Subheading.md', '## Subheading\n\nOpens at the wrong level.\n');
    const checker = new DemoVaultCoverageChecker({ rootFolder: root });
    expect(checker.findNotesWithoutH1()).toEqual(['Headless.md', 'Subheading.md']);
  });

  it('accepts an H1 preceded by frontmatter or blank lines', () => {
    writeFixtureFile(root, 'demo-vault/Front.md', '---\ntitle: Front\n---\n\n# Front\n\nHas frontmatter first.\n');
    const checker = new DemoVaultCoverageChecker({ rootFolder: root });
    expect(checker.findNotesWithoutH1()).toEqual([]);
  });

  it('reports an empty note as missing both its H1 and its prose', () => {
    writeFixtureFile(root, 'demo-vault/Empty.md', '\n\n');
    const checker = new DemoVaultCoverageChecker({ rootFolder: root });
    expect(checker.findNotesWithoutH1()).toEqual(['Empty.md']);
    expect(checker.findNotesWithoutIntroProse()).toEqual(['Empty.md']);
  });

  it('finds a note that goes straight from its title to a code block', () => {
    writeFixtureFile(root, 'demo-vault/Buttons.md', '# Buttons\n\n```code-button\nrun();\n```\n');
    writeFixtureFile(root, 'demo-vault/Headings.md', '# Headings\n\n## Options\n\n~~~ts\nrun();\n~~~\n');
    const checker = new DemoVaultCoverageChecker({ rootFolder: root });
    expect(checker.findNotesWithoutIntroProse()).toEqual(['Buttons.md', 'Headings.md']);
  });

  it('finds a wikilink outside a code fence, but not one shown inside a fence or in inline code', () => {
    writeFixtureFile(root, 'demo-vault/Linked.md', '# Linked\n\nSee [[Surface]] for more.\n');
    writeFixtureFile(root, 'demo-vault/Sample.md', '# Sample\n\nA link looks like `[[Note]]`, for example:\n\n```md\n[[Note]]\n```\n');
    const checker = new DemoVaultCoverageChecker({ rootFolder: root });
    expect(checker.findNotesWithWikilinks()).toEqual(['Linked.md']);
  });

  it('allows a wikilink on the line after a disable-next-line directive, and inside a disabled region', () => {
    writeFixtureFile(
      root,
      'demo-vault/Clickable.md',
      `# Clickable

Clicking a link to a note that does not exist yet is the whole feature.

<!-- obsidian-dev-utils-disable-next-line demo-vault-validation/no-wikilinks -- The reader clicks it while it resolves to nothing. -->

2. Click this link: [[Fresh idea]].
`
    );
    writeFixtureFile(
      root,
      'demo-vault/Embeds.md',
      `# Embeds

Teaches both embed spellings.

<!-- obsidian-dev-utils-disable demo-vault-validation/no-wikilinks -- The wikilink embed is the syntax this note teaches. -->

![[page.html|400]]

![[page.html]]

<!-- obsidian-dev-utils-enable demo-vault-validation/no-wikilinks -->
`
    );
    const checker = new DemoVaultCoverageChecker({ rootFolder: root });
    expect(checker.findNotesWithWikilinks()).toEqual([]);
    expect(checker.findNotesWithUnjustifiedWikilinkAllowance()).toEqual([]);
  });

  it('still reports a wikilink outside the region a directive covers', () => {
    writeFixtureFile(
      root,
      'demo-vault/Partly.md',
      `# Partly

Only the embed is deliberate.

<!-- obsidian-dev-utils-disable demo-vault-validation/no-wikilinks -- The wikilink embed is the syntax this note teaches. -->

![[page.html]]

<!-- obsidian-dev-utils-enable demo-vault-validation/no-wikilinks -->

See [[Surface]] for more.
`
    );
    const checker = new DemoVaultCoverageChecker({ rootFolder: root });
    expect(checker.findNotesWithWikilinks()).toEqual(['Partly.md']);
  });

  it('reports a directive that is misspelled, unreasoned, unclosed, or covering no wikilink', () => {
    writeFixtureFile(root, 'demo-vault/Malformed.md', '# Malformed\n\nNames no rule.\n\n<!-- obsidian-dev-utils-disable-next-line -- Why. -->\n\n[[Surface]]\n');
    writeFixtureFile(root, 'demo-vault/Silent.md', '# Silent\n\nStates no reason.\n\n<!-- obsidian-dev-utils-disable-next-line demo-vault-validation/no-wikilinks -->\n\n[[Surface]]\n');
    writeFixtureFile(root, 'demo-vault/Open.md', '# Open\n\nNever enables again.\n\n<!-- obsidian-dev-utils-disable demo-vault-validation/no-wikilinks -- Why. -->\n\n[[Surface]]\n');
    writeFixtureFile(root, 'demo-vault/Spare.md', '# Spare\n\nCovers nothing.\n\n<!-- obsidian-dev-utils-disable-next-line demo-vault-validation/no-wikilinks -- Why. -->\n\nPlain prose.\n');
    writeFixtureFile(root, 'demo-vault/Wrong.md', '# Wrong\n\nNames a rule that does not exist.\n\n<!-- obsidian-dev-utils-disable-next-line demo-vault-validation/no-wikilink -- Why. -->\n\n[[Surface]]\n');
    const checker = new DemoVaultCoverageChecker({ rootFolder: root });
    expect(checker.findNotesWithUnjustifiedWikilinkAllowance()).toEqual([
      'Malformed.md: a malformed directive on line 5',
      'Open.md: a region opened on line 5 that is never enabled again',
      'Silent.md: a directive with no reason on line 5',
      'Spare.md: a disable-next-line on line 5 covering no wikilink',
      'Wrong.md: an unknown rule "demo-vault-validation/no-wikilink" on line 5'
    ]);
    // `Open.md` is absent: its region never closes, so it does cover the wikilink — the unclosed region is
    // Reported as the mistake it is, rather than counted twice.
    expect(checker.findNotesWithWikilinks()).toEqual(['Malformed.md', 'Silent.md', 'Wrong.md']);
  });

  it('reports a nested region, a stray enable, a region covering nothing, and a trailing disable-next-line', () => {
    writeFixtureFile(
      root,
      'demo-vault/Nested.md',
      `# Nested

Opens a region twice.

<!-- obsidian-dev-utils-disable demo-vault-validation/no-wikilinks -- Why. -->

[[Surface]]

<!-- obsidian-dev-utils-disable demo-vault-validation/no-wikilinks -- Why again. -->

<!-- obsidian-dev-utils-enable demo-vault-validation/no-wikilinks -->
`
    );
    writeFixtureFile(root, 'demo-vault/Stray.md', '# Stray\n\nEnables what was never disabled.\n\n<!-- obsidian-dev-utils-enable demo-vault-validation/no-wikilinks -->\n');
    writeFixtureFile(
      root,
      'demo-vault/Pointless.md',
      '# Pointless\n\nWraps prose.\n\n<!-- obsidian-dev-utils-disable demo-vault-validation/no-wikilinks -- Why. -->\n\nPlain prose.\n\n<!-- obsidian-dev-utils-enable demo-vault-validation/no-wikilinks -->\n'
    );
    writeFixtureFile(root, 'demo-vault/Trailing.md', '# Trailing\n\nEnds on the directive.\n\n<!-- obsidian-dev-utils-disable-next-line demo-vault-validation/no-wikilinks -- Why. -->\n');
    const checker = new DemoVaultCoverageChecker({ rootFolder: root });
    expect(checker.findNotesWithUnjustifiedWikilinkAllowance()).toEqual([
      'Nested.md: a disable on line 9 inside the region opened on line 5',
      'Pointless.md: a region opened on line 5 covering no wikilink',
      'Stray.md: an enable on line 5 with no region open',
      'Trailing.md: a disable-next-line on line 5 covering no wikilink'
    ]);
  });

  it('allows a wikilink in a note whose frontmatter says why it needs one', () => {
    writeFixtureFile(
      root,
      'demo-vault/Embeds.md',
      `---
obsidian-dev-utils:
  demo-vault-validation:
    allow-wikilinks: The size in an embed has no Markdown equivalent.
---
# Embeds

Embeds a page at a fixed size.

![[page.html|400]]
`
    );
    const checker = new DemoVaultCoverageChecker({ rootFolder: root });
    expect(checker.findNotesWithWikilinks()).toEqual([]);
    expect(checker.findNotesWithUnjustifiedWikilinkAllowance()).toEqual([]);
  });

  it('reports inline directives a note-level allowance already covers', () => {
    writeFixtureFile(
      root,
      'demo-vault/Both.md',
      `---
obsidian-dev-utils:
  demo-vault-validation:
    allow-wikilinks: The property values ARE the demo.
---
# Both

Declares the allowance twice over.

<!-- obsidian-dev-utils-disable-next-line demo-vault-validation/no-wikilinks -- Redundant. -->

See [[Surface]].
`
    );
    const checker = new DemoVaultCoverageChecker({ rootFolder: root });
    expect(checker.findNotesWithUnjustifiedWikilinkAllowance()).toEqual([
      'Both.md: inline directives the note-level allowance already covers'
    ]);
  });

  it('rejects a wikilink allowance with no reason, and one the note no longer needs', () => {
    function declare(reason: string): string {
      return `---\nobsidian-dev-utils:\n  demo-vault-validation:\n    allow-wikilinks:${reason}\n---\n`;
    }

    writeFixtureFile(root, 'demo-vault/Bare.md', `${declare('')}# Bare\n\nStates no reason.\n\n[[Surface]]\n`);
    writeFixtureFile(root, 'demo-vault/Stale.md', `${declare(' Was needed once.')}# Stale\n\nHas no wikilink left.\n`);
    const checker = new DemoVaultCoverageChecker({ rootFolder: root });
    expect(checker.findNotesWithUnjustifiedWikilinkAllowance()).toEqual([
      'Bare.md: a note-level allowance with no reason',
      'Stale.md: a note-level allowance covering no wikilink'
    ]);
  });

  it('does not read a wikilink allowance declared outside the demo-vault-validation path', () => {
    writeFixtureFile(
      root,
      'demo-vault/Elsewhere.md',
      `---
allow-wikilinks: Not nested under the plugin's own key.
---
# Elsewhere

Declares nothing the checker honours.

[[Surface]]
`
    );
    const checker = new DemoVaultCoverageChecker({ rootFolder: root });
    expect(checker.findNotesWithWikilinks()).toEqual(['Elsewhere.md']);
  });

  it('finds a Docs link line', () => {
    writeFixtureFile(root, 'demo-vault/Pointer.md', '# Pointer\n\n[Docs](https://example.com/docs)\n\nExplains nothing itself.\n');
    const checker = new DemoVaultCoverageChecker({ rootFolder: root });
    expect(checker.findNotesWithDocsLinks()).toEqual(['Pointer.md']);
  });

  it('finds a note nothing links to', () => {
    writeFixtureFile(root, 'demo-vault/Orphan.md', '# Orphan\n\nNothing links here.\n');
    const checker = new DemoVaultCoverageChecker({ rootFolder: root });
    expect(checker.findUnreachableNotes({ startNote: START_NOTE_PATH })).toEqual(['Orphan.md']);
  });

  it('follows links transitively, through anchors, percent-encoding, and repeated targets', () => {
    writeFixtureFile(
      root,
      'demo-vault/nested/More.md',
      `# More

Links onward, twice, and to a heading inside the next note.

- [Deep](<./Deeper note.md#section>)
- [Deep again](./Deeper%20note.md)
`
    );
    writeFixtureFile(root, 'demo-vault/nested/Deeper note.md', '# Deeper\n\nReached from More.\n');
    const checker = new DemoVaultCoverageChecker({ rootFolder: root });
    expect(checker.findUnreachableNotes({ startNote: START_NOTE_PATH })).toEqual([]);
  });

  it('does not follow external links or non-note targets, nor a link inside a code fence', () => {
    writeFixtureFile(
      root,
      'demo-vault/nested/More.md',
      `# More

Everything below is a link the walk must not follow.

- [External](https://example.com/Orphan.md)
- [Image](./diagram.png)

\`\`\`md
[Orphan](<./Orphan.md>)
\`\`\`
`
    );
    writeFixtureFile(root, 'demo-vault/Orphan.md', '# Orphan\n\nOnly linked from inside a fence.\n');
    const checker = new DemoVaultCoverageChecker({ rootFolder: root });
    expect(checker.findUnreachableNotes({ startNote: START_NOTE_PATH })).toEqual(['Orphan.md']);
  });

  it('takes a malformed percent-escape in a link literally instead of throwing', () => {
    writeFixtureFile(root, 'demo-vault/nested/More.md', '# More\n\nA link with a bare percent sign.\n\n[Odd](<./100%.md>)\n');
    writeFixtureFile(root, 'demo-vault/nested/100%.md', '# Odd\n\nNamed with a percent sign.\n');
    const checker = new DemoVaultCoverageChecker({ rootFolder: root });
    expect(checker.findUnreachableNotes({ startNote: START_NOTE_PATH })).toEqual([]);
  });

  it('treats every note as unreachable when the start note is missing', () => {
    const checker = new DemoVaultCoverageChecker({ rootFolder: root });
    expect(checker.findUnreachableNotes({ startNote: 'Missing.md' }))
      .toEqual([START_NOTE_PATH, 'nested/More.md', 'Surface.md']);
  });

  it('excludes the vault\'s own readme by default, and any note named explicitly', () => {
    const defaultChecker = new DemoVaultCoverageChecker({ rootFolder: root });
    expect(defaultChecker.findNotesWithDocsLinks()).toEqual([]);
    expect(defaultChecker.findNotesWithWikilinks()).toEqual([]);
    expect(defaultChecker.findNotesWithoutH1()).toEqual([]);

    const strictChecker = new DemoVaultCoverageChecker({ excludedNotes: [], rootFolder: root });
    expect(strictChecker.findNotesWithDocsLinks()).toEqual(['README.md']);
    expect(strictChecker.findNotesWithWikilinks()).toEqual(['README.md']);
    expect(strictChecker.findNotesWithoutH1()).toEqual(['README.md']);
    expect(strictChecker.findUnreachableNotes({ startNote: START_NOTE_PATH })).toEqual(['README.md']);
  });
});
