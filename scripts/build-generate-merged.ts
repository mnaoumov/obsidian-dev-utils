/**
 * @file
 *
 * Generates the flat re-export barrel `src/__merged.ts`.
 *
 * `__merged.ts` re-exports every renderer-safe value export of the library flatly
 * (`export { fn } from './kebab-file.ts'`), so an `evalInObsidian` closure can reach any helper as
 * `lib.fn` after `registerLibResolver(() => window.__obsidianDevUtilsModule.__merged)`.
 *
 * Only VALUE exports are flattened: `typeof import('obsidian-dev-utils/__merged')` (the type the
 * harness `Lib` interface extends) captures the value space, so type-only exports contribute nothing
 * to `lib` and are skipped. Every flat name must be unique — the generator throws (failing the build)
 * if two distinct symbols are exported under the same name, so a genuine clash must be resolved by
 * renaming one side at the source rather than silently shadowing.
 *
 * The one clash that is NOT a genuine one is a cross-platform facade over its own `desktop-` / `mobile-`
 * twins (`trusted-input.ts` over `desktop-trusted-input.ts` + `mobile-trusted-input.ts`): the twins are
 * implementations of the facade, exporting the same names by design. Those are **superseded** — the
 * barrel takes the facade and skips them, so `lib.pressKey` is platform-correct — under a superset
 * invariant that keeps the supersession from losing an export. See `helpers/module-supersession.ts`.
 */

import type {
  Symbol as TsSymbol,
  TypeChecker
} from 'typescript';

import {
  createProgram,
  isExportSpecifier,
  SymbolFlags
} from 'typescript';

import type { ModuleSupersession } from './helpers/module-supersession.ts';

import {
  basename,
  join,
  relative
} from '../src/path.ts';
import { parseTsConfig } from '../src/script-utils/check-project-types.ts';
import { wrapCliTask } from '../src/script-utils/cli-utils.ts';
import { generate } from '../src/script-utils/code-generator.ts';
import { readdirPosix } from '../src/script-utils/fs.ts';
import { ObsidianDevUtilsRepoPaths } from '../src/script-utils/obsidian-dev-utils-repo-paths.ts';
import {
  findExportNameCollisions,
  formatExportNameCollisions
} from './helpers/export-name-collisions.ts';
import {
  findIncompleteFacades,
  findModuleSupersessions,
  formatIncompleteFacades,
  toSupersededModules
} from './helpers/module-supersession.ts';

const SKIP_DIRS = new Set<string>([
  ObsidianDevUtilsRepoPaths.ScriptUtils,
  ObsidianDevUtilsRepoPaths.Styles,
  ObsidianDevUtilsRepoPaths.TestHelpers,
  ObsidianDevUtilsRepoPaths.Types
]);

const MERGED_BASENAME = basename(ObsidianDevUtilsRepoPaths.MergedTs, ObsidianDevUtilsRepoPaths.TsExtension);

const SRC_DIR = ObsidianDevUtilsRepoPaths.Src as string;

/**
The first module to export a given value name, and the symbol it resolves to (for collision detection).
*/
interface ExportOrigin {
  moduleSpecifier: string;
  symbol: TsSymbol;
}

await wrapCliTask(async () => {
  const leafFiles = await collectLeafFiles(SRC_DIR);
  leafFiles.sort();

  await generateMerged(leafFiles);
});

function appendName(namesByModule: Map<string, string[]>, moduleSpecifier: string, name: string): void {
  const names = namesByModule.get(moduleSpecifier) ?? [];
  names.push(name);
  namesByModule.set(moduleSpecifier, names);
}

function assertFacadesSupersedeTwinsCompletely(supersessions: ModuleSupersession[], valueExportsByModule: Map<string, string[]>): void {
  const incompleteFacades = findIncompleteFacades(supersessions, valueExportsByModule);
  if (incompleteFacades.length === 0) {
    return;
  }

  throw new Error(
    'A cross-platform facade supersedes its platform twins in the flat barrel, so an export only the twin '
      + 'has would be silently dropped from it:\n'
      + `${formatIncompleteFacades(incompleteFacades)}\n`
      + 'Re-export the missing names from the facade, or rename them at the source.'
  );
}

