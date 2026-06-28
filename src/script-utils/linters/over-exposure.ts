/**
 * @file
 *
 * Over-exposure analyzer.
 *
 * Finds declarations exposed more broadly than their references require, so the exposure can be
 * tightened:
 *
 * - `export`ed symbols referenced only within their own file — the `export` can be dropped.
 * - `public` class members referenced only inside their own class — they can be `private`.
 * - `public` class members referenced only inside their own class and its subclasses — they can be
 *   `protected`.
 * - `protected` class members referenced only inside their own class — they can be `private`.
 *
 * The analysis is whole-program and type-aware: it uses the TypeScript language service's
 * find-all-references to locate every use of each declaration, then classifies the tightest
 * exposure that still covers all references. Because `findReferences` does not link a string-literal
 * argument back to a member declaration when the parameter is a conditional/mapped key type (e.g.
 * `bind(component, 'someSetting')` where the key is typed `ConditionalKeys<Settings, …>`), member
 * analysis additionally treats a string literal whose text equals the member name as a reference —
 * but only when its contextual type is a string-literal type (or union of them) all of whose members
 * are keys of the declaring class, so incidental same-named strings (`console.log('name')`) are not
 * miscounted. Members invoked by the framework via registration
 * rather than by visible references (Obsidian lifecycle hooks, settings-tab `display`, etc.) are
 * excluded via {@link LIFECYCLE_ALLOWLIST}, as are `override` and `static` members whose exposure is
 * constrained by a base declaration. ECMAScript hard-private members (`#name`) are also excluded —
 * they are already maximally private and cannot carry a visibility modifier. A declaration carrying
 * a TSDoc (`/** … *\/`) documentation comment is likewise excluded — whether a top-level `export` or
 * a class member, documenting it is a deliberate signal that it is part of the intended public API,
 * regardless of where it currently happens to be referenced.
 *
 * A member referenced only from test files is reported with {@link OverExposureFinding.isForcedByTestOnly}
 * set, surfacing members widened purely for testability — the canonical case for extracting logic
 * into an independently testable component instead.
 *
 * Beyond reporting, passing `shouldFix` to {@link findOverExposure} / {@link analyzeOverExposure}
 * rewrites the source in place: dropping the `export` keyword, or replacing/inserting a `private`
 * or `protected` modifier. Each finding then carries {@link OverExposureFinding.wasFixed} /
 * {@link OverExposureFinding.skipReason}. Changes that cannot be safely automated — those forced
 * only by test references, decorated members, or an `export` shared with a still-exported sibling —
 * are reported as skipped and left untouched.
 *
 * Additionally passing `shouldForce` (only meaningful together with `shouldFix`) tightens the
 * declarations held wide purely by test references too — the production half of the canonical
 * test-only migration: the member becomes `private` / the `export` is dropped, leaving only the
 * test to switch to a cast-based access. Decorated members and exports shared with a still-exported
 * sibling stay skipped even under `shouldForce`, because no edit can be applied safely.
 */

import type {
  ClassDeclaration,
  ClassLikeDeclaration,
  CompilerOptions,
  EnumDeclaration,
  FunctionDeclaration,
  GetAccessorDeclaration,
  InterfaceDeclaration,
  IScriptSnapshot,
  LanguageService,
  LanguageServiceHost,
  MethodDeclaration,
  Node,
  Program,
  PropertyDeclaration,
  ReferencedSymbol,
  SetAccessorDeclaration,
  SourceFile,
  StringLiteralLike,
  Type,
  TypeAliasDeclaration,
  TypeChecker,
  VariableStatement
} from 'typescript';

import {
  canHaveModifiers,
  createDocumentRegistry,
  createLanguageService,
  getDecorators,
  getDefaultLibFilePath,
  getLeadingCommentRanges,
  getModifiers,
  isClassDeclaration,
  isClassLike,
  isEnumDeclaration,
  isFunctionDeclaration,
  isGetAccessorDeclaration,
  isIdentifier,
  isInterfaceDeclaration,
  isMethodDeclaration,
  isPrivateIdentifier,
  isPropertyDeclaration,
  isSetAccessorDeclaration,
  isSourceFile,
  isStringLiteralLike,
  isTypeAliasDeclaration,
  isVariableStatement,
  ScriptSnapshot,
  SyntaxKind,
  sys
} from 'typescript';

import { assertNonNullable } from '../../type-guards.ts';
import {
  parseTsConfig,
  toCanonical
} from '../check-project-types.ts';

/**
 * Parameters for {@link analyzeOverExposure}.
 */
export interface AnalyzeOverExposureParams {
  /** The language service to query for references and types. */
  readonly languageService: LanguageService;

  /**
   * Optional callback invoked once per analyzed source file, before that file is processed. The
   * whole-program reference analysis is slow, so this lets callers report live progress instead of
   * appearing to hang.
   */
  onProgress?(this: void, progress: OverExposureProgress): void;

  /**
   * When `true`, each fixable finding is tightened in place via {@link writeFile} (which must then
   * be provided), and the returned findings carry {@link OverExposureFinding.wasFixed} /
   * {@link OverExposureFinding.skipReason}. When `false` or omitted, the analysis only reports.
   *
   * @default `false`
   */
  readonly shouldFix?: boolean | undefined;

  /**
   * When `true` (only meaningful together with {@link shouldFix}), declarations held wide purely by
   * test references are tightened too, instead of being skipped with a `test-only`
   * {@link OverExposureFinding.skipReason}. Decorated members and exports shared with a
   * still-exported sibling stay skipped regardless, because no edit can be applied safely.
   *
   * @default `false`
   */
  readonly shouldForce?: boolean | undefined;

  /**
   * Absolute (canonical) path of the project's `src` folder. Only declarations in non-test files
   * under this folder are analyzed; declarations elsewhere (test files, dependencies) are ignored
   * but still counted as reference sites.
   */
  readonly srcFolder: string;

