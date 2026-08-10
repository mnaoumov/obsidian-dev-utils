/**
 * @file
 *
 * Static coverage/freshness checks that keep a plugin's in-repo `demo-vault/` in sync with its public surface.
 *
 * A plugin can ship a curated demo vault at `demo-vault/` in its repo root. These helpers reflect the real
 * public API/config/docs straight from source and assert — WITHOUT launching Obsidian — that every feature is
 * demonstrated in the notes and that the notes reference no API member that no longer exists (rename drift).
 * The runtime behavior of the plugin is covered by its other integration tests, not by the demo vault; the
 * vault is a learning resource, and these checks only guard that it stays truthful.
 *
 * They also enforce the demo-vault AUTHORING convention — every note opens with an `# H1` and a plain
 * prose paragraph, every note is reachable from the start note, and no note uses a `[[wikilink]]` or a
 * `[Docs](…)` line. These checks are unconditional: the demo vault is the published documentation, read
 * in Obsidian AND on GitHub (where a wikilink does not render), so a note that breaks the convention is
 * broken for real readers. `authoring` only tunes them (which note is the start, which notes sit outside
 * the learning path); it cannot switch them off.
 *
 * Two layers are exposed:
 * - {@link DemoVaultCoverageChecker} — a framework-agnostic core that reads the corpus, parses interface /
 *   class / enum members and exported functions, and returns diagnostic arrays (what is undemonstrated / stale
 *   / unlinked / off-convention).
 * - {@link registerDemoVaultCoverageSuite} — a thin wrapper that registers a `vitest` suite over the core, so
 *   a plugin's `demo-vault.no-app.integration.test.ts` is a single declarative call.
 */

import {
  readdirSync,
  readFileSync
} from 'node:fs';
import {
  describe,
  expect,
  it
} from 'vitest';

import { normalizeOptionalProperties } from '../object-utils.ts';
import { ObsidianPluginRepoPaths } from '../obsidian/plugin/obsidian-plugin-repo-paths.ts';
import {
  dirname,
  join,
  relative
} from '../path.ts';
import { getMandatoryNamedGroup } from '../reg-exp.ts';
import { ensureNonNullable } from '../type-guards.ts';

/**
 * Tunes the always-on authoring checks. It cannot disable them — see the file overview.
 */
export interface DemoVaultAuthoringSpec {
  /**
   * The notes (paths relative to the demo vault) that sit outside the learning path and are therefore
   * exempt from every authoring check. Defaults to the vault's own `README.md`, which addresses someone
   * browsing the repo on GitHub rather than a reader working through the vault.
   */
  readonly excludedNotes?: string[];

  /**
   * The note (path relative to the demo vault) every other note must be reachable from. Defaults to
   * `00 Start.md`.
   */
  readonly startNote?: string;
}

/**
 * Reflects a config interface whose options are demonstrated by their bare name.
 */
export interface DemoVaultConfigInterfaceCoverageSpec {
  /**
   * The name of the `export interface`, `export class`, or `export enum` whose properties are the config
   * options.
   */
  readonly interfaceName: string;

  /**
   * The source file path (relative to the repo root) that declares the interface, class, or enum.
   */
  readonly sourcePath: string;
}

/**
 * The parameters for the {@link DemoVaultCoverageChecker} constructor.
 */
export interface DemoVaultCoverageCheckerConstructorParams {
  /**
   * The notes (paths relative to the demo vault) exempt from the authoring checks. Defaults to the
   * vault's own `README.md`.
   */
  readonly excludedNotes?: string[];

  /**
   * The absolute path of the plugin repo root — the folder containing `demo-vault/` and the source being
   * reflected. Callers typically pass `getRootFolder() ?? process.cwd()`.
   */
  readonly rootFolder: string;
}

/**
 * The parameters for {@link DemoVaultCoverageChecker.findStaleReferences}.
 */
export interface DemoVaultCoverageCheckerFindStaleReferencesParams {
  /**
   * The receiver whose `` `${receiver}.<member>` `` references are scanned for in the demo corpus.
   */
  readonly receiver: string;

  /**
   * The members that currently exist on the receiver; any referenced member not in this set is stale.
   */
  readonly validMembers: string[];
}

/**
 * The parameters for {@link DemoVaultCoverageChecker.findUndemonstratedMembers}.
 */
