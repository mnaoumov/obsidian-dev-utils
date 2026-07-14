import type { Font } from 'satori';

import { Resvg } from '@resvg/resvg-js';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import {
  readdir,
  readFile
} from 'node:fs/promises';
import satori from 'satori';

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const BACKGROUND_COLOR = '#111213';
// Obsidian violet accent, matching the docs theme (`--sl-color-accent`).
const ACCENT_COLOR = '#8b6ff5';
const ACCENT_BG = 'rgba(103, 172, 172, 0.18)';
const TITLE_COLOR = '#ffffff';
const DESCRIPTION_COLOR = '#9CA3AF';
const BRAND_COLOR = '#8b6ff5';
const BRAND_TEXT = 'obsidian-dev-utils';
const BORDER_WIDTH = 8;
const PADDING_X = 80;
const PADDING_TOP = 70;
const PADDING_BOTTOM = 60;
const TITLE_FONT_SIZE = 56;
const DESCRIPTION_FONT_SIZE = 26;
const BADGE_FONT_SIZE = 18;
const BADGE_FONT_WEIGHT = 600;
const BRAND_FONT_SIZE = 28;
const FONT_WEIGHT_REGULAR = 400;
const FONT_WEIGHT_BOLD = 700;
const TITLE_LINE_HEIGHT = 1.2;
const DESCRIPTION_LINE_HEIGHT = 1.5;
// Signature code block (violet accent on a subtle darker rounded panel).
const SIGNATURE_FONT_SIZE = 24;
const SIGNATURE_LINE_HEIGHT = 1.4;
const SIGNATURE_BG = 'rgba(0, 0, 0, 0.35)';
const SIGNATURE_MAX_LINES = 2;
// Site logo (favicon), rasterized once and embedded as a data URI.
const LOGO_DISPLAY_SIZE = 76;
const LOGO_RASTER_SIZE = 152;

export interface OgImageParams {
  readonly badge?: string;
  readonly description?: string;
  readonly signature?: string;
  readonly title: string;
}

export function computeOgHash(params: OgImageParams): string {
  const input = JSON.stringify({
    badge: params.badge ?? '',
    description: params.description ?? '',
    signature: params.signature ?? '',
    title: params.title
  });
  const HASH_LENGTH = 16;
  return createHash('sha256').update(input).digest('hex').slice(0, HASH_LENGTH);
}

/**
 * Rasterize an SVG favicon to a PNG data URI via resvg for embedding in the satori layout (satori's
 * `<img>` needs a raster/data-URI source). Returns `null` when the file is missing so the caller can
 * render the card without a logo. Call this ONCE and reuse the result across all cards.
 */
export async function loadLogoDataUri(faviconPath: string): Promise<null | string> {
  if (!existsSync(faviconPath)) {
    return null;
  }
  const svg = await readFile(faviconPath, 'utf-8');
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: LOGO_RASTER_SIZE } });
  const png = resvg.render().asPng();
  return `data:image/png;base64,${png.toString('base64')}`;
}

/**
 * Loads the fonts satori needs to render text.
 *
 * obsidian-dev-utils does not vendor Inter TTFs, so this looks for them (or any
 * `.ttf`/`.otf`) in `fontsDir` and returns `null` when none are available, so
 * the caller can skip OG generation instead of crashing the build.
 */
export async function loadFonts(fontsDir: string): Promise<Font[] | null> {
  const regularPath = `${fontsDir}/inter-latin-400-normal.ttf`;
  const boldPath = `${fontsDir}/inter-latin-700-normal.ttf`;

  if (existsSync(regularPath) && existsSync(boldPath)) {
    const [regularData, boldData] = await Promise.all([
      readFile(regularPath),
      readFile(boldPath)
    ]);
    return [
      { data: regularData, name: 'Inter', style: 'normal' as const, weight: FONT_WEIGHT_REGULAR },
      { data: boldData, name: 'Inter', style: 'normal' as const, weight: FONT_WEIGHT_BOLD }
    ];
  }

  // Fallback: reuse any single font file in the directory for both weights.
  if (existsSync(fontsDir)) {
    const entries = await readdir(fontsDir);
    const fontFile = entries.find((name) => name.endsWith('.ttf') || name.endsWith('.otf'));
    if (fontFile) {
      const data = await readFile(`${fontsDir}/${fontFile}`);
      return [
        { data, name: 'Inter', style: 'normal' as const, weight: FONT_WEIGHT_REGULAR },
        { data, name: 'Inter', style: 'normal' as const, weight: FONT_WEIGHT_BOLD }
      ];
    }
  }

  return null;
}