function assertNoCaseInsensitiveExportCollisions(exportNamesByModule: Map<string, string[]>): void {
  const nameCollisions = findExportNameCollisions(exportNamesByModule);
  if (nameCollisions.length === 0) {
    return;
  }

  throw new Error(
    'The library exports names that collide case-insensitively within a module, which would overwrite '
      + 'each other on the documentation site when it is built on a case-insensitive filesystem:\n'
      + `${formatExportNameCollisions(nameCollisions)}\n`
      + 'Rename one side so no two exports in a module differ only by case.'
  );
}

async function collectLeafFiles(directory: string): Promise<string[]> {
  const out: string[] = [];
  for (const dirent of await readdirPosix(directory, { withFileTypes: true })) {
    const full = join(directory, dirent.name);
    if (dirent.isDirectory()) {
      if (SKIP_DIRS.has(dirent.name)) {
        continue;
      }
      out.push(...await collectLeafFiles(full));
      continue;
    }
    if (isLeafFile(dirent.name)) {
      out.push(full);
    }
  }
  return out;
}

function compareCaseInsensitive(a: string, b: string): number {
  const lowerA = a.toLowerCase();
  const lowerB = b.toLowerCase();
  if (lowerA !== lowerB) {
    return lowerA < lowerB ? -1 : 1;
  }
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}

async function generateMerged(leafFiles: string[]): Promise<void> {
  const { options } = parseTsConfig(join(import.meta.dirname, '..', ObsidianDevUtilsRepoPaths.TsConfigJson));
  const program = createProgram({
    options: {
      ...options,
      noEmit: true
    },
    rootNames: leafFiles
  });
  const checker = program.getTypeChecker();

  const valueExportsByModule = new Map<string, string[]>();
  const exportNamesByModule = new Map<string, string[]>();
  const originByName = new Map<string, ExportOrigin>();
  const collisionMessages: string[] = [];

  // A facade over its own `desktop-` / `mobile-` twins takes their place in the flat bag. Worked out up
  // Front from the filenames alone, because it decides which modules the walk below may contribute.
  const supersessions = findModuleSupersessions(leafFiles.map((file) => toModuleSpecifier(file)));
  const supersededModules = toSupersededModules(supersessions);
  // Every module's value exports, superseded ones included — the superset invariant needs what the twins
  // Export, which is exactly what does NOT reach `valueExportsByModule`.
  const allValueExportsByModule = new Map<string, string[]>();

  for (const file of leafFiles) {
    const sourceFile = program.getSourceFile(file);
    if (!sourceFile) {
      continue;
    }
    const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
    if (!moduleSymbol) {
      continue;
    }

    const moduleSpecifier = toModuleSpecifier(file);
    for (const exportSymbol of checker.getExportsOfModule(moduleSymbol)) {
      const name = exportSymbol.getName();
      if (name === 'default') {
        continue;
      }

      // Track EVERY export (types included) for the case-collision guard below — each documented
      // Export becomes a filesystem directory on the docs site, so a case-only clash within a module
      // Breaks the site on a case-insensitive filesystem even when only one side is a runtime value.
      appendName(exportNamesByModule, moduleSpecifier, name);

      const resolved = toResolvedValueSymbol(checker, exportSymbol);
      if (!resolved) {
        continue;
      }

      appendName(allValueExportsByModule, moduleSpecifier, name);

      // A superseded twin contributes nothing to the flat bag — its facade carries the same names, and
      // Dispatches to the right twin at call time. It is still tracked just above, so the superset
      // Invariant below can see what it exports.
      if (supersededModules.has(moduleSpecifier)) {
        continue;
      }

      const existing = originByName.get(name);
      if (existing) {
        if (existing.symbol !== resolved) {
          // Two distinct symbols exported under the same name would silently shadow each other in the
          // Flat bag. The library forbids duplicated public names — rename one at the source instead.
          collisionMessages.push(`  \`${name}\` — ${existing.moduleSpecifier} vs ${moduleSpecifier}`);
        }
        continue;
      }

      originByName.set(name, { moduleSpecifier, symbol: resolved });
      const names = valueExportsByModule.get(moduleSpecifier) ?? [];
      names.push(name);
      valueExportsByModule.set(moduleSpecifier, names);
    }
  }

  assertNoCaseInsensitiveExportCollisions(exportNamesByModule);
  assertFacadesSupersedeTwinsCompletely(supersessions, allValueExportsByModule);

  if (collisionMessages.length > 0) {
    throw new Error(
      'Cannot generate the flat barrel: the library exports the same name from more than one module.\n'
        + `${collisionMessages.join('\n')}\n`
        + 'Rename one side so every renderer-safe value export is unique.'
    );
  }

  const lines: string[] = [];
  // Dprint sorts export declarations by their module specifier; every specifier here is lowercase, so
  // A plain code-point sort matches its case-insensitive ordering.
  const moduleSpecifiers = [...valueExportsByModule.keys()].sort();
  for (const moduleSpecifier of moduleSpecifiers) {
    // Dprint sorts named specifiers case-insensitively.
    const names = [...(valueExportsByModule.get(moduleSpecifier) ?? [])].sort(compareCaseInsensitive);
    // Match dprint's `exportDeclaration.forceMultiLine: "whenMultiple"`: a single specifier stays on
    // One line, multiple specifiers are forced multi-line (2-space indent, no trailing comma).
    if (names.length === 1) {
      lines.push(`export { ${names[0] ?? ''} } from '${moduleSpecifier}';`);
      continue;
    }
    lines.push('export {');
    for (const [index, name] of names.entries()) {
      lines.push(`  ${name}${index === names.length - 1 ? '' : ','}`);
    }
    lines.push(`} from '${moduleSpecifier}';`);
  }

  await generate(join(SRC_DIR, ObsidianDevUtilsRepoPaths.MergedTs), lines);
}