export interface DemoVaultCoverageCheckerFindUndemonstratedMembersParams {
  /**
   * The member names that must each appear in the demo corpus.
   */
  readonly members: string[];

  /**
   * When set, a member is demonstrated only if `` `${receiver}.${member}` `` appears (e.g. a context object's
   * methods); when absent, the bare member name is looked up (e.g. a config option).
   */
  readonly receiver?: string;
}

/**
 * The parameters for {@link DemoVaultCoverageChecker.findUnlinkedFeatureDocs}.
 */
export interface DemoVaultCoverageCheckerFindUnlinkedFeatureDocsParams {
  /**
   * The docs folder (relative to the repo root) whose top-level `*.md` files are the feature docs.
   */
  readonly docsFolder: string;

  /**
   * The doc basenames (without `.md`) that are NOT per-feature pages and so need no linking demo note.
   */
  readonly nonFeatureDocs: string[];
}

/**
 * The parameters for {@link DemoVaultCoverageChecker.findUnreachableNotes}.
 */
export interface DemoVaultCoverageCheckerFindUnreachableNotesParams {
  /**
   * The note (path relative to the demo vault) the walk starts from, e.g. `00 Start.md`.
   */
  readonly startNote: string;
}

/**
 * The parameters for {@link DemoVaultCoverageChecker.getExportedFunctionNames}.
 */
export interface DemoVaultCoverageCheckerGetExportedFunctionNamesParams {
  /**
   * The source file path (relative to the repo root) whose `export function`s are parsed.
   */
  readonly sourcePath: string;
}

/**
 * The parameters for {@link DemoVaultCoverageChecker.getInterfaceMembers}.
 */
export interface DemoVaultCoverageCheckerGetInterfaceMembersParams {
  /**
   * The name of the `export interface`, `export class`, or `export enum` to parse.
   */
  readonly interfaceName: string;

  /**
   * The source file path (relative to the repo root) that declares the interface, class, or enum.
   */
  readonly sourcePath: string;
}

/**
 * Configures the feature-doc linking check.
 */
export interface DemoVaultDocsCoverageSpec {
  /**
   * The docs folder (relative to the repo root) whose top-level `*.md` files are the feature docs.
   */
  readonly folder: string;

  /**
   * The doc basenames (without `.md`) that are NOT per-feature pages and so need no linking demo note.
   */
  readonly nonFeatureDocs: string[];
}

/**
 * Reflects a module's exported functions, each demonstrated by its bare name in the demo corpus.
 */
export interface DemoVaultFunctionsCoverageSpec {
  /**
   * The source file path (relative to the repo root) whose `export function`s must each be demonstrated.
   */
  readonly sourcePath: string;
}

/**
 * Reflects a single interface's members and demonstrates them via `` `${receiver}.<member>` `` references.
 */
export interface DemoVaultInterfaceCoverageSpec {
  /**
   * The name of the `export interface`, `export class`, or `export enum` to reflect.
   */
  readonly interfaceName: string;

  /**
   * Whether the demonstrated members are the reflected type's methods or its properties (enum members count as
   * properties).
   */
  readonly kind: DemoVaultInterfaceMemberKind;

  /**
   * The identifier the notes call the members on (e.g. `codeButtonContext`).
   */
  readonly receiver: string;

  /**
   * The source file path (relative to the repo root) that declares the interface, class, or enum.
   */
  readonly sourcePath: string;
}

/**
 * Whether an interface's demonstrated members are its methods or its properties.
 */
export type DemoVaultInterfaceMemberKind = 'methods' | 'properties';

/**
 * Configures the guard that the reflected surface is non-trivial (protects against a parsing regression
 * silently emptying every other check).
 */
export interface DemoVaultNonTrivialGuardSpec {
  /**
   * A demo note (path relative to the demo vault) that must be present.
   */
  readonly expectDemoNote: string;

  /**
   * A member that must be reflected from {@link DemoVaultNonTrivialGuardSpec.interfaceName}.
   */
  readonly expectMember: string;

  /**
   * The name of the `export interface`, `export class`, or `export enum` whose members are re-parsed for the
   * guard.
   */
  readonly interfaceName: string;

  /**
   * The source file path (relative to the repo root) that declares the interface, class, or enum.
   */
  readonly sourcePath: string;
}

/**
 * A single demo note, as read from the demo vault.
 */
