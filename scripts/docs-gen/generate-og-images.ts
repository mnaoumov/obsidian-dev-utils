import type { Font } from 'satori';

import { existsSync } from 'node:fs';
import {
  mkdir,
  readdir,
  readFile,
  writeFile
} from 'node:fs/promises';
import { dirname } from 'node:path/posix';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

import type { OgImageParams } from './helpers/og-image.ts';

import { getOgImagePageSlug } from './helpers/og-image-page.ts';
import {
  computeOgHash,
  loadFonts,
  loadLogoDataUri,
  renderOgImage
} from './helpers/og-image.ts';

type CacheManifest = Record<string, string>;

interface PageEntry {
  hash: string;
  params: OgImageParams;
  slug: string;
}

const CONCURRENCY = 10;
const PROGRESS_LOG_INTERVAL = 100;

// Frontmatter is parsed here rather than with `gray-matter`. Its `lib/engines.js` binds js-yaml's
// `safeLoad`/`safeDump` at MODULE-LOAD time, and both were removed in js-yaml v4 — so merely
// IMPORTING `gray-matter` throws `Cannot read properties of undefined (reading 'bind')`, before an
// `engines` option could override the default. Only the frontmatter object is needed here.
// `yaml` is used rather than `js-yaml` because `depend/ban-dependencies` bans the latter directly.
const FRONT_MATTER_REG_EXP = /^---\r?\n(?<frontMatter>[\s\S]*?)\r?\n---(?:\r?\n|$)/;

interface GenerateOptions {
  readonly changedPages: PageEntry[];
  readonly fonts: Font[];
  readonly logoDataUri: null | string;
  readonly manifest: CacheManifest;
  readonly outputDir: string;
}

async function collectPages(contentDocsDir: string): Promise<PageEntry[]> {
  const pages: PageEntry[] = [];
  await walkDir(contentDocsDir, contentDocsDir, pages);
  return pages;
}

async function generateImagesWithPool(options: GenerateOptions): Promise<void> {
  const { changedPages, fonts, logoDataUri, manifest, outputDir } = options;
  let completed = 0;
  const total = changedPages.length;

  const pool: Promise<void>[] = [];
  let index = 0;

  async function processNext(): Promise<void> {
    while (index < total) {
      const page = changedPages[index++];
      if (!page) {
        continue;
      }
      const outputPath = `${outputDir}/${page.slug}.png`;
      await mkdir(dirname(outputPath), { recursive: true });
      const png = await renderOgImage(page.params, fonts, logoDataUri);
      await writeFile(outputPath, png);
      manifest[page.slug] = page.hash;
      completed++;
      if (completed % PROGRESS_LOG_INTERVAL === 0) {
        console.warn(`  ${String(completed)}/${String(total)} images generated...`);
      }
    }
  }

  for (let $index = 0; $index < CONCURRENCY; $index++) {
    pool.push(processNext());
  }

  await Promise.all(pool);
}

async function loadCacheManifest(manifestPath: string): Promise<CacheManifest> {
  if (!existsSync(manifestPath)) {
    return {};
  }
  const content = await readFile(manifestPath, 'utf-8');
  return JSON.parse(content) as CacheManifest;
}

async function main(): Promise<void> {
  // Scripts/docs-gen/generate-og-images.ts → repo root is three levels up.
  const scriptDir = dirname(toPosixPath(fileURLToPath(import.meta.url)));
  const repoRoot = dirname(dirname(scriptDir));
  const docsDir = `${repoRoot}/docs`;
  const contentDocsDir = `${docsDir}/src/content/docs`;
  const outputDir = `${docsDir}/public/og`;
  const manifestPath = `${outputDir}/.cache-manifest.json`;
  const fontsDir = `${scriptDir}/assets/fonts`;
  const faviconPath = `${docsDir}/public/favicon.svg`;

  if (!existsSync(contentDocsDir)) {
    console.warn(`OG images: content dir not found (${contentDocsDir}); skipping.`);
    return;
  }

  // Load fonts first — satori cannot render without them.
  const fonts = await loadFonts(fontsDir);
  if (!fonts) {
    console.warn(
      `OG images: no fonts available in ${fontsDir}; skipping OG image generation. `
        + 'Add Inter TTFs (inter-latin-400-normal.ttf / inter-latin-700-normal.ttf) there to enable it.'
    );
    return;
  }

  // Collect all pages
  const pages = await collectPages(contentDocsDir);
  console.warn(`OG images: found ${String(pages.length)} pages`);

  // Load cache manifest
  const manifest = await loadCacheManifest(manifestPath);

  // Filter to changed pages
  const changedPages = pages.filter((page) => manifest[page.slug] !== page.hash);
  console.warn(`OG images: ${String(changedPages.length)} changed / ${String(pages.length)} total`);

  if (changedPages.length === 0) {
    console.warn('All OG images up to date.');
    return;
  }

  // Rasterize the site logo once (shared across every card); degrade gracefully if absent.
  const logoDataUri = await loadLogoDataUri(faviconPath);
  if (!logoDataUri) {
    console.warn(`OG images: favicon not found (${faviconPath}); rendering cards without a logo.`);
  }

  // Generate images in parallel with concurrency limit
  await generateImagesWithPool({
    changedPages,
    fonts,
    logoDataUri,
    manifest,
    outputDir
  });

  // Write updated manifest
  await writeManifest(manifestPath, manifest);
  console.warn(`OG images: done. Generated ${String(changedPages.length)} images.`);
}

function parseFrontMatter(content: string): Record<string, unknown> {
  const frontMatter = FRONT_MATTER_REG_EXP.exec(content)?.groups?.['frontMatter'];
  if (!frontMatter) {
    return {};
  }

  return (parseYaml(frontMatter) as null | Record<string, unknown>) ?? {};
}

async function parsePage(filePath: string, contentDocsDir: string): Promise<null | PageEntry> {
  const content = await readFile(filePath, 'utf-8');
  const data = parseFrontMatter(content);

  const title = (data['title'] as string | undefined) ?? '';
  if (!title) {
    return null;
  }

  const description = (data['description'] as string | undefined) ?? '';
  const signature = (data['signature'] as string | undefined) ?? '';
  const badge = (data['sidebar'] as Record<string, unknown> | undefined)?.['badge'] as
    | Record<string, string>
    | undefined;
  const badgeText = badge?.['text'];

  const slug = getOgImagePageSlug(data, filePath, contentDocsDir);
  const params: OgImageParams = {
    badge: badgeText,
    description,
    signature,
    title
  };

  return {
    hash: computeOgHash(params),
    params,
    slug
  };
}

function toPosixPath(filePath: string): string {
  return filePath.replaceAll('\\', '/');
}

async function walkDir(directory: string, contentDocsDir: string, pages: PageEntry[]): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = `${directory}/${entry.name}`;
    if (entry.isDirectory()) {
      await walkDir(fullPath, contentDocsDir, pages);
    } else if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) {
      const page = await parsePage(fullPath, contentDocsDir);
      if (page) {
        pages.push(page);
      }
    }
  }
}

async function writeManifest(manifestPath: string, manifest: CacheManifest): Promise<void> {
  await mkdir(dirname(manifestPath), { recursive: true });
  const INDENT = 2;
  await writeFile(manifestPath, JSON.stringify(manifest, null, INDENT));
}

await main();
