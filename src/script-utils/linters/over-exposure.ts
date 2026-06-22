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
 * exposure that still covers all references. Members invoked by the framework via registration
 * rather than by visible references (Obsidian lifecycle hooks, settings-tab `display`, etc.) are
 * excluded via {@link LIFECYCLE_ALLOWLIST}, as are `override` and `static` members whose exposure is
 * constrained by a base declaration.
 *
 * A member referenced only from test files is reported with {@link OverExposureFinding.isForcedByTestOnly}
 * set, surfacing members widened purely for testability — the canonical case for extracting logic
 * into an independently testable component instead.
 */

import type {
  ClassLikeDeclaration,
  CompilerOptions,
  IScriptSnapshot,
  LanguageService,
  LanguageServiceHost,
  Node,
  Program,
  ReferencedSymbol,
  TypeChecker
} from 'typescript';

import {
  canHaveModifiers,
  createDocumentRegistry,
  createLanguageService,
  getDefaultLibFilePath,
  getModifiers,
  isClassDeclaration,
  isClassLike,
  isEnumDeclaration,
  isFunctionDeclaration,
  isGetAccessorDeclaration,
  isIdentifier,
  isInterfaceDeclaration,
  isMethodDeclaration,
  isPropertyDeclaration,
  isSetAccessorDeclaration,
  isSourceFile,
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
   * Absolute (canonical) path of the project's `src` folder. Only declarations in non-test files
   * under this folder are analyzed; declarations elsewhere (test files, dependencies) are ignored
   * but still counted as reference sites.
   */
  readonly srcFolder: string;
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
  /** Absolute path to the project root (the folder containing `tsconfig.json` and `src`). */
  readonly projectFolder: string;
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

  /** The exposure the declaration could be tightened to. */
  readonly suggestedExposure: SuggestedExposure;
}

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
  readonly findings: OverExposureFinding[];
  readonly languageService: LanguageService;
  readonly program: Program;
}

interface FindingFlags {
  readonly hasNoReferences: boolean;
  readonly isForcedByTestOnly: boolean;
}

type MemberExposure = 'private' | 'protected' | 'public';

interface ReferenceLocation {
  readonly fileName: string;
  readonly start: number;
}

const CHANGE_COLUMN_WIDTH = 48;
const LINE_LABEL_WIDTH = 4;
const MEMBER_EXPOSURE_ORDER: readonly MemberExposure[] = ['private', 'protected', 'public'];
const SCOPE_DESCRIPTION: Record<SuggestedExposure, string> = {
  'file-local': 'within its own file',
  'private': 'inside its own class',
  'protected': 'inside its class + subclasses'
};

/**
 * Analyzes a project (already loaded into a language service) for over-exposed declarations.
 *
 * @param params - The {@link AnalyzeOverExposureParams}.
 * @returns The over-exposed declarations, in discovery order.
 */