export interface DemoVaultNote {
  /**
   * The note's raw Markdown content.
   */
  readonly content: string;

  /**
   * The note's path relative to the demo vault folder, e.g. `00 Start.md`.
   */
  readonly relativePath: string;
}

/**
 * The parsed members of a source interface, class, or enum.
 */
export interface InterfaceMembers {
  /**
   * Every member — {@link InterfaceMembers.methods} followed by {@link InterfaceMembers.properties}.
   */
  readonly all: string[];

  /**
   * The method members (declared as `name(...)`).
   */
  readonly methods: string[];

  /**
   * The property members (declared as `name?: ...`).
   */
  readonly properties: string[];
}

/**
 * The parameters for {@link registerDemoVaultCoverageSuite}.
 */
export interface RegisterDemoVaultCoverageSuiteParams {
  /**
   * Tunes the always-on authoring checks, or `undefined` to take their defaults. It cannot disable them.
   */
  readonly authoring?: DemoVaultAuthoringSpec;

  /**
   * The config interfaces whose options must each be demonstrated by their bare name.
   */
  readonly configInterfaces: DemoVaultConfigInterfaceCoverageSpec[];

  /**
   * The feature-doc linking check, or `undefined` when the plugin ships no `docs/` folder.
   */
  readonly docs?: DemoVaultDocsCoverageSpec;

  /**
   * The modules whose `export function`s must each be demonstrated by their bare name, or `undefined` when the
   * plugin exposes no such module to check.
   */
  readonly functionModules?: DemoVaultFunctionsCoverageSpec[];

  /**
   * The interfaces whose members must each be demonstrated (and referenced without drift).
   */
  readonly interfaces: DemoVaultInterfaceCoverageSpec[];

  /**
   * The guard that keeps the reflected surface non-trivial.
   */
  readonly nonTrivialGuard: DemoVaultNonTrivialGuardSpec;

  /**
   * The absolute path of the plugin repo root. Callers typically pass `getRootFolder() ?? process.cwd()`.
   */
  readonly rootFolder: string;
}

/**
 * Reflects a plugin's public surface from source and checks its in-repo `demo-vault/` stays in sync with it.
 *
 * Every method is a pure query over files under the repo root (the demo corpus is read once and cached), so
 * the checker is trivially unit-testable against a fixture repo and carries no test-framework dependency.
 */
export class DemoVaultCoverageChecker {
  private cachedCorpus: null | string = null;
  private cachedNotes: DemoVaultNote[] | null = null;
  private readonly demoVaultFolder: string;
  private readonly excludedNotes: Set<string>;
  private readonly rootFolder: string;

  /**
   * Creates a checker rooted at a plugin repo.
   *
   * @param params - The parameters for the constructor.
   */
  public constructor(params: DemoVaultCoverageCheckerConstructorParams) {
    this.rootFolder = params.rootFolder;
    this.demoVaultFolder = join(this.rootFolder, ObsidianPluginRepoPaths.DemoVault);
    this.excludedNotes = new Set(params.excludedNotes ?? DEFAULT_EXCLUDED_NOTES);
  }

  /**
   * Collects the demo notes as paths relative to the demo vault folder (for a non-trivial-surface guard).
   *
   * @returns The relative paths of every `*.md` note in the demo vault.
   */
  public collectDemoNoteRelativePaths(): string[] {
    return this.collectNotes().map((note) => note.relativePath);
  }

  /**
   * Reads and caches every demo note individually — the per-note view the authoring checks work on, as
   * opposed to the concatenated {@link DemoVaultCoverageChecker.readCorpus}.
   *
   * @returns Every `*.md` note in the demo vault, excluded ones included.
   */
  public collectNotes(): DemoVaultNote[] {
    this.cachedNotes ??= this.collectMarkdownFiles(this.demoVaultFolder).map((file) => ({
      content: readFileSync(file, 'utf-8'),
      relativePath: relative(this.demoVaultFolder, file)
    }));
    return this.cachedNotes;
  }

  /**
   * Finds notes carrying a `[Docs](…)` link line. The note IS the documentation, so a line pointing
   * elsewhere for the real explanation is the shape this convention exists to remove.
   *
   * @returns The relative paths of the offending notes.
   */
  public findNotesWithDocsLinks(): string[] {
    return this.collectCheckableNotes()
      .filter((note) => getLinesOutsideFences(note.content).some((line) => DOCS_LINK_REG_EXP.test(line)))
      .map((note) => note.relativePath);
  }

