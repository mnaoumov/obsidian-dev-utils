/**
 * @file
 *
 * Adds per-page Open Graph and Twitter image metadata.
 */

import type { APIContext } from 'astro';

interface OgImageMetaTag {
  attrs: OgImageMetaTagAttributes;
  tag: 'meta';
}

interface OgImageMetaTagAttributes {
  content: string;
  name?: string;
  property?: string;
}

interface StarlightLocals {
  starlightRoute: StarlightRoute;
}

interface StarlightRoute {
  head: OgImageMetaTag[];
  id: string;
}

/**
 * Adds Open Graph and Twitter image metadata to a Starlight documentation response.
 *
 * @param context - Astro's request context.
 */
export function onRequest(context: APIContext): void {
  // Starlight sets this documented route-data value before invoking user middleware.
  const { starlightRoute } = context.locals as StarlightLocals;
  const { id } = starlightRoute;
  const slug = id
    .replace(/\/index$/, '')
    .replace(/\.\w+$/, '');
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const origin = context.url.origin;
  const ogImageUrl = `${origin}${base}/og/${slug || 'index'}.png`;

  starlightRoute.head.push(
    { attrs: { content: ogImageUrl, property: 'og:image' }, tag: 'meta' },
    { attrs: { content: '1200', property: 'og:image:width' }, tag: 'meta' },
    { attrs: { content: '630', property: 'og:image:height' }, tag: 'meta' },
    { attrs: { content: ogImageUrl, name: 'twitter:image' }, tag: 'meta' }
  );
}
