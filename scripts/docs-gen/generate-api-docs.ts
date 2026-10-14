/**
 * @file
 *
 * Custom API documentation generator for obsidian-dev-utils.
 *
 * Walks every workspace package's `src`, extracts every documentable exported declaration via ts-morph, and
 * generates Starlight-compatible MDX pages plus a sidebar JSON. The output tree mirrors the packages'
 * module/subpath structure: a type's namespace is its package folder followed by its source path relative to that
 * package's `src` (`typescript-lib/string`, `obsidian-lib/modals/alert`), which is also its import subpath under the
 * `@mnaoumov` scope.
 *
 * Run directly via `node scripts/run.mjs scripts/docs-gen/generate-api-docs.ts`. Set `DOCS_ROOT` to point at a repo
 * root other than the current working directory.
 */

import {
  existsSync,
  readdirSync,
  readFileSync
} from 'node:fs';
import {
  mkdir,
  rm,
  writeFile
} from 'node:fs/promises';
import {
  join,
  normalize
} from 'node:path';
import { Project } from 'ts-morph';

import type {
  PageContent,
  TypeInfo
} from './helpers/api-doc-types.ts';

import {
  CACHE_FILE,
  OUTPUT_DIR,
  ROOT_DIR,
  SIDEBAR_FILE
} from './helpers/api-doc-constants.ts';
import { extractFileOverview } from './helpers/api-doc-jsdoc.ts';
import {
  loadExternalTypeMaps,
  registerMemberPages,
  registerRouteSegments
} from './helpers/api-doc-link-rendering.ts';
import {
  appendBacklinksAndWrite,
  generateMemberPages,
  generateNamespaceIndexPages,
  generateOverviewPage,
  generateSidebarJson
} from './helpers/api-doc-page-generation.ts';
import {
  collectFunctions,
  collectVariables,
  computeCacheHash,
  computeNamespace,
  findEntryFiles,
  processSourceFile,
  registerGenericTypeParams
} from './helpers/api-doc-source-processing.ts';
import { resolveInheritedMembers } from './helpers/api-doc-type-merging.ts';

/**
 * Where a source file's namespace starts: its package, and that package's source folder.
 */
interface NamespaceRoot {
  readonly packageFolder: string;
  readonly srcDirectory: string;
}

function ensureNonNullable<T>(value: T | undefined, message: string): T {
  if (value === undefined) {
    throw new Error(message);
  }
  return value;
}

async function main(): Promise<void> {
  loadExternalTypeMaps();

  const rootDirectory = ROOT_DIR;
  const packagesDirectory = join(rootDirectory, 'packages');
  const packageFolders = readdirSync(packagesDirectory, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .sort();

  const namespaceRootByEntryFile = new Map<string, NamespaceRoot>();
  for (const packageFolder of packageFolders) {
    const srcDirectory = join(packagesDirectory, packageFolder, 'src');
    for (const entryFile of findEntryFiles(srcDirectory)) {
      namespaceRootByEntryFile.set(entryFile, { packageFolder, srcDirectory });
    }
  }
  const entryFiles = [...namespaceRootByEntryFile.keys()];
  console.warn(`Found ${String(entryFiles.length)} entry source files`);

  // Check cache — skip generation if nothing changed
  const currentHash = computeCacheHash(entryFiles);
  if (existsSync(CACHE_FILE) && existsSync(SIDEBAR_FILE) && readFileSync(CACHE_FILE, 'utf-8').trim() === currentHash) {
    console.warn('Source files and generator unchanged — skipping generation.');
    return;
  }

  // Load via this repo's tsconfig so inferred types resolve.
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    tsConfigFilePath: join(rootDirectory, 'tsconfig.json')
  });
  const sourceFiles = project.addSourceFilesAtPaths(entryFiles);

  const types = new Map<string, TypeInfo>();
  const moduleOverviews = new Map<string, string>();

  for (const src of sourceFiles) {
    const namespaceRoot = ensureNonNullable(namespaceRootByEntryFile.get(normalize(src.getFilePath())), `Unexpected source file: ${src.getFilePath()}`);
    const namespace = `${namespaceRoot.packageFolder}/${computeNamespace(namespaceRoot.srcDirectory, src.getFilePath())}`;
    const overview = extractFileOverview(src);
    if (overview) {
      moduleOverviews.set(namespace, overview);
    }
    processSourceFile(src, types, namespace);
    collectFunctions(src, types, namespace);
    collectVariables(src, types, namespace);
  }

  resolveInheritedMembers(types);

  // Sort members alphabetically
  for (const [, info] of types) {
    info.properties.sort((a, b) => a.name.localeCompare(b.name));
    info.methods.sort((a, b) => a.name.localeCompare(b.name));
  }

  const allTypes = types;

  registerGenericTypeParams(types);

  registerRouteSegments(types);
  registerMemberPages(types);

  await rm(OUTPUT_DIR, { force: true, recursive: true });
  await mkdir(OUTPUT_DIR, { recursive: true });

  await generateNamespaceIndexPages(types, allTypes, moduleOverviews);

  // Pass 1: generate all pages without backlinks, collect content (keyed by qualified id)
  const pageContents = new Map<string, PageContent>();
  let pageCount = 0;
  for (const [key, info] of types) {
    const { content, filePath } = await generateOverviewPage(info.name, info, allTypes);
    pageContents.set(key, { content, filePath });
    if (info.kind === 'class' || info.kind === 'interface') {
      await generateMemberPages(info.name, info, allTypes);
    }
    pageCount++;
  }

  // Pass 2: scan content for links, append backlinks, write files
  await appendBacklinksAndWrite(pageContents, allTypes);

  // Sidebar JSON for the Astro config
  await generateSidebarJson(types);

  // Write cache hash on successful generation
  await writeFile(CACHE_FILE, currentHash, 'utf-8');

  console.warn(`Generated docs for ${String(pageCount)} types across ${String(moduleOverviews.size)} documented modules`);
}

await main();