  /**
   * Finds notes that do not open with an `# H1` (frontmatter aside).
   *
   * @returns The relative paths of the offending notes.
   */
  public findNotesWithoutH1(): string[] {
    return this.collectCheckableNotes()
      .filter((note) => !hasH1(note.content))
      .map((note) => note.relativePath);
  }

  /**
   * Finds notes with no prose paragraph before their first code fence — the 1-3 sentences saying what the
   * feature does and why a reader would want it, without which the note is a button with no lesson.
   *
   * @returns The relative paths of the offending notes.
   */
  public findNotesWithoutIntroProse(): string[] {
    return this.collectCheckableNotes()
      .filter((note) => !hasIntroProse(note.content))
      .map((note) => note.relativePath);
  }

  /**
   * Finds notes using an Obsidian `[[wikilink]]` outside a code fence. The demo vault is also read on
   * GitHub, where a wikilink renders as literal brackets and leads nowhere. A wikilink shown INSIDE a
   * fence is sample text, not navigation, so fenced blocks are skipped.
   *
   * @returns The relative paths of the offending notes.
   */
  public findNotesWithWikilinks(): string[] {
    return this.collectCheckableNotes()
      .filter((note) => getLinesOutsideFences(note.content).some((line) => WIKILINK_REG_EXP.test(stripInlineCode(line))))
      .map((note) => note.relativePath);
  }

  /**
   * Finds members that the demo notes reference on a receiver but that no longer exist on it (rename drift).
   *
   * @param params - The parameters for the lookup.
   * @returns The distinct stale member names referenced in the demo corpus.
   */
  public findStaleReferences(params: DemoVaultCoverageCheckerFindStaleReferencesParams): string[] {
    const validMembers = new Set(params.validMembers);
    const referenced = [...this.readCorpus().matchAll(new RegExp(String.raw`${params.receiver}\.(?<member>\w+)`, 'g'))]
      .map((match) => getMandatoryNamedGroup(match, 'member'));
    return [...new Set(referenced)].filter((member) => !validMembers.has(member));
  }

  /**
   * Finds members that are not demonstrated anywhere in the demo corpus.
   *
   * @param params - The parameters for the lookup.
   * @returns The member names with no demonstration.
   */
  public findUndemonstratedMembers(params: DemoVaultCoverageCheckerFindUndemonstratedMembersParams): string[] {
    const corpus = this.readCorpus();
    return params.members.filter((member) => {
      const needle = params.receiver === undefined ? member : `${params.receiver}.${member}`;
      return !corpus.includes(needle);
    });
  }

  /**
   * Finds feature docs that no demo note links to.
   *
   * @param params - The parameters for the lookup.
   * @returns The feature-doc basenames (without `.md`) not linked from any demo note.
   */
  public findUnlinkedFeatureDocs(params: DemoVaultCoverageCheckerFindUnlinkedFeatureDocsParams): string[] {
    const nonFeatureDocs = new Set(params.nonFeatureDocs);
    const featureDocs = readdirSync(join(this.rootFolder, params.docsFolder))
      .filter((file) => file.endsWith('.md'))
      .map((file) => file.replace(/\.md$/, ''))
      .filter((name) => !nonFeatureDocs.has(name));
    const linkedDocs = new Set(
      [...this.readCorpus().matchAll(/docs\/(?<doc>[\w-]+)\.md/g)].map((match) => getMandatoryNamedGroup(match, 'doc'))
    );
    return featureDocs.filter((doc) => !linkedDocs.has(doc));
  }

  /**
   * Finds notes that cannot be reached from the start note by following Markdown links between notes.
   *
   * The walk starts at {@link DemoVaultCoverageCheckerFindUnreachableNotesParams.startNote} and follows
   * every `[Text](<./NN Name.md>)` link outside a code fence, transitively. A note nothing links to is
   * one a reader can only find by browsing the file list — which is exactly what the grouped index in the
   * start note is meant to replace. When the start note itself is missing, EVERY note is unreachable,
   * because there is nowhere to start from.
   *
   * @param params - The parameters for the walk.
   * @returns The relative paths of the unreachable notes.
   */
  public findUnreachableNotes(params: DemoVaultCoverageCheckerFindUnreachableNotesParams): string[] {
    const notesByRelativePath = new Map(this.collectNotes().map((note) => [note.relativePath, note]));
    const reachedNotes = new Set<string>();
    const pendingNotes = [params.startNote];

    while (pendingNotes.length > 0) {
      const notePath = ensureNonNullable(pendingNotes.pop());
      const note = notesByRelativePath.get(notePath);
      if (!note || reachedNotes.has(notePath)) {
        continue;
      }
      reachedNotes.add(notePath);
      pendingNotes.push(...collectNoteLinkTargets(note));
    }

    return this.collectCheckableNotes()
      .map((note) => note.relativePath)
      .filter((notePath) => !reachedNotes.has(notePath));
  }

