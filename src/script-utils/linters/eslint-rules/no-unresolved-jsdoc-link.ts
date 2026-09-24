/**
 * @file
 *
 * ESLint rule: no-unresolved-jsdoc-link
 *
 * Reports a JSDoc `link`, `linkcode` or `linkplain` inline tag whose target no longer resolves to a symbol.
 *
 * A rename leaves `{@link OldName}` behind and nothing else reports it: `jsdoc/no-undefined-types` does not resolve
 * link targets, TSDoc checks only the tag syntax, and `tsc` parses JSDoc links without ever diagnosing them. So a dead
 * link survives until somebody happens to click it.
 *
 * A target resolves when any of these finds it, tried in order:
 *
 * 1. The type checker, at the comment's own location, exactly as editor go-to-definition does — so everything in
 *    scope there resolves: type parameters, parameters, imports, and the DOM / ES globals.
 * 2. A declaration anywhere in the same file — a function nested in another, a private method — which is out of
 *    scope at a `*Params` interface naming it, yet is exactly what a rename of it would break.
 * 3. The exports of any module in the program, by name. A comment routinely names a type its file never imports (an
 *    integration test naming the class it drives through `evalInObsidian`, a remark naming an Obsidian API), and the
 *    API docs generator resolves such a name library-wide too. This keeps the rule about DEAD links rather than
 *    about imports: a renamed or removed declaration is exported by no module, so it is still reported.
 * 4. A module named by its specifier or its path, in both TSDoc forms: `obsidian#Events#on` (the package as the first
 *    segment) and `error!errorToString` / `obsidian/components/plugin-gate-component!PluginConflictSeverity.Warn`
 *    (a module path, ending with `!`) — plus TypeScript's own `import('./module.ts').Member`. A path matches any
 *    source file in the program whose path ends with it.
 *
 * After the first segment, each further `.` / `#` segment is looked up as a member: a namespace or module export, a
 * static or instance member, or a property of the previous member's type — so `App.vault.adapter` resolves.
 *
 * A link that is not a code reference is skipped: a URL (`{@link https://example.com}`) and a JSDoc namepath
 * (`{@link module:foo}`) both parse as a name followed by text starting with `:`, and a link with no name has
 * nothing to resolve.
 */
import type {
  ParserServicesWithTypeInformation,
  TSESTree
} from '@typescript-eslint/utils';
import type { Rule } from 'eslint';
import type {
  ClassDeclaration,
  EntityName,
  EnumDeclaration,
  FunctionDeclaration,
  GetAccessorDeclaration,
  Identifier,
  InterfaceDeclaration,
  JSDocLink,
  JSDocLinkCode,
  JSDocLinkPlain,
  JSDocMemberName,
  MethodDeclaration,
  MethodSignature,
  ModuleDeclaration,
  Node,
  Program,
  PropertyDeclaration,
  PropertySignature,
  SetAccessorDeclaration,
  Symbol as TsSymbol,
  TypeAliasDeclaration,
  TypeChecker,
  VariableDeclaration
} from 'typescript';

import {
  escapeLeadingUnderscores,
  forEachChild,
  getJSDocCommentsAndTags,
  isClassDeclaration,
  isEnumDeclaration,
  isFunctionDeclaration,
  isGetAccessorDeclaration,
  isIdentifier,
  isInterfaceDeclaration,
  isJSDocLink,
  isJSDocLinkCode,
  isJSDocLinkPlain,
  isJSDocMemberName,
  isMethodDeclaration,
  isMethodSignature,
  isModuleDeclaration,
  isPropertyDeclaration,
  isPropertySignature,
  isSetAccessorDeclaration,
  isTypeAliasDeclaration,
  isVariableDeclaration,
  resolveModuleName,
  SymbolFlags,
  sys
} from 'typescript';

/**
 * Message ID reported when a JSDoc link target does not resolve to a symbol.
 */
