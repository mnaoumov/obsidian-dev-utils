/**
 * @file
 *
 * Source discovery + extraction: walks `src`, filters to documentable entry files, and turns each
 * file's exported declarations into `TypeInfo` entries keyed by a qualified `${namespace}#${name}`.
 */

import type { SourceFile } from 'ts-morph';

import { createHash } from 'node:crypto';
import {
  globSync,
  readdirSync,
  readFileSync
} from 'node:fs';
import {
  join,
  relative,
  resolve
} from 'node:path';

import type { TypeInfo } from './api-doc-types.ts';

import {
  GENERIC_TYPE_PARAMS,
  ROOT_DIR
} from './api-doc-constants.ts';
import {
  extractClassInfo,
  extractEnumInfo,
  extractInterfaceInfo,
  extractTypeAliasInfo,
  getDescription,
  getExamples,
  getParamDescriptions,
  getRemarks,
  getReturnDescription,
  getSince
} from './api-doc-jsdoc.ts';
import { simplifyType } from './api-doc-text-utils.ts';

/** Directory names whose entire subtree is excluded from documentation. */
const EXCLUDED_DIR_SEGMENTS = new Set(['@types', 'styles', 'test-helpers']);

/** Collect top-level exported functions. */
export function collectFunctions(src: SourceFile, types: Map<string, TypeInfo>, namespace: string): void {
  for (const fn of src.getFunctions()) {
    if (!fn.isExported()) {
      continue;
    }
    const name = fn.getName();
    if (!name) {
      continue;
    }
    const key = qualifiedKey(namespace, name);
    if (types.has(key)) {
      continue;
    }
    const paramDescriptions = getParamDescriptions(fn);
    const params = fn.getParameters().map((p) => ({
      description: paramDescriptions.get(p.getName()) ?? '',
      name: p.getName(),
      type: simplifyType(p.getType().getText())
    }));
    const paramStr = params.map((p) => `${p.name}: ${p.type}`).join(', ');
    const returnType = simplifyType(fn.getReturnType().getText());
    const signature = `${name}(${paramStr})`;
    types.set(key, {
      baseTypes: [],
      description: getDescription(fn),
      enumMembers: [],
      examples: getExamples(fn),
      implementsTypes: [],
      kind: 'function',
      methods: [{
        description: getDescription(fn),
        examples: getExamples(fn),
        inheritedFrom: '',
        isStatic: false,
        name,
        overloadKey: name,
        parameters: params,
        remarks: getRemarks(fn),
        returnDescription: getReturnDescription(fn),
        returnType,
        signature,
        since: getSince(fn),
        type: ''
      }],
      name,
      namespace,
      properties: [],
      remarks: getRemarks(fn),
      typeParameters: fn.getTypeParameters().map((tp) => tp.getText())
    });
  }
}

/** Collect top-level exported variable declarations (e.g. `export const EMPTY = ''`). */
export function collectVariables(src: SourceFile, types: Map<string, TypeInfo>, namespace: string): void {
  for (const varStmt of src.getVariableStatements()) {
    if (!varStmt.isExported()) {
      continue;
    }
    const declKind = varStmt.getDeclarationKind();
    for (const decl of varStmt.getDeclarations()) {
      const name = decl.getName();
      const key = qualifiedKey(namespace, name);
      if (!name || types.has(key)) {
        continue;
      }
      types.set(key, {
        baseTypes: [],
        description: getDescription(varStmt),
        enumMembers: [],
        examples: getExamples(varStmt),
        implementsTypes: [],
        kind: 'variable',
        methods: [],
        name,
        namespace,
        properties: [],
        remarks: getRemarks(varStmt),
        typeParameters: [],
        variableKeyword: declKind,
        variableType: simplifyType(decl.getType().getText())
      });
    }
  }
}