  /**
   * Parses the names of the `export function`s (including `async` and generator declarations) in a source file.
   *
   * @param params - The parameters for the lookup.
   * @returns The exported function names in source order.
   */
  public getExportedFunctionNames(params: DemoVaultCoverageCheckerGetExportedFunctionNamesParams): string[] {
    const source = readFileSync(join(this.rootFolder, params.sourcePath), 'utf-8');
    return [...source.matchAll(/^export (?:async )?function\*? (?<name>\w+)/gm)]
      .map((match) => getMandatoryNamedGroup(match, 'name'));
  }

  /**
   * Parses the members of an `export interface`, `export class`, or `export enum` declared in a source file.
   *
   * @param params - The parameters for the lookup.
   * @returns The parsed {@link InterfaceMembers}.
   * @throws When the interface, class, or enum cannot be found in the source file.
   */
  public getInterfaceMembers(params: DemoVaultCoverageCheckerGetInterfaceMembersParams): InterfaceMembers {
    const source = readFileSync(join(this.rootFolder, params.sourcePath), 'utf-8');
    const match = new RegExp(String.raw`export (?<keyword>interface|class|enum) ${params.interfaceName}\b[^{]*\{(?<body>[\s\S]*?)\n\}`).exec(source);
    if (!match) {
      throw new Error(`Could not find interface ${params.interfaceName}`);
    }
    return parseMembers(getMandatoryNamedGroup(match, 'keyword'), getMandatoryNamedGroup(match, 'body'));
  }

  /**
   * Reads and caches the demo corpus — every `*.md` note in the demo vault joined into one string.
   *
   * @returns The concatenated demo-note contents.
   */
  public readCorpus(): string {
    this.cachedCorpus ??= this.collectNotes()
      .map((note) => note.content)
      .join('\n');
    return this.cachedCorpus;
  }

  // The notes the authoring checks apply to: every note except the ones declared outside the learning
  // Path (the vault's own `README.md` by default).
  private collectCheckableNotes(): DemoVaultNote[] {
    return this.collectNotes().filter((note) => !this.excludedNotes.has(note.relativePath));
  }

  private collectMarkdownFiles(folder: string): string[] {
    const result: string[] = [];
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name === ObsidianPluginRepoPaths.NodeModules as string) {
          continue;
        }
        result.push(...this.collectMarkdownFiles(join(folder, entry.name)));
      } else if (entry.name.endsWith('.md')) {
        result.push(join(folder, entry.name));
      }
    }
    return result;
  }
}

/**
 * Registers a `vitest` suite that keeps a plugin's in-repo `demo-vault/` in sync with its public surface.
 *
 * Call it once from a plugin's `demo-vault.no-app.integration.test.ts`; it registers one test per check,
 * delegating to {@link DemoVaultCoverageChecker}.
 *
 * @param params - The declarative coverage specification.
 */