  /**
   * Writes the tightened contents of a changed file back to disk. Required when {@link shouldFix}
   * is `true`; ignored otherwise.
   *
   * @param path - Absolute path of the file to write (original casing, as stored in the program).
   * @param content - The full new file contents.
   */
  writeFile?(this: void, path: string, content: string): void;
}

/**
 * Parameters for {@link createLanguageServiceHost}.
 */
export interface CreateLanguageServiceHostParams {
  /** The compiler options. */
  readonly compilerOptions: CompilerOptions;

  /** The files to include in the program. */
  readonly fileNames: readonly string[];

  /** The file-system operations used to read sources. */
  readonly fileSystem: OverExposureFileSystem;
}

/**
 * Parameters for {@link createProjectLanguageService}.
 */
export interface CreateProjectLanguageServiceParams {
  /** Absolute path to the project's `tsconfig.json`. */
  readonly tsConfigPath: string;
}

/**
 * The exposure level a declaration currently has.
 */
export type CurrentExposure = 'export' | 'protected' | 'public';

/**
 * Parameters for {@link findOverExposure}.
 */
export interface FindOverExposureParams {
  /**
   * Optional callback invoked once per analyzed source file, for live progress reporting. Forwarded
   * to {@link analyzeOverExposure}.
   */
  onProgress?(this: void, progress: OverExposureProgress): void;

  /** Absolute path to the project root (the folder containing `tsconfig.json` and `src`). */
  readonly projectFolder: string;

  /**
   * When `true`, fixable findings are tightened in place on disk (the `export` keyword is dropped,
   * or a `private` / `protected` modifier is inserted/replaced). When `false` or omitted, the
   * project is only analyzed.
   *
   * @default `false`
   */
  readonly shouldFix?: boolean | undefined;

  /**
   * When `true` (only meaningful together with {@link shouldFix}), declarations held wide purely by
   * test references are tightened too, instead of being skipped. Decorated members and exports
   * shared with a still-exported sibling stay skipped regardless. Forwarded to
   * {@link analyzeOverExposure}.
   *
   * @default `false`
   */
  readonly shouldForce?: boolean | undefined;
}

/**
 * Options for {@link formatOverExposureFindings}.
 */
export interface FormatOverExposureFindingsOptions {
  /**
   * When set, file paths in the report are rendered relative to this folder (typically the current
   * working directory) instead of as absolute paths. Paths outside the folder stay absolute.
   */
  readonly baseFolder?: string;
}

/**
 * The subset of file-system operations the language-service host needs. Injecting this (rather than
 * always using `typescript`'s `sys`) lets tests drive the analyzer against in-memory sources with no
 * real file-system access.
 */
export interface OverExposureFileSystem {
  /**
   * @param path - Directory path.
   * @returns `true` when the directory exists.
   */
  directoryExists(this: void, path: string): boolean;

  /**
   * @param path - File path.
   * @returns `true` when the file exists.
   */
  fileExists(this: void, path: string): boolean;

  /**
   * @returns The current working directory.
   */
  getCurrentDirectory(this: void): string;

  /**
   * @param path - Directory path.
   * @returns The immediate subdirectory names.
   */
  getDirectories(this: void, path: string): string[];

  /**
   * @param path - Root directory.
   * @param extensions - Extensions to include.
   * @param exclude - Patterns to exclude.
   * @param include - Patterns to include.
   * @param depth - Maximum recursion depth.
   * @returns The matching file paths.
   */
  readDirectory(this: void, path: string, extensions?: readonly string[], exclude?: readonly string[], include?: readonly string[], depth?: number): string[];

  /**
   * @param path - File path.
   * @returns The file contents, or `undefined` when absent.
   */
  readFile(this: void, path: string): string | undefined;
}

/**
 * A single over-exposed declaration.
 */
export interface OverExposureFinding {
  /** 1-based column of the declaration's name. */
  readonly column: number;

  /** The current exposure level. */
  readonly currentExposure: CurrentExposure;

  /** Absolute path of the file declaring the symbol. */
  readonly filePath: string;

  /** `true` when the declaration has no references at all (besides itself). */
  readonly hasNoReferences: boolean;

  /**
   * `true` when the declaration would qualify for a tighter exposure if not for references coming
   * exclusively from test files — i.e. it is exposed purely for testability.
   */
  readonly isForcedByTestOnly: boolean;

  /** `true` for a class member, `false` for a top-level export. */
  readonly isMember: boolean;

  /** 1-based line of the declaration's name. */
  readonly line: number;

  /** The declared name. */
  readonly name: string;

  /**
   * In a fix run, why this finding was left untouched instead of tightened; `null` when it was
   * fixed or when the analysis only reported (`shouldFix` off).
   */
  readonly skipReason: null | OverExposureSkipReason;

  /** The exposure the declaration could be tightened to. */
  readonly suggestedExposure: SuggestedExposure;

  /** `true` when a fix run tightened this declaration in place. Always `false` in a report run. */
  readonly wasFixed: boolean;
}

/**
 * Progress reported while analyzing a project, one event per analyzed source file.
 */
export interface OverExposureProgress {
  /** Number of source files fully analyzed before the current one (0-based). */
  readonly analyzedFileCount: number;

  /** Absolute (canonical) path of the source file about to be analyzed. */
  readonly currentFilePath: string;

  /** Total number of source files that will be analyzed. */
  readonly totalFileCount: number;
}

/**
 * Why a fix run left a finding untouched:
 *
 * - `decorated` — the member carries a decorator, so the modifier insertion point is ambiguous.
 * - `shared-export` — the `export` keyword is shared with a still-exported sibling declarator.
 * - `test-only` — the declaration is exposed purely for tests, so tightening would break the test.
 */
