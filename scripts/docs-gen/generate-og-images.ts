import type { Font } from 'satori';

import matter from 'gray-matter';
import { load as loadYaml } from 'js-yaml';
import { existsSync } from 'node:fs';
import {
  mkdir,
  readdir,
  readFile,
  writeFile
} from 'node:fs/promises';
import {
  dirname,
  relative
} from 'node:path/posix';
import { fileURLToPath } from 'node:url';

import type { OgImageParams } from './helpers/og-image.ts';

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

// Gray-matter's default YAML engine calls js-yaml's `safeLoad`, which was removed in js-yaml v4
// (the version installed here), so the default `matter(content)` throws. Supply v4's `load` explicitly.
const GRAY_MATTER_OPTIONS = {
  engines: {
    yaml: (input: string): object => (loadYaml(input) as null | object) ?? {}
  }
};

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

function filePathToSlug(filePath: string, contentDocsDir: string): string {
  let slug = relative(contentDocsDir, filePath);
  slug = slug.replaceAll('\\', '/');
  slug = slug.replace(/\.\w+$/, '');
  slug = slug.replace(/\/index$/, '');
  return slug || 'index';
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

  for (let i = 0; i < CONCURRENCY; i++) {
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

async function parsePage(filePath: string, contentDocsDir: string): Promise<null | PageEntry> {
  const content = await readFile(filePath, 'utf-8');
  const { data } = matter(content, GRAY_MATTER_OPTIONS);

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

  const slug = (data['slug'] as string | undefined) ?? filePathToSlug(filePath, contentDocsDir);
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

async function walkDir(dir: string, contentDocsDir: string, pages: PageEntry[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = `${dir}/${entry.name}`;
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