export function registerDemoVaultCoverageSuite(params: RegisterDemoVaultCoverageSuiteParams): void {
  const checker = new DemoVaultCoverageChecker(normalizeOptionalProperties<DemoVaultCoverageCheckerConstructorParams>({
    excludedNotes: params.authoring?.excludedNotes,
    rootFolder: params.rootFolder
  }));
  const startNote = params.authoring?.startNote ?? DEFAULT_START_NOTE;

  describe('demo-vault coverage', () => {
    for (const spec of params.interfaces) {
      it(`demonstrates every ${spec.interfaceName} ${spec.kind}`, () => {
        const members = checker.getInterfaceMembers(spec);
        const demonstrated = members[spec.kind];
        expect(demonstrated.length).toBeGreaterThan(0);
        expect(checker.findUndemonstratedMembers({ members: demonstrated, receiver: spec.receiver })).toEqual([]);
      });

      it(`references no ${spec.interfaceName} member that no longer exists`, () => {
        const members = checker.getInterfaceMembers(spec);
        expect(checker.findStaleReferences({ receiver: spec.receiver, validMembers: members.all })).toEqual([]);
      });
    }

    for (const spec of params.configInterfaces) {
      it(`demonstrates every ${spec.interfaceName} option`, () => {
        const members = checker.getInterfaceMembers(spec);
        expect(members.properties.length).toBeGreaterThan(0);
        expect(checker.findUndemonstratedMembers({ members: members.properties })).toEqual([]);
      });
    }

    for (const spec of params.functionModules ?? []) {
      it(`demonstrates every exported function in ${spec.sourcePath}`, () => {
        const functionNames = checker.getExportedFunctionNames(spec);
        expect(functionNames.length).toBeGreaterThan(0);
        expect(checker.findUndemonstratedMembers({ members: functionNames })).toEqual([]);
      });
    }

    const docs = params.docs;
    if (docs) {
      it('links a demo note for every feature doc', () => {
        expect(checker.findUnlinkedFeatureDocs({ docsFolder: docs.folder, nonFeatureDocs: docs.nonFeatureDocs }))
          .toEqual([]);
      });
    }

    it('opens every note with an H1', () => {
      expect(checker.findNotesWithoutH1()).toEqual([]);
    });

    it('opens every note with a prose paragraph before its first code block', () => {
      expect(checker.findNotesWithoutIntroProse()).toEqual([]);
    });

    it(`reaches every note from ${startNote}`, () => {
      expect(checker.findUnreachableNotes({ startNote })).toEqual([]);
    });

    it('uses no wikilinks, which do not render on GitHub', () => {
      expect(checker.findNotesWithWikilinks()).toEqual([]);
    });

    it('carries no Docs link line, because the note is the docs', () => {
      expect(checker.findNotesWithDocsLinks()).toEqual([]);
    });

    it('keeps the reflected surface non-trivial', () => {
      const guard = params.nonTrivialGuard;
      const members = checker.getInterfaceMembers(guard);
      expect(members.all).toContain(guard.expectMember);
      expect(checker.collectDemoNoteRelativePaths()).toContain(guard.expectDemoNote);
    });
  });
}

const CLASS_MEMBER_MODIFIERS = String.raw`(?:(?:public|private|protected|readonly|static|abstract|override)\s+)*`;
const ABSOLUTE_URL_REG_EXP = /^[a-z][\w+.-]*:/i;
const ANGLE_BRACKETS_REG_EXP = /^<|>$/g;
const CODE_FENCE_REG_EXP = /^\s*(?:```|~~~)/;
const DEFAULT_EXCLUDED_NOTES = ['README.md'];
const DEFAULT_START_NOTE = '00 Start.md';
const DOCS_LINK_REG_EXP = /^\s*\[Docs]\(/;
const FRONTMATTER_REG_EXP = /^---\r?\n[\s\S]*?\r?\n---[^\S\n]*\r?\n?/;
const H1_REG_EXP = /^# \S/;
const HEADING_REG_EXP = /^#{1,6} /;
const INLINE_CODE_REG_EXP = /`[^`\n]*`/g;
const MARKDOWN_LINK_REG_EXP = /\[[^\]]*]\((?<target>[^)]+)\)/g;
const WIKILINK_REG_EXP = /\[\[[^\]]+]]/;

function buildMembers(methods: string[], properties: string[]): InterfaceMembers {
  return {
    all: [...methods, ...properties],
    methods,
    properties
  };
}

// Resolves the notes a note links to: every Markdown link outside a code fence whose target is a `.md`
// File, made relative to the demo vault so it can be looked up in the note map. External URLs and
// Non-note targets (images, scripts) are not part of the learning path and are skipped; a `#anchor` is
// Dropped, since it addresses a place inside an already-resolved note.
function collectNoteLinkTargets(note: DemoVaultNote): string[] {
  const targets: string[] = [];
  for (const line of getLinesOutsideFences(note.content)) {
    for (const match of stripInlineCode(line).matchAll(MARKDOWN_LINK_REG_EXP)) {
      const target = getMandatoryNamedGroup(match, 'target').replaceAll(ANGLE_BRACKETS_REG_EXP, '');
      const [notePath = ''] = target.split('#', 1);
      if (ABSOLUTE_URL_REG_EXP.test(notePath) || !notePath.toLowerCase().endsWith('.md')) {
        continue;
      }
      targets.push(join(dirname(note.relativePath), tryDecodeUriComponent(notePath)));
    }
  }
  return targets;
}