export type OverExposureSkipReason = 'decorated' | 'shared-export' | 'test-only';

/**
 * The (tighter) exposure level a declaration could be reduced to.
 */
export type SuggestedExposure = 'file-local' | 'private' | 'protected';

/**
 * Lifecycle and framework members invoked by Obsidian or a base class via registration rather than
 * by references the language service can see. Tightening these would break the framework contract,
 * so they are never reported.
 */
export const LIFECYCLE_ALLOWLIST: ReadonlySet<string> = new Set<string>([
  'display',
  'hide',
  'onExternalSettingsChange',
  'onLayoutReady',
  'onload',
  'onloadImpl',
  'onLoadSettings',
  'onSaveSettings',
  'onunload',
  'onunloadImpl'
]);

interface AnalysisContext {
  readonly checker: TypeChecker;
  readonly edits: (null | OverExposureTextEdit)[];
  readonly findings: OverExposureFinding[];
  readonly languageService: LanguageService;
  readonly program: Program;
  readonly shouldForce: boolean;
  readonly stringLiteralOccurrencesByText: ReadonlyMap<string, readonly StringLiteralOccurrence[]>;
}

interface AnalysisResult {
  readonly edits: readonly (null | OverExposureTextEdit)[];
  readonly findings: readonly OverExposureFinding[];
}

/**
 * Parameters for {@link applyOverExposureFixes}.
 */
interface ApplyOverExposureFixesParams {
  /** The program whose source files supply the original text the edits are applied to; `undefined` when no program is available. */
  readonly program: Program | undefined;

  /** The analysis result whose findings and edits are turned into in-place fixes. */
  readonly result: AnalysisResult;

  /** When `true`, declarations held wide purely by test references are tightened too instead of being skipped. */
  readonly shouldForce: boolean;

  /** Writes the tightened contents of a changed file back to disk. */
  writeFile(this: void, path: string, content: string): void;
}

/**
 * Parameters for {@link buildFinding}.
 */
interface BuildFindingParams {
  /** The current exposure level of the declaration. */
  readonly currentExposure: CurrentExposure;

  /** Flags describing whether the declaration has no references at all or is forced wide by test-only references. */
  readonly flags: FindingFlags;

  /** The declaration's name node, used to resolve its position and text. */
  readonly nameNode: Node;

  /** The declaration node, used to resolve its source file. */
  readonly node: Node;

  /** The tighter exposure level the declaration could be reduced to. */
  readonly suggestedExposure: SuggestedExposure;
}

type ClassMemberDeclaration = GetAccessorDeclaration | MethodDeclaration | PropertyDeclaration | SetAccessorDeclaration;

/**
 * Parameters for {@link collectStringLiteralReferences}.
 */
interface CollectStringLiteralReferencesParams {
  /** The analysis context providing the string-literal index and type checker. */
  readonly context: AnalysisContext;

  /** The class declaring the member whose name the string literals might reference. */
  readonly declaringClass: ClassLikeDeclaration;

  /** The member's name node, whose text is matched against string-literal occurrences. */
  readonly nameNode: Node;
}

/**
 * Parameters for {@link computeNeededExposure}.
 */
interface ComputeNeededExposureParams {
  /** The analysis context providing the program and type checker. */
  readonly context: AnalysisContext;

  /** The class declaring the member whose needed exposure is computed. */
  readonly declaringClass: ClassLikeDeclaration;

  /** The reference locations that must remain reachable at the computed exposure. */
  readonly references: readonly ReferenceLocation[];
}

/**
 * Parameters for {@link determineSkipReason}.
 */
interface DetermineSkipReasonParams {
  /** The text edit that would tighten the finding, or `null` when no safe edit exists. */
  readonly edit: null | OverExposureTextEdit;

  /** The finding under consideration. */
  readonly finding: OverExposureFinding;

  /** When `true`, test-only findings are tightened rather than skipped. */
  readonly shouldForce: boolean;
}

type ExportableDeclaration = ClassDeclaration | EnumDeclaration | FunctionDeclaration | InterfaceDeclaration | TypeAliasDeclaration | VariableStatement;

interface ExportFindingCandidate {
  readonly finding: OverExposureFinding;
  readonly isPlainFileLocal: boolean;
}

interface FindingFlags {
  readonly hasNoReferences: boolean;
  readonly isForcedByTestOnly: boolean;
}

/**
 * Parameters for {@link getClassAtPosition}.
 */
interface GetClassAtPositionParams {
  /** Absolute path of the file containing the position. */
  readonly fileName: string;

  /** 0-based character offset of the reference within the file. */
  readonly position: number;

  /** The program used to resolve the source file. */
  readonly program: Program;
}

/**
 * Parameters for {@link isDerivedFrom}.
 */
interface IsDerivedFromParams {
  /** The candidate base class. */
  readonly base: ClassLikeDeclaration;

  /** The type checker used to resolve heritage symbols. */
  readonly checker: TypeChecker;

  /** The candidate derived class. */
  readonly derived: ClassLikeDeclaration;
}

/**
 * Parameters for {@link isKeyReferenceToClass}.
 */
interface IsKeyReferenceToClassParams {
  /** The type checker used to resolve the literal's contextual type. */
  readonly checker: TypeChecker;

  /** The set of property keys declared by the class. */
  readonly keySet: ReadonlySet<string>;

  /** The string-literal node being tested. */
  readonly node: StringLiteralLike;
}

/**
 * Parameters for {@link isOwnSourceFile}.
 */
interface IsOwnSourceFileParams {
  /** Absolute (canonical) path of the file under test. */
  readonly filePath: string;

  /** Absolute (canonical) path of the project's `src` folder. */
  readonly srcFolder: string;
}

type MemberExposure = 'private' | 'protected' | 'public';