/** Compute a hash of all entry source files + the generator scripts themselves */
export function computeCacheHash(entryFiles: string[]): string {
  const hash = createHash('sha256');

  // Hash the generator script itself
  const generatorPath = resolve(import.meta.dirname, '..', 'generate-api-docs.ts');
  hash.update(readFileSync(generatorPath, 'utf-8'));

  // Hash all helper modules
  const helperFiles = globSync('scripts/docs-gen/helpers/**/*.ts', { cwd: ROOT_DIR }).sort();
  for (const helperFile of helperFiles) {
    const fullPath = resolve(ROOT_DIR, helperFile);
    hash.update(fullPath);
    hash.update(readFileSync(fullPath, 'utf-8'));
  }

  // Hash all entry source files
  for (const filePath of [...entryFiles].sort()) {
    hash.update(filePath);
    hash.update(readFileSync(filePath, 'utf-8'));
  }

  return hash.digest('hex');
}

/**
 * Recursively find all documentable `*.ts` entry files under `src`.
 *
 * Excludes: `*.test.ts` (incl. `*.browser.test.ts` / `*.integration.test.ts`), `*.d.ts`,
 * `index.ts`, `__merged.ts`, `setup.ts`, `*-setup.ts`, and any subtree under a `@types`,
 * `styles`, or `test-helpers` directory.
 */
export function findEntryFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDED_DIR_SEGMENTS.has(entry.name)) {
        continue;
      }
      results.push(...findEntryFiles(fullPath));
    } else if (isEntryFile(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

/** Compute the namespace (POSIX path relative to `src`, no extension) for a source file. */
export function computeNamespace(srcDir: string, filePath: string): string {
  return relative(srcDir, filePath).replace(/\\/g, '/').replace(/\.ts$/, '');
}

export function processSourceFile(src: SourceFile, types: Map<string, TypeInfo>, namespace: string): void {
  for (const alias of src.getTypeAliases()) {
    if (!alias.isExported()) {
      continue;
    }
    const key = qualifiedKey(namespace, alias.getName());
    if (!types.has(key)) {
      types.set(key, extractTypeAliasInfo(alias, namespace));
    }
  }

  for (const enumDecl of src.getEnums()) {
    if (!enumDecl.isExported()) {
      continue;
    }
    const key = qualifiedKey(namespace, enumDecl.getName());
    if (!types.has(key)) {
      types.set(key, extractEnumInfo(enumDecl, namespace));
    }
  }

  for (const iface of src.getInterfaces()) {
    if (!iface.isExported()) {
      continue;
    }
    const key = qualifiedKey(namespace, iface.getName());
    if (!types.has(key)) {
      types.set(key, extractInterfaceInfo(iface, namespace));
    }
  }

  for (const cls of src.getClasses()) {
    if (!cls.isExported()) {
      continue;
    }
    const name = cls.getName();
    if (!name) {
      continue;
    }
    const key = qualifiedKey(namespace, name);
    if (!types.has(key)) {
      types.set(key, extractClassInfo(cls, namespace));
    }
  }
}

/**
 * Register all type parameter names so renderTypeWithLinks won't hyperlink them.
 * Skip names that are also known types — those should still be linkable.
 */
export function registerGenericTypeParams(types: Map<string, TypeInfo>): void {
  const knownNames = new Set<string>();
  for (const [, info] of types) {
    knownNames.add(info.name);
  }
  for (const [, info] of types) {
    for (const tp of info.typeParameters) {
      const bareParam = tp.replace(/\s+extends\s+.*$/, '');
      if (!knownNames.has(bareParam)) {
        GENERIC_TYPE_PARAMS.add(bareParam);
      }
    }
  }
}

function isEntryFile(name: string): boolean {
  if (!name.endsWith('.ts') || name.endsWith('.d.ts')) {
    return false;
  }
  if (name === 'index.ts' || name === '__merged.ts' || name === 'setup.ts') {
    return false;
  }
  if (name.endsWith('-setup.ts')) {
    return false;
  }
  // Covers *.test.ts, *.browser.test.ts, *.integration.test.ts
  if (/\.test\.ts$/.test(name)) {
    return false;
  }
  return true;
}

function qualifiedKey(namespace: string, name: string): string {
  return `${namespace}#${name}`;
}
