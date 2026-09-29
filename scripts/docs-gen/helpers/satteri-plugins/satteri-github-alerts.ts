/**
 * @file
 *
 * Sätteri mdast plugin that turns GitHub alerts (`> [!NOTE]` ...) into Starlight asides.
 */

import type {
  Blockquote,
  Parents,
  Text
} from 'mdast';
import type {
  MdastPluginDefinition,
  MdastVisitorContext
} from 'satteri';

/**
 * The Starlight aside variant each GitHub alert type renders as.
 *
 * Starlight has four variants for GitHub's five types, so `IMPORTANT` and `WARNING` share `caution`, and
 * `CAUTION` - GitHub's most severe - takes `danger`. This is the mapping `starlight-github-alerts` uses.
 */
export const GITHUB_ALERT_ASIDE_VARIANTS: ReadonlyMap<string, string> = new Map([
  ['caution', 'danger'],
  ['important', 'caution'],
  ['note', 'note'],
  ['tip', 'tip'],
  ['warning', 'caution']
]);

const ALERT_MARKER_REG_EXP = /^\[!(?<Type>\w+)\][\r\n]*/;

interface Alert {
  markerLength: number;
  markerText: Text;
  variant: string;
}

/**
 * Sätteri mdast plugin that turns GitHub alerts into Starlight asides.
 *
 * The guides keep GitHub's `> [!TYPE]` syntax because it also renders on GitHub, where most people read
 * the repository. The site used to rely on `starlight-github-alerts` for the conversion, and on
 * Starlight `0.42` that plugin silently does nothing: it registers itself in front of an mdast plugin
 * NAMED `starlight-asides`, while Starlight now registers its asides as an unnamed factory, so the lookup
 * misses and the plugin returns without a word. Every alert then rendered as a plain blockquote opening
 * with the literal `[!WARNING]`.
 *
 * This plugin does the same conversion from the site's own `mdastPlugins`, which run before every plugin
 * Starlight appends: it replaces the blockquote with a `containerDirective` named after the aside variant,
 * exactly what `:::caution` parses to, and Starlight's own asides plugin then renders it.
 *
 * @returns The plugin definition.
 */
export function satteriGitHubAlerts(): MdastPluginDefinition {
  return {
    blockquote(node, context: MdastVisitorContext): void {
      const alert = parseAlert(node);
      if (alert === null) {
        return;
      }

      // GitHub does not nest alerts, so neither do we: an alert inside an alert stays a blockquote.
      if (hasAlertAncestor(node, context)) {
        return;
      }

      context.setProperty(alert.markerText, 'value', alert.markerText.value.slice(alert.markerLength).trimStart());
      context.replaceNode(node, {
        children: [...node.children],
        name: alert.variant,
        type: 'containerDirective'
      });
    },
    name: 'github-alerts'
  };
}

function hasAlertAncestor(node: Blockquote, context: MdastVisitorContext): boolean {
  let ancestor: Parents | undefined = context.parent(node);
  while (ancestor) {
    if (ancestor.type === 'blockquote' && parseAlert(ancestor) !== null) {
      return true;
    }

    ancestor = context.parent(ancestor);
  }

  return false;
}

function parseAlert(node: Blockquote): Alert | null {
  const [firstChild] = node.children;
  if (firstChild?.type !== 'paragraph') {
    return null;
  }

  const [firstGrandChild] = firstChild.children;
  if (firstGrandChild?.type !== 'text') {
    return null;
  }

  const match = ALERT_MARKER_REG_EXP.exec(firstGrandChild.value);
  const type = match?.groups?.['Type']?.toLowerCase();
  if (match === null || type === undefined) {
    return null;
  }

  const variant = GITHUB_ALERT_ASIDE_VARIANTS.get(type);
  if (variant === undefined) {
    return null;
  }

  return {
    markerLength: match[0].length,
    markerText: firstGrandChild,
    variant
  };
}