/**
 * A single in-place text replacement that tightens a declaration's exposure. A zero-length edit is
 * an insertion (e.g. adding an explicit `private` modifier to an implicitly-`public` member).
 */
interface OverExposureTextEdit {
  readonly fileName: string;
  readonly length: number;
  readonly newText: string;
  readonly start: number;
}

/**
 * Parameters for {@link record}.
 */
interface RecordParams {
  /** The analysis context whose findings and edits are appended to. */
  readonly context: AnalysisContext;

  /** The text edit that would tighten the finding, or `null` when no safe edit exists. */
  readonly edit: null | OverExposureTextEdit;

  /** The finding to record. */
  readonly finding: OverExposureFinding;
}

interface ReferenceLocation {
  readonly fileName: string;
  readonly start: number;
}

interface SourceFileText {
  readonly fileName: string;
  readonly text: string;
}

interface StringLiteralOccurrence {
  readonly node: StringLiteralLike;
  readonly sourceFile: SourceFile;
}

/**
 * Parameters for {@link toDisplayPath}.
 */
interface ToDisplayPathParams {
  /** When set, the path is rendered relative to this folder; paths outside it stay absolute. */
  readonly baseFolder: string | undefined;

  /** Absolute (canonical) path to render. */
  readonly filePath: string;
}

// A JSDoc/TSDoc comment opens with `/**`: the character at offset 2 is the second `*`, and to exclude the empty `/**/` comment the character at offset 3 must not be the closing `/`.
const JSDOC_SECOND_ASTERISK_OFFSET = 2;
const JSDOC_FOURTH_CHARACTER_OFFSET = 3;
const MEMBER_EXPOSURE_ORDER: readonly MemberExposure[] = ['private', 'protected', 'public'];
const SCOPE_DESCRIPTION: Record<SuggestedExposure, string> = {
  'file-local': 'within its own file',
  'private': 'inside its own class',
  'protected': 'inside its class + subclasses'
};
const SKIP_REASON_DESCRIPTION: Record<OverExposureSkipReason, string> = {
  'decorated': 'decorated member',
  'shared-export': 'export shared with a still-exported sibling',
  'test-only': 'exposed only for tests'
};
const VISIBILITY_MODIFIER_KINDS: ReadonlySet<SyntaxKind> = new Set<SyntaxKind>([SyntaxKind.PrivateKeyword, SyntaxKind.ProtectedKeyword, SyntaxKind.PublicKeyword]);
const WHITESPACE_PATTERN = /\s/;

/**
 * Analyzes a project (already loaded into a language service) for over-exposed declarations, and —
 * when {@link AnalyzeOverExposureParams.shouldFix} is set — tightens every fixable finding in place
 * via {@link AnalyzeOverExposureParams.writeFile}. Findings that cannot be safely automated (exposed
 * only for tests, decorated, or sharing an `export` keyword with a still-exported sibling) carry a
 * {@link OverExposureFinding.skipReason} and are left untouched — unless
 * {@link AnalyzeOverExposureParams.shouldForce} is set, which additionally tightens the test-only
 * findings (decorated and shared-export ones still stay skipped).
 *
 * @param params - The {@link AnalyzeOverExposureParams}.
 * @returns The over-exposed declarations, in discovery order.
 */
export function analyzeOverExposure(params: AnalyzeOverExposureParams): OverExposureFinding[] {
  const result = runOverExposureAnalysis(params);
  if (!params.shouldFix) {
    return [...result.findings];
  }

  const { writeFile } = params;
  assertNonNullable(writeFile, 'writeFile is required when shouldFix is true.');
  return applyOverExposureFixes({
    program: params.languageService.getProgram(),
    result,
    shouldForce: params.shouldForce ?? false,
    writeFile
  });
}

/**
 * Builds a {@link LanguageServiceHost} backed by an explicit file list and file system.
 *
 * @param params - The {@link CreateLanguageServiceHostParams}.
 * @returns The language-service host.
 */
export function createLanguageServiceHost(params: CreateLanguageServiceHostParams): LanguageServiceHost {
  const { compilerOptions, fileNames, fileSystem } = params;
  return {
    directoryExists: (directory) => fileSystem.directoryExists(directory),
    fileExists: (file) => fileSystem.fileExists(file),
    getCompilationSettings: () => compilerOptions,
    getCurrentDirectory: () => fileSystem.getCurrentDirectory(),
    getDefaultLibFileName: (libOptions) => getDefaultLibFilePath(libOptions),
    getDirectories: (directory) => fileSystem.getDirectories(directory),
    getScriptFileNames: () => [...fileNames],
    getScriptSnapshot: (fileName): IScriptSnapshot | undefined => {
      const text = fileSystem.readFile(fileName);
      return text === undefined ? undefined : ScriptSnapshot.fromString(text);
    },
    getScriptVersion: () => '0',
    readDirectory: (path, extensions, exclude, include, depth) => fileSystem.readDirectory(path, extensions, exclude, include, depth),
    readFile: (file) => fileSystem.readFile(file)
  };
}

/**
 * Builds a language service over every file in a project's `tsconfig.json`.
 *
 * @param params - The {@link CreateProjectLanguageServiceParams}.
 * @returns A language service ready for {@link analyzeOverExposure}.
 */
export function createProjectLanguageService(params: CreateProjectLanguageServiceParams): LanguageService {
  const { fileNames, options } = parseTsConfig(params.tsConfigPath);
  return createLanguageService(createLanguageServiceHost({ compilerOptions: options, fileNames, fileSystem: sys }), createDocumentRegistry());
}

/**
 * Finds over-exposed declarations in a project on disk. When
 * {@link FindOverExposureParams.shouldFix} is set, each fixable finding is also tightened in place
 * (rewriting the affected source files via `typescript`'s `sys.writeFile`).
 *
 * @param params - The {@link FindOverExposureParams}.
 * @returns The over-exposed declarations.
 */
