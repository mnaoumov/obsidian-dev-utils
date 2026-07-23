/**
 * @file
 *
 * Contains a utility function for extracting references from a canvas (`.canvas`) file.
 */

import type { App } from 'obsidian';
import type { CanvasData } from 'obsidian/canvas.d.ts';

import type { PathOrFile } from './file-system.ts';
import type {
  CanvasFileNodeReference,
  CanvasReference,
  CanvasTextNodeReference
} from './reference.ts';

import { fixFrontmatterMarkdownLinks } from './link.ts';
import {
  getLinks,
  parseMetadata
} from './metadata-cache.ts';
import { readSafe } from './vault.ts';

/**
 * Extracts the outgoing references of a canvas (`.canvas`) file.
 *
 * Obsidian does not index canvas links into the per-file metadata cache, so a canvas file's
 * {@link https://docs.obsidian.md/Reference/TypeScript+API/CachedMetadata | CachedMetadata} is empty and the
 * usual cache-based readers return nothing for it. This helper reads the canvas JSON directly and returns
 * both its file-node links and its text-node embeds as {@link CanvasReference}s.
 *
 * The returned references carry the `nodeIndex`/`type` (and, for text nodes, the `originalReference`) that
 * the canvas-aware write path needs, so a consumer can move a canvas-referenced attachment and rewrite the
 * canvas by composing `referenceToFileChange` (from `./reference.ts`) with `applyFileChanges` (from
 * `./file-change.ts`).
 *
 * @param app - The Obsidian app instance.
 * @param pathOrFile - The canvas file (or its path) to extract references from.
 * @returns A {@link Promise} that resolves to the canvas references, or an empty array when the file is
 * missing or its content is not valid canvas JSON.
 */
export async function getCanvasReferences(app: App, pathOrFile: PathOrFile): Promise<CanvasReference[]> {
  const content = await readSafe(app, pathOrFile);
  if (content === null) {
    return [];
  }

  let partialCanvasData: null | Partial<CanvasData>;
  try {
    partialCanvasData = JSON.parse(content) as null | Partial<CanvasData>;
  } catch {
    return [];
  }

  const canvasData = partialCanvasData?.nodes
    ? partialCanvasData as CanvasData
    : {
      edges: [],
      nodes: []
    };

  const references: CanvasReference[] = [];

  for (const [nodeIndex, node] of canvasData.nodes.entries()) {
    switch (node.type) {
      case 'file': {
        const canvasFileNodeReference: CanvasFileNodeReference = {
          isCanvas: true,
          key: `nodes.${String(nodeIndex)}.file`,
          link: node.file,
          nodeIndex,
          original: node.file,
          type: 'file'
        };
        references.push(canvasFileNodeReference);
        break;
      }
      case 'text': {
        const metadata = await parseMetadata(app, node.text);
        if (app.plugins.getPlugin('frontmatter-markdown-links')) {
          fixFrontmatterMarkdownLinks(metadata);
        }
        const links = getLinks({ cache: metadata });
        for (const [linkIndex, link] of links.entries()) {
          const canvasTextNodeReference: CanvasTextNodeReference = {
            isCanvas: true,
            key: `nodes.${String(nodeIndex)}.text.${String(linkIndex)}`,
            link: link.link,
            nodeIndex,
            original: link.original,
            originalReference: link,
            type: 'text'
          };
          references.push(canvasTextNodeReference);
        }
        break;
      }
      default:
        break;
    }
  }

  return references;
}