export async function renderOgImage(params: OgImageParams, fonts: Font[], logoDataUri?: null | string): Promise<Buffer> {
  const markup = buildOgImageMarkup(params, logoDataUri ?? null);
  const svg = await satori(markup, {
    fonts,
    height: OG_HEIGHT,
    width: OG_WIDTH
  });

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: OG_WIDTH }
  });
  return resvg.render().asPng();
}

function buildBadgeMarkup(badge: string): Record<string, unknown> {
  return {
    props: {
      children: badge,
      style: {
        alignItems: 'center',
        background: ACCENT_BG,
        borderRadius: '20px',
        color: ACCENT_COLOR,
        display: 'flex',
        fontSize: `${String(BADGE_FONT_SIZE)}px`,
        fontWeight: BADGE_FONT_WEIGHT,
        padding: '6px 14px'
      }
    },
    type: 'div'
  };
}

function buildLogoMarkup(logoDataUri: string): Record<string, unknown> {
  return {
    props: {
      height: LOGO_DISPLAY_SIZE,
      src: logoDataUri,
      style: {
        height: `${String(LOGO_DISPLAY_SIZE)}px`,
        width: `${String(LOGO_DISPLAY_SIZE)}px`
      },
      width: LOGO_DISPLAY_SIZE
    },
    type: 'img'
  };
}

function buildSignatureMarkup(signature: string): Record<string, unknown> {
  return {
    props: {
      children: signature,
      style: {
        background: SIGNATURE_BG,
        borderRadius: '12px',
        color: ACCENT_COLOR,
        display: '-webkit-box',
        fontFamily: 'monospace',
        fontSize: `${String(SIGNATURE_FONT_SIZE)}px`,
        lineClamp: SIGNATURE_MAX_LINES,
        lineHeight: SIGNATURE_LINE_HEIGHT,
        marginBottom: '28px',
        overflow: 'hidden',
        padding: '16px 24px'
      }
    },
    type: 'div'
  };
}

function buildOgImageMarkup(params: OgImageParams, logoDataUri: null | string): Record<string, unknown> {
  const badgeNode = params.badge ? buildBadgeMarkup(params.badge) : null;
  const logoNode = logoDataUri ? buildLogoMarkup(logoDataUri) : null;

  // Top row: logo on the left, badge on the right.
  const topRowChildren: Record<string, unknown>[] = [];
  if (logoNode) {
    topRowChildren.push(logoNode);
  }
  topRowChildren.push({ props: { style: { flex: 1 } }, type: 'div' });
  if (badgeNode) {
    topRowChildren.push(badgeNode);
  }
  const topRow = {
    props: {
      children: topRowChildren,
      style: {
        alignItems: 'center',
        display: 'flex',
        marginBottom: '24px'
      }
    },
    type: 'div'
  };

  // Title
  const title = {
    props: {
      children: params.title,
      style: {
        color: TITLE_COLOR,
        fontSize: `${String(TITLE_FONT_SIZE)}px`,
        fontWeight: FONT_WEIGHT_BOLD,
        lineHeight: TITLE_LINE_HEIGHT,
        marginBottom: '20px',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    },
    type: 'div'
  };

  // Signature code block (between title and description) — omitted for pages with no signature.
  const signatureNode = params.signature ? buildSignatureMarkup(params.signature) : null;

  // Description
  const description = {
    props: {
      children: params.description ?? '',
      style: {
        color: DESCRIPTION_COLOR,
        flex: 1,
        fontSize: `${String(DESCRIPTION_FONT_SIZE)}px`,
        lineHeight: DESCRIPTION_LINE_HEIGHT,
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    },
    type: 'div'
  };

  // Footer with text branding (obsidian-dev-utils has no logo asset)
  const footer = {
    props: {
      children: [
        { props: { style: { flex: 1 } }, type: 'div' },
        {
          props: {
            children: BRAND_TEXT,
            style: {
              color: BRAND_COLOR,
              fontSize: `${String(BRAND_FONT_SIZE)}px`,
              fontWeight: FONT_WEIGHT_BOLD
            }
          },
          type: 'div'
        }
      ],
      style: {
        alignItems: 'flex-end',
        display: 'flex'
      }
    },
    type: 'div'
  };

  // Root container
  return {
    props: {
      children: [
        {
          props: {
            children: signatureNode ? [topRow, title, signatureNode, description] : [topRow, title, description],
            style: {
              display: 'flex',
              flex: 1,
              flexDirection: 'column'
            }
          },
          type: 'div'
        },
        footer
      ],
      style: {
        background: BACKGROUND_COLOR,
        borderLeft: `${String(BORDER_WIDTH)}px solid ${ACCENT_COLOR}`,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        justifyContent: 'space-between',
        padding: `${String(PADDING_TOP)}px ${String(PADDING_X)}px ${String(PADDING_BOTTOM)}px ${String(PADDING_X)}px`,
        width: '100%'
      }
    },
    type: 'div'
  };
}