export function findOverExposure(params: FindOverExposureParams): OverExposureFinding[] {
  const projectFolder = toCanonical(params.projectFolder);
  const languageService = createProjectLanguageService({ tsConfigPath: `${projectFolder}/tsconfig.json` });
  return analyzeOverExposure({
    languageService,
    shouldFix: params.shouldFix,
    shouldForce: params.shouldForce,
    srcFolder: `${projectFolder}/src`,
    writeFile: (path, content) => {
      sys.writeFile(path, content);
    },
    ...params.onProgress ? { onProgress: params.onProgress } : {}
  });
}

/**
 * Formats over-exposure findings as a human-readable report, using the grouped layout of ESLint's
 * `stylish` formatter. Findings are grouped by file and sorted by line: each file is rendered as a
 * `path` header line, followed by one indented `  line:column  change -- reason` row per finding (the
 * `line:column` is right-padded so the rows align within a file). Terminals such as VS Code render
 * each indented `line:column` as a clickable link — resolved against the file header above it — that
 * jumps straight to the declaration. File groups are separated by a blank line. In a fix run (findings
 * carrying {@link OverExposureFinding.wasFixed} / {@link OverExposureFinding.skipReason}) each change
 * row is suffixed with `[fixed]` or `[skipped: …]`, and the trailing summary appends the fixed/skipped
 * counts.
 *
 * @param findings - The findings to format.
 * @param options - The {@link FormatOverExposureFindingsOptions}.
 * @returns The report text. Empty-finding input yields a single "no findings" line.
 */
export function formatOverExposureFindings(findings: readonly OverExposureFinding[], options?: FormatOverExposureFindingsOptions): string {
  if (findings.length === 0) {
    return 'No over-exposed declarations found.\n';
  }

  const baseFolder = options?.baseFolder === undefined ? undefined : toCanonical(options.baseFolder);
  const lines = formatFindingBlocks(findings, baseFolder);
  lines.push(formatSummary(findings));
  return `${lines.join('\n')}\n`;
}

function analyzeExport(node: Node, context: AnalysisContext): void {
  const sourceFile = node.getSourceFile();
  if (node.parent !== sourceFile || !getModifierKinds(node).has(SyntaxKind.ExportKeyword)) {
    return;
  }

  const declaration = asExportableDeclaration(node);
  if (!declaration) {
    return;
  }

  if (hasTsDocComment(declaration)) {
    return;
  }

  const declFilePath = toCanonical(sourceFile.fileName);
  const nameNodes = getExportedNameNodes(declaration);
  const candidates: ExportFindingCandidate[] = [];
  for (const nameNode of nameNodes) {
    const references = collectReferences(context.languageService.findReferences(sourceFile.fileName, nameNode.getStart()))
      .filter((reference) => !isDeclarationItself(reference, nameNode));
    const otherFileReferences = references.filter((reference) => toCanonical(reference.fileName) !== declFilePath);

    if (otherFileReferences.length === 0) {
      candidates.push({
        finding: buildFinding({
          currentExposure: 'export',
          flags: { hasNoReferences: references.length === 0, isForcedByTestOnly: false },
          nameNode,
          node: declaration,
          suggestedExposure: 'file-local'
        }),
        isPlainFileLocal: true
      });
      continue;
    }

    const nonTestReferences = otherFileReferences.filter((reference) => !isTestFile(toCanonical(reference.fileName)));
    if (nonTestReferences.length === 0) {
      candidates.push({
        finding: buildFinding({
          currentExposure: 'export',
          flags: { hasNoReferences: false, isForcedByTestOnly: true },
          nameNode,
          node: declaration,
          suggestedExposure: 'file-local'
        }),
        isPlainFileLocal: false
      });
    }
  }

  if (candidates.length === 0) {
    return;
  }

  const canDropExport = candidates.length === nameNodes.length && candidates.every((candidate) => candidate.isPlainFileLocal || context.shouldForce);
  const exportEdit = canDropExport ? computeExportRemovalEdit(declaration) : null;
  for (const candidate of candidates) {
    record({
      context,
      edit: exportEdit,
      finding: candidate.finding
    });
  }
}

function analyzeMember(node: Node, context: AnalysisContext): void {
  const member = asClassMember(node);
  if (!member || !isClassLike(node.parent)) {
    return;
  }
  const nameNode = member.name;
  const declaringClass = node.parent;

  if (isPrivateIdentifier(nameNode)) {
    return;
  }

  const modifierKinds = getModifierKinds(member);
  if (modifierKinds.has(SyntaxKind.StaticKeyword) || modifierKinds.has(SyntaxKind.OverrideKeyword) || LIFECYCLE_ALLOWLIST.has(nameNode.getText())) {
    return;
  }

  if (hasTsDocComment(member)) {
    return;
  }

  const currentExposure = getCurrentMemberExposure(modifierKinds);
  if (currentExposure === 'private') {
    return;
  }

  const sourceFile = member.getSourceFile();
  const directReferences = collectReferences(context.languageService.findReferences(sourceFile.fileName, nameNode.getStart()))
    .filter((reference) => !isDeclarationItself(reference, nameNode));
  const references = [...directReferences, ...collectStringLiteralReferences({ context, declaringClass, nameNode })];
  const nonTestReferences = references.filter((reference) => !isTestFile(toCanonical(reference.fileName)));

  const neededForSrc = computeNeededExposure({ context, declaringClass, references: nonTestReferences });
  const neededWithTests = computeNeededExposure({ context, declaringClass, references });

  if (neededForSrc === 'public') {
    return;
  }

  if (rankExposure(neededForSrc) >= rankExposure(currentExposure)) {
    return;
  }

  const finding = buildFinding({
    currentExposure,
    flags: {
      hasNoReferences: references.length === 0,
      isForcedByTestOnly: rankExposure(neededWithTests) > rankExposure(neededForSrc)
    },
    nameNode,
    node: member,
    suggestedExposure: neededForSrc
  });
  record({
    context,
    edit: computeMemberExposureEdit(member, neededForSrc),
    finding
  });
}