function isLeafFile(name: string): boolean {
  if (!name.endsWith(ObsidianDevUtilsRepoPaths.TsExtension)) {
    return false;
  }
  if (name.endsWith(ObsidianDevUtilsRepoPaths.DtsExtension)) {
    return false;
  }
  if (name === ObsidianDevUtilsRepoPaths.IndexTs as string) {
    return false;
  }
  if (name.endsWith('.test.ts')) {
    return false;
  }
  if (name === 'setup.ts' || name.endsWith('-setup.ts')) {
    return false;
  }
  // The flat barrel must not re-export from itself.
  if (basename(name, ObsidianDevUtilsRepoPaths.TsExtension) === MERGED_BASENAME) {
    return false;
  }
  return true;
}

function isTypeOnlyExport(exportSymbol: TsSymbol): boolean {
  return (exportSymbol.declarations ?? []).some((declaration) => isExportSpecifier(declaration) && (declaration.isTypeOnly || declaration.parent.parent.isTypeOnly));
}

function toModuleSpecifier(file: string): string {
  const relativePath = relative(SRC_DIR, file).replaceAll('\\', '/');
  return `./${relativePath}`;
}

function toResolvedValueSymbol(checker: TypeChecker, exportSymbol: TsSymbol): null | TsSymbol {
  // Type-only re-exports (`export type { … }`) carry no runtime value, so they never belong in the flat
  // `lib` bag — `typeof import('…/__merged')` only sees value exports anyway.
  if (isTypeOnlyExport(exportSymbol)) {
    return null;
  }

  // eslint-disable-next-line no-bitwise -- Bitwise flag test is the TypeScript API idiom for symbol flags.
  const resolved = exportSymbol.flags & SymbolFlags.Alias ? checker.getAliasedSymbol(exportSymbol) : exportSymbol;
  // eslint-disable-next-line no-bitwise -- Bitwise flag test is the TypeScript API idiom for symbol flags.
  if (!(resolved.getFlags() & SymbolFlags.Value)) {
    return null;
  }

  return resolved;
}
