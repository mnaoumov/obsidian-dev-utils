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
 * Two layers are exposed:
 * - {@link DemoVaultCoverageChecker} — a framework-agnostic core that reads the corpus, parses interface
 *   members, and returns diagnostic arrays (what is undemonstrated / stale / unlinked).
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

import { ObsidianPluginRepoPaths } from '../obsidian/plugin/obsidian-plugin-repo-paths.ts';
import {
  join,
  relative
} from '../path.ts';
import { getMandatoryNamedGroup } from '../reg-exp.ts';

/**
 * Reflects a config interface whose options are demonstrated by their bare name.
 */
export interface DemoVaultConfigInterfaceCoverageSpec {
  /**
   * The name of the `export interface` whose properties are the config options.
   */
  readonly interfaceName: string;

  /**
   * The source file path (relative to the repo root) that declares the interface.
   */
  readonly sourcePath: string;
}

/**
 * The parameters for the {@link DemoVaultCoverageChecker} constructor.
 */
export interface DemoVaultCoverageCheckerConstructorParams {
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
 * The parameters for {@link DemoVaultCoverageChecker.getInterfaceMembers}.
 */
export interface DemoVaultCoverageCheckerGetInterfaceMembersParams {
  /**
   * The name of the `export interface` to parse.
   */
  readonly interfaceName: string;

  /**
   * The source file path (relative to the repo root) that declares the interface.
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
 * Reflects a single interface's members and demonstrates them via `` `${receiver}.<member>` `` references.
 */
export interface DemoVaultInterfaceCoverageSpec {
  /**
   * The name of the `export interface` to reflect.
   */
  readonly interfaceName: string;

  /**
   * Whether the demonstrated members are the interface's methods or its properties.
   */
  readonly kind: DemoVaultInterfaceMemberKind;

  /**
   * The identifier the notes call the members on (e.g. `codeButtonContext`).
   */
  readonly receiver: string;

  /**
   * The source file path (relative to the repo root) that declares the interface.
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
   * The name of the `export interface` whose members are re-parsed for the guard.
   */
  readonly interfaceName: string;

  /**
   * The source file path (relative to the repo root) that declares the interface.
   */
  readonly sourcePath: string;
}

/**
 * The parsed members of a source interface.
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
   * The config interfaces whose options must each be demonstrated by their bare name.
   */
  readonly configInterfaces: DemoVaultConfigInterfaceCoverageSpec[];

  /**
   * The feature-doc linking check, or `undefined` when the plugin ships no `docs/` folder.
   */
  readonly docs?: DemoVaultDocsCoverageSpec;

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
  private readonly demoVaultFolder: string;
  private readonly rootFolder: string;

  /**
   * Creates a checker rooted at a plugin repo.
   *
   * @param params - The parameters for the constructor.
   */
  public constructor(params: DemoVaultCoverageCheckerConstructorParams) {
    this.rootFolder = params.rootFolder;
    this.demoVaultFolder = join(this.rootFolder, ObsidianPluginRepoPaths.DemoVault);
  }

  /**
   * Collects the demo notes as paths relative to the demo vault folder (for a non-trivial-surface guard).
   *
   * @returns The relative paths of every `*.md` note in the demo vault.
   */
  public collectDemoNoteRelativePaths(): string[] {
    return this.collectMarkdownFiles(this.demoVaultFolder).map((file) => relative(this.demoVaultFolder, file));
  }

  /**
   * Finds members that the demo notes reference on a receiver but that no longer exist on it (rename drift).
   *
   * @param params - The parameters for the lookup.
   * @returns The distinct stale member names referenced in the demo corpus.
   */
  public findStaleReferences(params: DemoVaultCoverageCheckerFindStaleReferencesParams): string[] {
    const validMembers = new Set(params.validMembers);
    const referenced = [...this.readCorpus().matchAll(new RegExp(`${params.receiver}\\.(?<member>\\w+)`, 'g'))]
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
   * Parses the members of an `export interface` declared in a source file.
   *
   * @param params - The parameters for the lookup.
   * @returns The parsed {@link InterfaceMembers}.
   * @throws When the interface cannot be found in the source file.
   */
  public getInterfaceMembers(params: DemoVaultCoverageCheckerGetInterfaceMembersParams): InterfaceMembers {
    const source = readFileSync(join(this.rootFolder, params.sourcePath), 'utf-8');
    const match = new RegExp(`export interface ${params.interfaceName} \\{(?<body>[\\s\\S]*?)\\n\\}`).exec(source);
    if (!match) {
      throw new Error(`Could not find interface ${params.interfaceName}`);
    }
    const body = getMandatoryNamedGroup(match, 'body');
    const methods = extractMethodNames(body);
    const properties = extractPropertyNames(body);
    return {
      all: [...methods, ...properties],
      methods,
      properties
    };
  }

  /**
   * Reads and caches the demo corpus — every `*.md` note in the demo vault joined into one string.
   *
   * @returns The concatenated demo-note contents.
   */
  public readCorpus(): string {
    this.cachedCorpus ??= this.collectMarkdownFiles(this.demoVaultFolder)
      .map((file) => readFileSync(file, 'utf-8'))
      .join('\n');
    return this.cachedCorpus;
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
  const checker = new DemoVaultCoverageChecker({ rootFolder: params.rootFolder });

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

    const docs = params.docs;
    if (docs) {
      it('links a demo note for every feature doc', () => {
        expect(checker.findUnlinkedFeatureDocs({ docsFolder: docs.folder, nonFeatureDocs: docs.nonFeatureDocs }))
          .toEqual([]);
      });
    }

    it('keeps the reflected surface non-trivial', () => {
      const guard = params.nonTrivialGuard;
      const members = checker.getInterfaceMembers(guard);
      expect(members.all).toContain(guard.expectMember);
      expect(checker.collectDemoNoteRelativePaths()).toContain(guard.expectDemoNote);
    });
  });
}

function extractMethodNames(interfaceBody: string): string[] {
  return [...interfaceBody.matchAll(/^ {2}(?<name>\w+)(?:<[^>]*>)?\(/gm)].map((match) => getMandatoryNamedGroup(match, 'name'));
}

function extractPropertyNames(interfaceBody: string): string[] {
  return [...interfaceBody.matchAll(/^ {2}(?<name>\w+)\??:/gm)].map((match) => getMandatoryNamedGroup(match, 'name'));
}
