/**
 * @file
 *
 * Resolves generated Open Graph image paths from documentation page metadata.
 */

import { relative } from 'node:path/posix';

/**
 * Resolves the public Open Graph image slug for a documentation page.
 *
 * @param frontmatter - The page's parsed frontmatter.
 * @param filePath - The page's source-file path.
 * @param contentDocsDir - The documentation content root.
 * @returns The case-preserved explicit slug, or a slug derived from the file path.
 */
export function getOgImagePageSlug(frontmatter: Record<string, unknown>, filePath: string, contentDocsDir: string): string {
  const slug = frontmatter['slug'];
  if (typeof slug === 'string') {
    return slug;
  }

  let filePathSlug = relative(contentDocsDir, filePath);
  filePathSlug = filePathSlug.replaceAll('\\', '/');
  filePathSlug = filePathSlug.replace(/\.\w+$/, '');
  filePathSlug = filePathSlug.replace(/(?:^|\/)index$/, '');
  return filePathSlug || 'index';
}
