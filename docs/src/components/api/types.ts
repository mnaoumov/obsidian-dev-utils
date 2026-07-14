/**
 * Shared types for the API reference components.
 *
 * Unlike obsidian-typings, obsidian-dev-utils has no official/unofficial axis,
 * so there is no `ApiStatus` enum here. This module is kept as the shared home
 * for cross-component API types.
 */

export interface ParameterInfo {
  description: string;
  name: string;
  type: string;
}