export const MESSAGE_ID = 'noUnresolvedJsdocLink';

interface IsResolvedNameParams {
  readonly checker: TypeChecker;
  readonly containingFileName: string;
  readonly localDeclarationNamesByName: ReadonlyMap<string, readonly Identifier[]>;
  readonly name: EntityName | JSDocMemberName;
  readonly program: Program;
}

type JSDocLinkLike = JSDocLink | JSDocLinkCode | JSDocLinkPlain;

type LocalDeclaration =
  | ClassDeclaration
  | EnumDeclaration
  | FunctionDeclaration
  | GetAccessorDeclaration
  | InterfaceDeclaration
  | MethodDeclaration
  | MethodSignature
  | ModuleDeclaration
  | PropertyDeclaration
  | PropertySignature
  | SetAccessorDeclaration
  | TypeAliasDeclaration
  | VariableDeclaration;

type ModulePathMatchGroups = Readonly<Record<'memberPath' | 'modulePath', string>>;

interface ProgramIndex {
  readonly exportsByName: Map<string, TsSymbol[]>;
  readonly modulesByPath: Map<string, TsSymbol>;
}

const MODULE_PATH_REG_EXP = /^(?<modulePath>[^\s!|}]*)!(?<memberPath>[\w$.#]+)/;
const IMPORT_TYPE_REG_EXP = /^import\(\s*(?<quote>['"])(?<modulePath>[^'"]+)\k<quote>\s*\)\.(?<memberPath>[\w$.#]+)/;
const RELATIVE_PATH_PREFIX_REG_EXP = /^(?:\.\.?\/)+/;
const MEMBER_SEPARATOR_REG_EXP = /[.#]/;
const SOURCE_FILE_EXTENSION_REG_EXP = /(?:\.d)?\.[cm]?tsx?$/;
const INDEX_SUFFIX = '/index';

const programIndexCache = new WeakMap<Program, ProgramIndex>();

/**
 * The ESLint rule that reports JSDoc links whose target does not resolve.
 */
export const noUnresolvedJsdocLink: Rule.RuleModule = {
  create(context) {
    const services = context.sourceCode.parserServices as ParserServicesWithTypeInformation;

    return {
      Program(node): void {
        const program = services.program;
        const checker = program.getTypeChecker();
        const tsSourceFile = services.esTreeNodeToTSNodeMap.get(node as TSESTree.Program);

        /*
         * The same link is reachable more than once: a parameter returns its own `@param` tag, which its function's
         * JSDoc block also contains. So deduplicate on the link itself rather than on the JSDoc node.
         */
        const links = new Set<JSDocLinkLike>();

        /*
         * A link may name a declaration further down the file, so the whole file is walked before any link is
         * resolved.
         */
        const localDeclarationNamesByName = new Map<string, Identifier[]>();

        function visitJsDocNode(jsDocNode: Node): void {
          if (isJSDocLinkLike(jsDocNode)) {
            links.add(jsDocNode);
            return;
          }
          forEachChild(jsDocNode, visitJsDocNode);
        }

        function visitNode(tsNode: Node): void {
          collectLocalDeclarationName(tsNode, localDeclarationNamesByName);
          for (const jsDocNode of getJSDocCommentsAndTags(tsNode)) {
            visitJsDocNode(jsDocNode);
          }
          forEachChild(tsNode, visitNode);
        }

        function reportIfUnresolved(link: JSDocLinkLike): void {
          if (!link.name || link.text.startsWith(':')) {
            return;
          }

          const nameText = link.name.getText();
          const fullTarget = nameText + link.text;
          const moduleMatch = IMPORT_TYPE_REG_EXP.exec(fullTarget) ?? MODULE_PATH_REG_EXP.exec(fullTarget);
          let reportedName = nameText;
          let isResolved: boolean;

          if (moduleMatch?.groups) {
            const { memberPath, modulePath } = moduleMatch.groups as ModulePathMatchGroups;
            reportedName = moduleMatch[0];
            const moduleSymbol = findModule(program, checker, modulePath, tsSourceFile.fileName);
            isResolved = !!resolveMemberPath(checker, moduleSymbol, memberPath.split(MEMBER_SEPARATOR_REG_EXP));
          } else {
            isResolved = isResolvedName({
              checker,
              containingFileName: tsSourceFile.fileName,
              localDeclarationNamesByName,
              name: link.name,
              program
            });
          }

          if (isResolved) {
            return;
          }

          context.report({
            data: {
              name: reportedName
            },
            loc: {
              end: context.sourceCode.getLocFromIndex(link.name.getEnd()),
              start: context.sourceCode.getLocFromIndex(link.name.getStart())
            },
            messageId: MESSAGE_ID
          });
        }

        visitNode(tsSourceFile);
        for (const link of links) {
          reportIfUnresolved(link);
        }
      }
    };
  },
  meta: {
    docs: {
      description: 'Disallow JSDoc link tags whose target does not resolve to a symbol'
    },
    messages: {
      [MESSAGE_ID]: 'JSDoc link target `{{name}}` does not resolve. Was it renamed or removed?'
    },
    schema: [],
    type: 'problem'
  }
};

function collectLocalDeclarationName(node: Node, localDeclarationNamesByName: Map<string, Identifier[]>): void {
  if (!isLocalDeclaration(node) || !node.name || !isIdentifier(node.name)) {
    return;
  }
  const names = localDeclarationNamesByName.get(node.name.text) ?? [];
  names.push(node.name);
  localDeclarationNamesByName.set(node.name.text, names);
}

function findModule(program: Program, checker: TypeChecker, specifier: string, containingFileName: string): TsSymbol | undefined {
  const ambientModule = getProgramIndex(program, checker).modulesByPath.get(specifier);
  if (ambientModule) {
    return ambientModule;
  }

  const resolvedFileName = resolveModuleName(specifier, containingFileName, program.getCompilerOptions(), sys).resolvedModule?.resolvedFileName;
  const resolvedSourceFile = resolvedFileName === undefined ? undefined : program.getSourceFile(resolvedFileName);
  const resolvedModule = resolvedSourceFile && checker.getSymbolAtLocation(resolvedSourceFile);
  return resolvedModule ?? findModuleByPathSuffix(program, checker, specifier);
}

function findModuleByPathSuffix(program: Program, checker: TypeChecker, modulePath: string): TsSymbol | undefined {
  const normalizedPath = modulePath.replace(RELATIVE_PATH_PREFIX_REG_EXP, '').replace(SOURCE_FILE_EXTENSION_REG_EXP, '');
  const suffixes = [`/${normalizedPath}`, `/${normalizedPath}${INDEX_SUFFIX}`];
  for (const sourceFile of program.getSourceFiles()) {
    const pathWithoutExtension = sourceFile.fileName.replace(SOURCE_FILE_EXTENSION_REG_EXP, '');
    if (suffixes.every((suffix) => !pathWithoutExtension.endsWith(suffix))) {
      continue;
    }
    const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
    if (moduleSymbol) {
      return moduleSymbol;
    }
  }
  return undefined;
}

function flattenName(name: EntityName | JSDocMemberName): string[] {
  return isIdentifier(name) ? [name.text] : [...flattenName(name.left), name.right.text];
}

function getMember(checker: TypeChecker, symbol: TsSymbol, memberName: string): TsSymbol | undefined {
  const escapedName = escapeLeadingUnderscores(memberName);
  const target = resolveAlias(checker, symbol);
  // eslint-disable-next-line no-bitwise -- Bitwise flag test is idiomatic for the TypeScript compiler API.
  const moduleExport = (target.flags & SymbolFlags.Module) === 0 ? undefined : checker.tryGetMemberInModuleExports(memberName, target);
  return moduleExport
    ?? target.exports?.get(escapedName)
    ?? target.members?.get(escapedName)
    ?? checker.getPropertyOfType(checker.getDeclaredTypeOfSymbol(target), memberName)
    ?? checker.getPropertyOfType(checker.getTypeOfSymbol(target), memberName);
}

function getProgramIndex(program: Program, checker: TypeChecker): ProgramIndex {
  let index = programIndexCache.get(program);
  if (index) {
    return index;
  }

  index = {
    exportsByName: new Map<string, TsSymbol[]>(),
    modulesByPath: new Map<string, TsSymbol>()
  };

  const moduleSymbols: TsSymbol[] = [];
  for (const ambientModule of checker.getAmbientModules()) {
    index.modulesByPath.set(ambientModule.name.replaceAll('"', ''), ambientModule);
    moduleSymbols.push(ambientModule);
  }
  for (const sourceFile of program.getSourceFiles()) {
    const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
    if (moduleSymbol) {
      moduleSymbols.push(moduleSymbol);
    }
  }

  for (const moduleSymbol of moduleSymbols) {
    for (const exportSymbol of checker.getExportsOfModule(moduleSymbol)) {
      const symbols = index.exportsByName.get(exportSymbol.name) ?? [];
      symbols.push(exportSymbol);
      index.exportsByName.set(exportSymbol.name, symbols);
    }
  }

  programIndexCache.set(program, index);
  return index;
}

function isJSDocLinkLike(node: Node): node is JSDocLinkLike {
  return isJSDocLink(node) || isJSDocLinkCode(node) || isJSDocLinkPlain(node);
}

function isLocalDeclaration(node: Node): node is LocalDeclaration {
  return isClassDeclaration(node)
    || isEnumDeclaration(node)
    || isFunctionDeclaration(node)
    || isGetAccessorDeclaration(node)
    || isInterfaceDeclaration(node)
    || isMethodDeclaration(node)
    || isMethodSignature(node)
    || isModuleDeclaration(node)
    || isPropertyDeclaration(node)
    || isPropertySignature(node)
    || isSetAccessorDeclaration(node)
    || isTypeAliasDeclaration(node)
    || isVariableDeclaration(node);
}

function isResolvedName(params: IsResolvedNameParams): boolean {
  const {
    checker,
    containingFileName,
    localDeclarationNamesByName,
    name,
    program
  } = params;

  if (checker.getSymbolAtLocation(name)) {
    return true;
  }

  // `Foo#bar` is a `JSDocMemberName`, which the checker resolves only through its right-hand member.
  if (isJSDocMemberName(name) && checker.getSymbolAtLocation(name.right)) {
    return true;
  }

  const [rootName = '', ...memberNames] = flattenName(name);
  const index = getProgramIndex(program, checker);
  const localRoots = (localDeclarationNamesByName.get(rootName) ?? []).map((declarationName) => checker.getSymbolAtLocation(declarationName));
  const roots = [...localRoots, ...index.exportsByName.get(rootName) ?? [], findModule(program, checker, rootName, containingFileName)];

  return roots.some((root) => !!resolveMemberPath(checker, root, memberNames));
}

function resolveAlias(checker: TypeChecker, symbol: TsSymbol): TsSymbol {
  // eslint-disable-next-line no-bitwise -- Bitwise flag test is idiomatic for the TypeScript compiler API.
  return (symbol.flags & SymbolFlags.Alias) === 0 ? symbol : checker.getAliasedSymbol(symbol);
}

function resolveMemberPath(checker: TypeChecker, root: TsSymbol | undefined, memberNames: readonly string[]): TsSymbol | undefined {
  let current: TsSymbol | undefined = root;
  for (const memberName of memberNames) {
    if (!current) {
      return undefined;
    }
    current = getMember(checker, current, memberName);
  }
  return current;
}
