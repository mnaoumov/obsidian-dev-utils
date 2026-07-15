import {
  mkdtempSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  afterAll,
  describe,
  expect,
  it
} from 'vitest';

import {
  computeOgHash,
  loadFonts,
  loadLogoDataUri,
  renderOgImage
} from './og-image.ts';

const FONTS_DIR = join(import.meta.dirname, '..', 'assets', 'fonts');
const OG_HASH_LENGTH = 16;
const FONT_VARIANT_COUNT = 2;
const FONT_WEIGHT_REGULAR = 400;
const FONT_WEIGHT_BOLD = 700;
const PNG_SIGNATURE = Buffer.from('\x89PNG\r\n\x1a\n', 'binary');

const tempDirs: string[] = [];

afterAll(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { force: true, recursive: true });
  }
});

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'og-fonts-'));
  tempDirs.push(dir);
  return dir;
}

describe('computeOgHash', () => {
  it('is a stable 16-char hex digest of the card content', () => {
    const hash = computeOgHash({ badge: 'Class', description: 'A helper.', signature: 'const x = 1', title: 'Alpha' });
    expect(hash).toMatch(/^[0-9a-f]+$/);
    expect(hash).toHaveLength(OG_HASH_LENGTH);
    expect(computeOgHash({ badge: 'Class', description: 'A helper.', signature: 'const x = 1', title: 'Alpha' })).toBe(hash);
  });

  it('changes when any field changes', () => {
    const base = computeOgHash({ title: 'Alpha' });
    expect(computeOgHash({ title: 'Beta' })).not.toBe(base);
    expect(computeOgHash({ description: 'x', title: 'Alpha' })).not.toBe(base);
    expect(computeOgHash({ badge: 'x', title: 'Alpha' })).not.toBe(base);
    expect(computeOgHash({ signature: 'x', title: 'Alpha' })).not.toBe(base);
  });

  it('treats omitted optional fields the same as empty strings', () => {
    expect(computeOgHash({ title: 'Alpha' })).toBe(computeOgHash({ badge: '', description: '', signature: '', title: 'Alpha' }));
  });
});

describe('loadFonts', () => {
  it('loads the vendored Inter regular and bold weights', async () => {
    const fonts = await loadFonts(FONTS_DIR);
    expect(fonts).not.toBeNull();
    expect(fonts).toHaveLength(FONT_VARIANT_COUNT);
    expect(fonts?.map((font) => font.name)).toEqual(['Inter', 'Inter']);
    expect(fonts?.map((font) => font.weight)).toEqual([FONT_WEIGHT_REGULAR, FONT_WEIGHT_BOLD]);
  });

  it('returns null when the directory has no font files', async () => {
    expect(await loadFonts(join(makeTempDir(), 'does-not-exist'))).toBeNull();
    expect(await loadFonts(makeTempDir())).toBeNull();
  });

  it('falls back to any single font file for both weights', async () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, 'stray.otf'), Buffer.from('not-a-real-font'));

    const fonts = await loadFonts(dir);

    expect(fonts).toHaveLength(FONT_VARIANT_COUNT);
    expect(fonts?.map((font) => font.weight)).toEqual([FONT_WEIGHT_REGULAR, FONT_WEIGHT_BOLD]);
    expect(fonts?.[0]?.data).toEqual(fonts?.[1]?.data);
  });
});

describe('loadLogoDataUri', () => {
  it('returns null when the favicon is missing', async () => {
    expect(await loadLogoDataUri(join(makeTempDir(), 'missing-favicon.svg'))).toBeNull();
  });
});

describe('renderOgImage', () => {
  it('rasterizes the card to a PNG buffer', async () => {
    const fonts = await loadFonts(FONTS_DIR);
    expect(fonts).not.toBeNull();

    const png = await renderOgImage({ description: 'Renders a card.', title: 'Alpha' }, fonts ?? []);

    expect(Buffer.isBuffer(png)).toBe(true);
    expect(png.subarray(0, PNG_SIGNATURE.length)).toEqual(PNG_SIGNATURE);
  });
});
