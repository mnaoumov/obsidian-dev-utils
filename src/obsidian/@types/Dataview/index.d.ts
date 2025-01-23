export type {
  DateTime,
  Duration
} from 'luxon';
export type { DataArray } from './api/data-array.d.ts';
export type { DataviewApi } from './api/plugin-api.d.ts';
export type {
  Failure,
  Result,
  Success
} from './api/result.d.ts';
export type {
  FullIndex,
  IndexMap,
  PrefixIndex
} from './data-index/index.d.ts';
export type {
  ListItem,
  PageMetadata
} from './data-model/markdown.d.ts';
export type {
  SListEntry,
  SMarkdownPage,
  STask
} from './data-model/serialized/markdown.d.ts';
export type {
  DataObject,
  Link,
  Literal,
  LiteralRepr,
  LiteralType,
  LiteralWrapper,
  Widget,
  WrappedLiteral
} from './data-model/value.d.ts';
export type {
  DATE_SHORTHANDS,
  DURATION_TYPES,
  EXPRESSION,
  ExpressionLanguage,
  KEYWORDS,
  parseField
} from './expression/parse.d.ts';
export type { QUERY_LANGUAGE } from './query/parse.d.ts';
export type { Query } from './query/query.d.ts';
import type { DataviewApi } from './api/plugin-api.d.ts';
import 'obsidian';
import type { App } from 'obsidian';
/**
 * Get the current Dataview API from the app if provided; if not, it is inferred from the global API object installed
 * on the window.
 */
export declare const getAPI: (app?: App) => DataviewApi | undefined;
/** Determine if Dataview is enabled in the given application. */
export declare const isPluginEnabled: (app: App) => boolean;