export function analyzeOverExposure(params: AnalyzeOverExposureParams): OverExposureFinding[] {
  const { languageService, srcFolder } = params;
  const program = languageService.getProgram();
  if (!program) {
    return [];
  }

  const context: AnalysisContext = {
    checker: program.getTypeChecker(),
    findings: [],
    languageService,
    program
  };

  for (const sourceFile of program.getSourceFiles()) {
    const filePath = toCanonical(sourceFile.fileName);
    if (!isOwnSourceFile(filePath, srcFolder) || isTestFile(filePath)) {
      continue;
    }
    visit(sourceFile);
  }
  return context.findings;

  function visit(node: Node): void {
    analyzeMember(node, context);
    analyzeExport(node, context);
    node.forEachChild(visit);
  }
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
 * Finds over-exposed declarations in a project on disk.
 *
 * @param params - The {@link FindOverExposureParams}.
 * @returns The over-exposed declarations.
 */
export function findOverExposure(params: FindOverExposureParams): OverExposureFinding[] {
  const projectFolder = toCanonical(params.projectFolder);
  const languageService = createProjectLanguageService({ tsConfigPath: `${projectFolder}/tsconfig.json` });
  return analyzeOverExposure({ languageService, srcFolder: `${projectFolder}/src` });
}

/**
 * Formats over-exposure findings as a human-readable report, grouped by file.
 *
 * @param findings - The findings to format.
 * @returns The report text. Empty-finding input yields a single "no findings" line.
 */
export function formatOverExposureFindings(findings: readonly OverExposureFinding[]): string {
  if (findings.length === 0) {
    return 'No over-exposed declarations found.\n';
  }

  const byFile = new Map<string, OverExposureFinding[]>();
  for (const finding of findings) {
    const list = byFile.get(finding.filePath) ?? [];
    list.push(finding);
    byFile.set(finding.filePath, list);
  }

  const lines: string[] = [];
  for (const [filePath, list] of byFile) {
    lines.push(filePath);
    for (const finding of [...list].sort((a, b) => a.line - b.line)) {
      const change = `${finding.currentExposure} ${finding.name} -> ${finding.suggestedExposure}`;
      lines.push(`  L${String(finding.line).padEnd(LINE_LABEL_WIDTH)} ${change.padEnd(CHANGE_COLUMN_WIDTH)} ${describeReason(finding)}`);
    }
  }
  lines.push('', `${String(findings.length)} finding(s).`);
  return `${lines.join('\n')}\n`;
}

function analyzeExport(node: Node, context: AnalysisContext): void {
  const sourceFile = node.getSourceFile();
  if (node.parent !== sourceFile || !getModifierKinds(node).has(SyntaxKind.ExportKeyword)) {
    return;
  }

  const declFilePath = toCanonical(sourceFile.fileName);
  for (const nameNode of getExportedNameNodes(node)) {
    const references = collectReferences(context.languageService.findReferences(sourceFile.fileName, nameNode.getStart()))
      .filter((reference) => !isDeclarationItself(reference, nameNode));
    const otherFileReferences = references.filter((reference) => toCanonical(reference.fileName) !== declFilePath);

    if (otherFileReferences.length === 0) {
      context.findings.push(buildFinding(node, nameNode, 'export', 'file-local', { hasNoReferences: references.length === 0, isForcedByTestOnly: false }));
      continue;
    }

    const nonTestReferences = otherFileReferences.filter((reference) => !isTestFile(toCanonical(reference.fileName)));
    if (nonTestReferences.length === 0) {
      context.findings.push(buildFinding(node, nameNode, 'export', 'file-local', { hasNoReferences: false, isForcedByTestOnly: true }));
    }
  }
}

function analyzeMember(node: Node, context: AnalysisContext): void {
  const nameNode = getMemberNameNode(node);
  if (!nameNode) {
    return;
  }
  const declaringClass = getEnclosingClass(node);
  if (!declaringClass) {
    return;
  }

  const modifierKinds = getModifierKinds(node);
  if (modifierKinds.has(SyntaxKind.StaticKeyword) || modifierKinds.has(SyntaxKind.OverrideKeyword) || LIFECYCLE_ALLOWLIST.has(nameNode.getText())) {
    return;
  }

  const currentExposure = getCurrentMemberExposure(modifierKinds);
  if (currentExposure === 'private') {
    return;
  }

  const sourceFile = node.getSourceFile();
  const references = collectReferences(context.languageService.findReferences(sourceFile.fileName, nameNode.getStart()))
    .filter((reference) => !isDeclarationItself(reference, nameNode));
  const nonTestReferences = references.filter((reference) => !isTestFile(toCanonical(reference.fileName)));

  const neededForSrc = computeNeededExposure(nonTestReferences, declaringClass, context);
  const neededWithTests = computeNeededExposure(references, declaringClass, context);

  if (neededForSrc === 'public') {
    return;
  }

  if (rankExposure(neededForSrc) >= rankExposure(currentExposure)) {
    return;
  }

  context.findings.push(buildFinding(node, nameNode, currentExposure, neededForSrc, {
    hasNoReferences: references.length === 0,
    isForcedByTestOnly: rankExposure(neededWithTests) > rankExposure(neededForSrc)
  }));
}

function buildFinding(
  node: Node,
  nameNode: Node,
  currentExposure: CurrentExposure,
  suggestedExposure: SuggestedExposure,
  flags: FindingFlags
): OverExposureFinding {
  const sourceFile = node.getSourceFile();
  const { line } = sourceFile.getLineAndCharacterOfPosition(nameNode.getStart());
  return {
    currentExposure,
    filePath: toCanonical(sourceFile.fileName),
    hasNoReferences: flags.hasNoReferences,
    isForcedByTestOnly: flags.isForcedByTestOnly,
    isMember: currentExposure !== 'export',
    line: line + 1,
    name: nameNode.getText(),
    suggestedExposure
  };
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

function computeNeededExposure(
  references: readonly ReferenceLocation[],
  declaringClass: ClassLikeDeclaration,
  context: AnalysisContext
): MemberExposure {
  if (references.length === 0) {
    return 'private';
  }

  let needed: MemberExposure = 'private';
  for (const reference of references) {
    const referenceClass = getClassAtPosition(context.program, reference.fileName, reference.start);
    if (referenceClass === declaringClass) {
      continue;
    }
    if (referenceClass && isDerivedFrom(referenceClass, declaringClass, context.checker)) {
      needed = 'protected';
      continue;
    }
    return 'public';
  }
  return needed;
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

function getClassAtPosition(program: Program, fileName: string, position: number): ClassLikeDeclaration | undefined {
  const sourceFile = program.getSourceFile(fileName);
  assertNonNullable(sourceFile, `Source file not found in program: ${fileName}`);
  const node = findNodeAtPosition(sourceFile, position);
  assertNonNullable(node, `No node found at position ${String(position)} in ${fileName}`);
  return getEnclosingClass(node);
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

function getExportedNameNodes(node: Node): Node[] {
  if (isFunctionDeclaration(node) || isClassDeclaration(node) || isInterfaceDeclaration(node) || isTypeAliasDeclaration(node) || isEnumDeclaration(node)) {
    return node.name ? [node.name] : [];
  }
  if (isVariableStatement(node)) {
    return node.declarationList.declarations.map((declaration) => declaration.name).filter(isIdentifier);
  }
  return [];
}

function getMemberNameNode(node: Node): Node | undefined {
  if (isMethodDeclaration(node) || isPropertyDeclaration(node) || isGetAccessorDeclaration(node) || isSetAccessorDeclaration(node)) {
    return node.name;
  }
  return undefined;
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

function isDeclarationItself(reference: ReferenceLocation, nameNode: Node): boolean {
  return toCanonical(reference.fileName) === toCanonical(nameNode.getSourceFile().fileName) && reference.start === nameNode.getStart();
}

function isDerivedFrom(derived: ClassLikeDeclaration, base: ClassLikeDeclaration, checker: TypeChecker): boolean {
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
        if (isClassLike(declaration) && isDerivedFrom(declaration, base, checker)) {
          return true;
        }
      }
    }
  }
  return false;
}

function isOwnSourceFile(filePath: string, srcFolder: string): boolean {
  return filePath.startsWith(`${srcFolder}/`) && filePath.endsWith('.ts') && !filePath.endsWith('.d.ts');
}

function isTestFile(filePath: string): boolean {
  return filePath.includes('.test.') || filePath.includes('.integration.');
}

function rankExposure(exposure: MemberExposure): number {
  return MEMBER_EXPOSURE_ORDER.indexOf(exposure);
}