function extractClassMethodNames(classBody: string): string[] {
  return [...classBody.matchAll(new RegExp(String.raw`^ {2}(?<modifiers>${CLASS_MEMBER_MODIFIERS})(?<name>\w+)(?:<[^>]*>)?\(`, 'gm'))]
    .filter((match) => !isNonPublicMember(getMandatoryNamedGroup(match, 'modifiers')))
    .map((match) => getMandatoryNamedGroup(match, 'name'));
}

function extractClassPropertyNames(classBody: string): string[] {
  return [...classBody.matchAll(new RegExp(String.raw`^ {2}(?<modifiers>${CLASS_MEMBER_MODIFIERS})(?<name>\w+)\s*\??\s*[:=]`, 'gm'))]
    .filter((match) => !isNonPublicMember(getMandatoryNamedGroup(match, 'modifiers')))
    .map((match) => getMandatoryNamedGroup(match, 'name'));
}

function extractEnumMemberNames(enumBody: string): string[] {
  return [...enumBody.matchAll(/^ {2}(?<name>\w+)/gm)].map((match) => getMandatoryNamedGroup(match, 'name'));
}

function extractMethodNames(interfaceBody: string): string[] {
  return [...interfaceBody.matchAll(/^ {2}(?<name>\w+)(?:<[^>]*>)?\(/gm)].map((match) => getMandatoryNamedGroup(match, 'name'));
}

function extractPropertyNames(interfaceBody: string): string[] {
  return [...interfaceBody.matchAll(/^ {2}(?<name>\w+)\??:/gm)].map((match) => getMandatoryNamedGroup(match, 'name'));
}

// Returns the note's lines with fenced code blocks removed (the fence lines included), so a check never
// Mistakes sample code for prose — a `[[wikilink]]` demonstrated inside a fence is text, not navigation.
function getLinesOutsideFences(content: string): string[] {
  const lines: string[] = [];
  let isInsideFence = false;
  for (const line of content.split('\n')) {
    if (CODE_FENCE_REG_EXP.test(line)) {
      isInsideFence = !isInsideFence;
      continue;
    }
    if (!isInsideFence) {
      lines.push(line);
    }
  }
  return lines;
}

// Whether the note's first content line (frontmatter and blank lines aside) is an `# H1`.
function hasH1(content: string): boolean {
  for (const line of stripFrontmatter(content).split('\n')) {
    const trimmedLine = line.trim();
    if (trimmedLine === '') {
      continue;
    }
    return H1_REG_EXP.test(trimmedLine);
  }
  return false;
}

// Whether a plain prose line appears before the note's first code fence. Headings are not prose — a note
// That goes straight from its title to a button is exactly the shape this check rejects.
function hasIntroProse(content: string): boolean {
  for (const line of stripFrontmatter(content).split('\n')) {
    if (CODE_FENCE_REG_EXP.test(line)) {
      return false;
    }
    const trimmedLine = line.trim();
    if (trimmedLine === '' || HEADING_REG_EXP.test(trimmedLine)) {
      continue;
    }
    return true;
  }
  return false;
}

function isNonPublicMember(modifiers: string): boolean {
  return /\b(?:private|protected)\b/.test(modifiers);
}

function parseMembers(keyword: string, body: string): InterfaceMembers {
  switch (keyword) {
    case 'class': {
      return buildMembers(extractClassMethodNames(body), extractClassPropertyNames(body));
    }
    case 'enum': {
      return buildMembers([], extractEnumMemberNames(body));
    }
    default: {
      return buildMembers(extractMethodNames(body), extractPropertyNames(body));
    }
  }
}

function stripFrontmatter(content: string): string {
  return content.replace(FRONTMATTER_REG_EXP, '');
}

function stripInlineCode(line: string): string {
  return line.replaceAll(INLINE_CODE_REG_EXP, '');
}

// A hand-written link may contain a bare `%` (or any other invalid percent-escape), which makes
// `decodeURIComponent` throw. Such a target is meant literally, so it is used as written.
function tryDecodeUriComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