function applyEdits(text: string, edits: readonly OverExposureTextEdit[]): string {
  const seen = new Set<string>();
  const uniqueEdits = edits
    .filter((edit) => {
      const key = `${String(edit.start)}:${String(edit.length)}:${edit.newText}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.start - a.start);

  let result = text;
  for (const edit of uniqueEdits) {
    result = `${result.slice(0, edit.start)}${edit.newText}${result.slice(edit.start + edit.length)}`;
  }
  return result;
}

function applyOverExposureFixes(params: ApplyOverExposureFixesParams): OverExposureFinding[] {
  const { program, result, shouldForce, writeFile } = params;
  const editsByFile = new Map<string, OverExposureTextEdit[]>();
  const findings = result.findings.map((finding, index) => {
    const edit = result.edits[index] ?? null;
    const skipReason = determineSkipReason({ edit, finding, shouldForce });
    if (skipReason !== null) {
      return { ...finding, skipReason, wasFixed: false };
    }
    assertNonNullable(edit, 'A fixable finding must carry a text edit.');
    const fileEdits = editsByFile.get(edit.fileName) ?? [];
    fileEdits.push(edit);
    editsByFile.set(edit.fileName, fileEdits);
    return { ...finding, skipReason: null, wasFixed: true };
  });

  if (editsByFile.size > 0) {
    assertNonNullable(program, 'A program is expected when there are edits to apply.');
    const sourceTextByFile = new Map<string, SourceFileText>();
    for (const sourceFile of program.getSourceFiles()) {
      sourceTextByFile.set(toCanonical(sourceFile.fileName), { fileName: sourceFile.fileName, text: sourceFile.text });
    }
    for (const [canonicalFileName, fileEdits] of editsByFile) {
      const source = sourceTextByFile.get(canonicalFileName);
      assertNonNullable(source, `Source file not found in program: ${canonicalFileName}`);
      writeFile(source.fileName, applyEdits(source.text, fileEdits));
    }
  }

  return findings;
}

function asClassMember(node: Node): ClassMemberDeclaration | undefined {
  if (isMethodDeclaration(node) || isPropertyDeclaration(node) || isGetAccessorDeclaration(node) || isSetAccessorDeclaration(node)) {
    return node;
  }
  return undefined;
}

function asExportableDeclaration(node: Node): ExportableDeclaration | undefined {
  if (
    isFunctionDeclaration(node)
    || isClassDeclaration(node)
    || isInterfaceDeclaration(node)
    || isTypeAliasDeclaration(node)
    || isEnumDeclaration(node)
    || isVariableStatement(node)
  ) {
    return node;
  }
  return undefined;
}

function buildFinding(params: BuildFindingParams): OverExposureFinding {
  const { currentExposure, flags, nameNode, node, suggestedExposure } = params;
  const sourceFile = node.getSourceFile();
  const { character, line } = sourceFile.getLineAndCharacterOfPosition(nameNode.getStart());
  return {
    column: character + 1,
    currentExposure,
    filePath: toCanonical(sourceFile.fileName),
    hasNoReferences: flags.hasNoReferences,
    isForcedByTestOnly: flags.isForcedByTestOnly,
    isMember: currentExposure !== 'export',
    line: line + 1,
    name: nameNode.getText(),
    skipReason: null,
    suggestedExposure,
    wasFixed: false
  };
}

function buildStringLiteralIndex(program: Program): ReadonlyMap<string, readonly StringLiteralOccurrence[]> {
  const index = new Map<string, StringLiteralOccurrence[]>();
  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile) {
      continue;
    }
    collectInNode(sourceFile);
  }
  return index;

  function collectInNode(node: Node): void {
    if (isStringLiteralLike(node)) {
      const occurrences = index.get(node.text) ?? [];
      occurrences.push({ node, sourceFile: node.getSourceFile() });
      index.set(node.text, occurrences);
    }
    node.forEachChild(collectInNode);
  }
}

function collectReferences(referencedSymbols: ReferencedSymbol[] | undefined): ReferenceLocation[] {
  const references: ReferenceLocation[] = [];
  for (const referencedSymbol of referencedSymbols ?? []) {
    for (const reference of referencedSymbol.references) {
      references.push({ fileName: reference.fileName, start: reference.textSpan.start });
    }
  }
  return references;
}

function collectStringLiteralReferences(params: CollectStringLiteralReferencesParams): ReferenceLocation[] {
  const { context, declaringClass, nameNode } = params;
  const occurrences = context.stringLiteralOccurrencesByText.get(nameNode.getText());
  if (!occurrences || occurrences.length === 0) {
    return [];
  }

  const keySet = getClassKeySet(declaringClass, context.checker);
  const references: ReferenceLocation[] = [];
  for (const occurrence of occurrences) {
    if (isKeyReferenceToClass({ checker: context.checker, keySet, node: occurrence.node })) {
      references.push({ fileName: occurrence.sourceFile.fileName, start: occurrence.node.getStart() });
    }
  }
  return references;
}

function computeExportRemovalEdit(declaration: ExportableDeclaration): OverExposureTextEdit {
  const sourceFile = declaration.getSourceFile();
  const modifiers = getModifiers(declaration);
  assertNonNullable(modifiers, 'Modifiers expected on an exported declaration.');
  const exportModifier = modifiers.find((modifier) => modifier.kind === SyntaxKind.ExportKeyword);
  assertNonNullable(exportModifier, 'Export modifier expected on an exported declaration.');
  const { text } = sourceFile;
  let end = exportModifier.getEnd();
  while (end < text.length && WHITESPACE_PATTERN.test(text.charAt(end))) {
    end++;
  }
  return {
    fileName: toCanonical(sourceFile.fileName),
    length: end - exportModifier.getStart(),
    newText: '',
    start: exportModifier.getStart()
  };
}

function computeMemberExposureEdit(member: ClassMemberDeclaration, suggestedExposure: 'private' | 'protected'): null | OverExposureTextEdit {
  if ((getDecorators(member) ?? []).length > 0) {
    return null;
  }

  const sourceFile = member.getSourceFile();
  const fileName = toCanonical(sourceFile.fileName);
  const modifiers = getModifiers(member) ?? [];
  const visibilityModifier = modifiers.find((modifier) => VISIBILITY_MODIFIER_KINDS.has(modifier.kind));
  if (visibilityModifier) {
    return {
      fileName,
      length: visibilityModifier.getEnd() - visibilityModifier.getStart(),
      newText: suggestedExposure,
      start: visibilityModifier.getStart()
    };
  }

  const firstModifier = modifiers[0];
  const insertStart = firstModifier ? firstModifier.getStart() : member.getStart();
  return {
    fileName,
    length: 0,
    newText: `${suggestedExposure} `,
    start: insertStart
  };
}

function computeNeededExposure(params: ComputeNeededExposureParams): MemberExposure {
  const { context, declaringClass, references } = params;
  if (references.length === 0) {
    return 'private';
  }

  let needed: MemberExposure = 'private';
  for (const reference of references) {
    const referenceClass = getClassAtPosition({ fileName: reference.fileName, position: reference.start, program: context.program });
    if (referenceClass === declaringClass) {
      continue;
    }
    if (referenceClass && isDerivedFrom({ base: declaringClass, checker: context.checker, derived: referenceClass })) {
      needed = 'protected';
      continue;
    }
    return 'public';
  }
  return needed;
}

function describeFixStatus(finding: OverExposureFinding): string {
  if (finding.wasFixed) {
    return ' [fixed]';
  }
  if (finding.skipReason !== null) {
    return ` [skipped: ${SKIP_REASON_DESCRIPTION[finding.skipReason]}]`;
  }
  return '';
}

function describeReason(finding: OverExposureFinding): string {
  const base = `referenced only ${SCOPE_DESCRIPTION[finding.suggestedExposure]}`;
  if (finding.isForcedByTestOnly) {
    return `${base} (exposed only for tests)`;
  }
  if (finding.hasNoReferences) {
    return `${base} (no references at all)`;
  }
  return base;
}

function determineSkipReason(params: DetermineSkipReasonParams): null | OverExposureSkipReason {
  const { edit, finding, shouldForce } = params;
  if (finding.isForcedByTestOnly && !shouldForce) {
    return 'test-only';
  }
  if (!edit) {
    return finding.isMember ? 'decorated' : 'shared-export';
  }
  return null;
}

function findNodeAtPosition(node: Node, position: number): Node | undefined {
  if (position < node.getStart() || position >= node.getEnd()) {
    return undefined;
  }
  let result: Node = node;
  node.forEachChild((child) => {
    const found = findNodeAtPosition(child, position);
    if (found) {
      result = found;
    }
  });
  return result;
}

function formatFindingBlocks(findings: readonly OverExposureFinding[], baseFolder: string | undefined): string[] {
  const byFile = new Map<string, OverExposureFinding[]>();
  for (const finding of findings) {
    const list = byFile.get(finding.filePath) ?? [];
    list.push(finding);
    byFile.set(finding.filePath, list);
  }

  const lines: string[] = [];
  for (const [filePath, list] of byFile) {
    const sorted = [...list].sort((a, b) => a.line - b.line);
    const locationWidth = Math.max(...sorted.map((finding) => `${String(finding.line)}:${String(finding.column)}`.length));
    lines.push(toDisplayPath({ baseFolder, filePath }));
    for (const finding of sorted) {
      const location = `${String(finding.line)}:${String(finding.column)}`.padEnd(locationWidth);
      const change = `${finding.currentExposure} ${finding.name} -> ${finding.suggestedExposure}`;
      lines.push(`  ${location}  ${change} -- ${describeReason(finding)}${describeFixStatus(finding)}`);
    }
    lines.push('');
  }
  return lines;
}

function formatSummary(findings: readonly OverExposureFinding[]): string {
  const summary = `${String(findings.length)} finding(s).`;
  const fixedCount = findings.filter((finding) => finding.wasFixed).length;
  const skippedCount = findings.filter((finding) => finding.skipReason !== null).length;
  if (fixedCount === 0 && skippedCount === 0) {
    return summary;
  }
  return `${summary} ${String(fixedCount)} fixed, ${String(skippedCount)} skipped.`;
}

function getClassAtPosition(params: GetClassAtPositionParams): ClassLikeDeclaration | undefined {
  const { fileName, position, program } = params;
  const sourceFile = program.getSourceFile(fileName);
  assertNonNullable(sourceFile, `Source file not found in program: ${fileName}`);
  const node = findNodeAtPosition(sourceFile, position);
  assertNonNullable(node, `No node found at position ${String(position)} in ${fileName}`);
  return getEnclosingClass(node);
}

function getClassKeySet(declaringClass: ClassLikeDeclaration, checker: TypeChecker): ReadonlySet<string> {
  const classSymbol = declaringClass.name ? checker.getSymbolAtLocation(declaringClass.name) : undefined;
  const classType = classSymbol ? checker.getDeclaredTypeOfSymbol(classSymbol) : checker.getTypeAtLocation(declaringClass);
  return new Set(classType.getProperties().map((property) => property.name));
}

function getCurrentMemberExposure(modifierKinds: ReadonlySet<SyntaxKind>): MemberExposure {
  if (modifierKinds.has(SyntaxKind.PrivateKeyword)) {
    return 'private';
  }
  if (modifierKinds.has(SyntaxKind.ProtectedKeyword)) {
    return 'protected';
  }
  return 'public';
}

function getEnclosingClass(node: Node): ClassLikeDeclaration | undefined {
  let current: Node = node;
  while (!isSourceFile(current)) {
    if (isClassLike(current)) {
      return current;
    }
    current = current.parent;
  }
  return undefined;
}

function getExportedNameNodes(declaration: ExportableDeclaration): Node[] {
  if (isVariableStatement(declaration)) {
    return declaration.declarationList.declarations.map((variableDeclaration) => variableDeclaration.name).filter(isIdentifier);
  }
  return declaration.name ? [declaration.name] : [];
}

function getModifierKinds(node: Node): ReadonlySet<SyntaxKind> {
  const kinds = new Set<SyntaxKind>();
  if (canHaveModifiers(node)) {
    for (const modifier of getModifiers(node) ?? []) {
      kinds.add(modifier.kind);
    }
  }
  return kinds;
}

function getStringLiteralConstituents(type: Type): null | string[] {
  if (type.isStringLiteral()) {
    return [type.value];
  }
  if (type.isUnion()) {
    const literals: string[] = [];
    for (const constituent of type.types) {
      if (!constituent.isStringLiteral()) {
        return null;
      }
      literals.push(constituent.value);
    }
    return literals;
  }
  return null;
}

function hasTsDocComment(node: Node): boolean {
  const sourceFile = node.getSourceFile();
  const fullText = sourceFile.getFullText();
  const commentRanges = getLeadingCommentRanges(fullText, node.getFullStart()) ?? [];
  return commentRanges.some((range) =>
    range.kind === SyntaxKind.MultiLineCommentTrivia
    && fullText.charAt(range.pos + JSDOC_SECOND_ASTERISK_OFFSET) === '*'
    && fullText.charAt(range.pos + JSDOC_FOURTH_CHARACTER_OFFSET) !== '/'
  );
}

function isDeclarationItself(reference: ReferenceLocation, nameNode: Node): boolean {
  return toCanonical(reference.fileName) === toCanonical(nameNode.getSourceFile().fileName) && reference.start === nameNode.getStart();
}

function isDerivedFrom(params: IsDerivedFromParams): boolean {
  const { base, checker, derived } = params;
  const baseSymbol = base.name ? checker.getSymbolAtLocation(base.name) : undefined;
  if (!baseSymbol) {
    return false;
  }

  for (const clause of derived.heritageClauses ?? []) {
    if (clause.token !== SyntaxKind.ExtendsKeyword) {
      continue;
    }
    for (const typeExpression of clause.types) {
      const symbol = checker.getTypeAtLocation(typeExpression.expression).getSymbol();
      if (symbol === baseSymbol) {
        return true;
      }
      for (const declaration of symbol?.declarations ?? []) {
        if (isClassLike(declaration) && isDerivedFrom({ base, checker, derived: declaration })) {
          return true;
        }
      }
    }
  }
  return false;
}

function isKeyReferenceToClass(params: IsKeyReferenceToClassParams): boolean {
  const { checker, keySet, node } = params;
  const contextualType = checker.getContextualType(node);
  if (!contextualType) {
    return false;
  }
  const literals = getStringLiteralConstituents(contextualType);
  if (!literals) {
    return false;
  }
  return literals.every((literal) => keySet.has(literal));
}

function isOwnSourceFile(params: IsOwnSourceFileParams): boolean {
  const { filePath, srcFolder } = params;
  return filePath.startsWith(`${srcFolder}/`) && filePath.endsWith('.ts') && !filePath.endsWith('.d.ts');
}

function isTestFile(filePath: string): boolean {
  return filePath.includes('.test.') || filePath.includes('.integration.');
}

function rankExposure(exposure: MemberExposure): number {
  return MEMBER_EXPOSURE_ORDER.indexOf(exposure);
}

function record(params: RecordParams): void {
  const { context, edit, finding } = params;
  context.findings.push(finding);
  context.edits.push(edit);
}

function runOverExposureAnalysis(params: AnalyzeOverExposureParams): AnalysisResult {
  const { languageService, onProgress, srcFolder } = params;
  const program = languageService.getProgram();
  if (!program) {
    return { edits: [], findings: [] };
  }

  const context: AnalysisContext = {
    checker: program.getTypeChecker(),
    edits: [],
    findings: [],
    languageService,
    program,
    shouldForce: params.shouldForce ?? false,
    stringLiteralOccurrencesByText: buildStringLiteralIndex(program)
  };

  const sourceFilesToAnalyze = program.getSourceFiles().filter((sourceFile) => {
    const filePath = toCanonical(sourceFile.fileName);
    return isOwnSourceFile({ filePath, srcFolder }) && !isTestFile(filePath);
  });

  for (const [analyzedFileCount, sourceFile] of sourceFilesToAnalyze.entries()) {
    onProgress?.({
      analyzedFileCount,
      currentFilePath: toCanonical(sourceFile.fileName),
      totalFileCount: sourceFilesToAnalyze.length
    });
    visit(sourceFile);
  }
  return { edits: context.edits, findings: context.findings };

  function visit(node: Node): void {
    analyzeMember(node, context);
    analyzeExport(node, context);
    node.forEachChild(visit);
  }
}

function toDisplayPath(params: ToDisplayPathParams): string {
  const { baseFolder, filePath } = params;
  if (baseFolder !== undefined && filePath.startsWith(`${baseFolder}/`)) {
    return filePath.slice(baseFolder.length + 1);
  }
  return filePath;
}
