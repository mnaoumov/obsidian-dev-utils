/**
 * @packageDocumentation Canvas
 * Utility functions for working with canvas files.
 */

/**
 * Represents a link within a file node in a canvas.
 */
export interface CanvasFileLink extends CanvasLink {
  /**
   * The type of link.
   */
  type: 'file';
}

/**
 * Represents a link in a canvas.
 */
export interface CanvasLink {
  /**
   * The index of the node.
   */
  nodeIndex: number;

  /**
   * The type of link.
   */
  type: 'file' | 'text';
}

/**
 * Represents a link within a text node in a canvas.
 */
export interface CanvasTextLink extends CanvasLink {
  /**
   * The index of the link within the text node.
   */
  linkIndex: number;

  /**
   * The type of link.
   */
  type: 'text';
}

/**
 * Checks if a canvas link is a canvas file link.
 *
 * @param link - The link to check.
 * @returns True if the canvas link is a canvas file link, false otherwise.
 */
export function isCanvasFileLink(link: CanvasLink): link is CanvasFileLink {
  return link.type === 'file';
}

/**
 * Checks if a canvas link is a canvas text link.
 *
 * @param link - The link to check.
 * @returns True if the canvas link is a canvas text link, false otherwise.
 */
export function isCanvasTextLink(link: CanvasLink): link is CanvasTextLink {
  return link.type === 'text';
}

/**
 * Parses a canvas link key.
 *
 * @param key - The key to parse.
 * @returns The parsed canvas link, or null if the key is invalid.
 */
export function parseCanvasLinkKey(key: string): CanvasLink | null {
  const keyParts = key.split('.');
  const NODES_PART_INDEX = 0;
  const NODE_INDEX_PART_INDEX = 1;
  const NODE_TYPE_PART_INDEX = 2;
  const LINK_INDEX_PART_INDEX = 3;

  if (keyParts[NODES_PART_INDEX] !== 'nodes') {
    return null;
  }

  const nodeIndex = parseInt(keyParts[NODE_INDEX_PART_INDEX] ?? '', 10);
  if (isNaN(nodeIndex)) {
    return null;
  }

  switch (keyParts[NODE_TYPE_PART_INDEX]) {
    case 'file':
      if (keyParts.length !== NODE_TYPE_PART_INDEX + 1) {
        return null;
      }

      return {
        nodeIndex,
        type: 'file'
      } as CanvasFileLink;
    case 'text': {
      const linkIndex = parseInt(keyParts[LINK_INDEX_PART_INDEX] ?? '', 10);
      if (isNaN(linkIndex)) {
        return null;
      }

      if (keyParts.length !== LINK_INDEX_PART_INDEX + 1) {
        return null;
      }

      return {
        linkIndex,
        nodeIndex,
        type: 'text'
      } as CanvasTextLink;
    }
    default:
      return null;
  }
}
