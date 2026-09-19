/**
 * @file
 *
 * Sätteri mdast plugin that converts absolute internal links to relative links.
 */

import type {
  MdastPluginDefinition,
  MdastVisitorContext
} from 'satteri';

import { posix } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Sätteri mdast plugin that converts absolute internal links to relative links.
 *
 * The generator emits markdown files with absolute links that embed the Astro config's `base` path
 * (e.g., `/obsidian-dev-utils/api/...`). When the base path is overridden at build time, those links
 * break because they still reference the config-time base.
 *
 * This plugin strips the known base prefix, computes a relative path from the current file to the
 * target, and rewrites the link. Relative links are also skipped by `starlight-links-validator`
 * (`errorOnRelativeLinks: false`).
 *
 * Sätteri is Astro's default Markdown processor as of Astro 7.3, and `markdown.remarkPlugins` now
 * runs only on the separate `unified` processor from `@astrojs/markdown-remark` - which is no longer
 * installed. This is the same rewrite expressed against Sätteri's mdast visitor: a `link` visitor
 * rather than a `unist-util-visit` walk, `context.fileURL` rather than `file.history[0]`, and
 * `context.setProperty` rather than assigning `node.url`, since the tree lives in Rust and mutations
 * are recorded as commands rather than applied in place.
 */
export function satteriRelativeLinks(base: string): MdastPluginDefinition {
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;

  // The definition is reused across documents, so the slug is memoized per file rather than per link.
  // Every link on a page resolves the same one, and an API page can carry hundreds.
  let cachedFileHref: null | string = null;
  let cachedSlug: null | string = null;

  return {
    link(node, context: MdastVisitorContext): void {
      if (!node.url.startsWith(normalizedBase)) {
        return;
      }

      const currentSlug = getCurrentSlug(context);
      if (!currentSlug) {
        return;
      }

      const stripped = node.url.slice(normalizedBase.length);
      const [pathPart = '', ...anchorParts] = stripped.split('#');
      const anchor = anchorParts.length > 0 ? `#${anchorParts.join('#')}` : '';

      const targetSlug = pathPart.replace(/\/$/, '');
      // Use the slug itself as the "directory" — each page gets its own URL directory
      // E.g., slug "api/.../someFunction" → URL "/api/.../someFunction/"
      let relativePath = posix.relative(currentSlug, targetSlug);
      if (relativePath === '') {
        // Self-link: the target IS the current page (e.g. a function linking `this` to its own page).
        // Preserve a same-page fragment, otherwise point at the current directory. Building `./` and
        // `/` here would emit `.//`, which resolves to a non-existent `page//` URL and 404s.
        context.setProperty(node, 'url', anchor === '' ? './' : anchor);
        return;
      }

      if (!relativePath.startsWith('.')) {
        relativePath = `./${relativePath}`;
      }

      context.setProperty(node, 'url', `${relativePath}/${anchor}`);
    },
    name: 'relative-links'
  };

  function getCurrentSlug(context: MdastVisitorContext): null | string {
    const fileUrl = context.fileURL;
    if (!fileUrl) {
      return null;
    }

    if (fileUrl.href !== cachedFileHref) {
      cachedFileHref = fileUrl.href;
      cachedSlug = getContentSlug(fileURLToPath(fileUrl));
    }

    return cachedSlug;
  }
}

/**
 * Extracts the content-relative path from an absolute file path, preserving case.
 *
 * Given `.../content/docs/api/.../Foo.md`, returns `api/.../Foo`.
 */
function getContentSlug(filePath: string): null | string {
  const normalized = filePath.replaceAll('\\', '/');
  const marker = 'content/docs/';
  const markerIndex = normalized.indexOf(marker);
  if (markerIndex === -1) {
    return null;
  }

  const relative = normalized.slice(markerIndex + marker.length);
  const withoutExtension = relative.replace(/\.\w+$/, '');
  // Strip trailing /index — index pages represent the directory, not a child
  return withoutExtension.replace(/\/index$/, '');
}
