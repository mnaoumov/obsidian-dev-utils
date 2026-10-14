import type {
  DateTime,
  Duration
} from 'luxon';
import * as P from 'parsimmon';
import type { Result } from '../api/result.d.ts';
import type {
  CsvSource,
  FolderSource,
  NegatedSource,
  Source,
  TagSource
} from '../data-index/source.d.ts';
import type {
  Link,
  Literal
} from '../data-model/value.d.ts';
import type {
  BinaryOp,
  Field,
  LambdaField,
  ListField,
  LiteralField,
  ObjectField,
  VariableField
} from './field.d.ts';
/** Provides a lookup table for unit durations of the given type. */
export declare const DURATION_TYPES: {
  year: Duration;
  years: Duration;
  yr: Duration;
  yrs: Duration;
  month: Duration;
  months: Duration;
  mo: Duration;
  mos: Duration;
  week: Duration;
  weeks: Duration;
  wk: Duration;
  wks: Duration;
  w: Duration;
  day: Duration;
  days: Duration;
  d: Duration;
  hour: Duration;
  hours: Duration;
  hr: Duration;
  hrs: Duration;
  h: Duration;
  minute: Duration;
  minutes: Duration;
  min: Duration;
  mins: Duration;
  m: Duration;
  second: Duration;
  seconds: Duration;
  sec: Duration;
  secs: Duration;
  s: Duration;
};
/** Shorthand for common dates (relative to right now). */
export declare const DATE_SHORTHANDS: {
  now: () => DateTime;
  today: () => DateTime;
  yesterday: () => DateTime;
  tomorrow: () => DateTime;
  sow: () => DateTime;
  'start-of-week': () => DateTime;
  eow: () => DateTime;
  'end-of-week': () => DateTime;
  soy: () => DateTime;
  'start-of-year': () => DateTime;
  eoy: () => DateTime;
  'end-of-year': () => DateTime;
  som: () => DateTime;
  'start-of-month': () => DateTime;
  eom: () => DateTime;
  'end-of-month': () => DateTime;
};
/**
 * Keywords which cannot be used as variables directly. Use `row.<thing>` if it is a variable you have defined and want
 * to access.
 */
export declare const KEYWORDS: string[];
/** Attempt to parse the inside of a link to pull out display name, subpath, etc. */
export declare function parseInnerLink(rawlink: string): Link;
/** Create a left-associative binary parser which parses the given sub-element and separator. Handles whitespace. */
export declare function createBinaryParser<T, U>(child: P.Parser<T>, sep: P.Parser<U>, combine: (a: T, b: U, c: T) => T): P.Parser<T>;
export declare function chainOpt<T>(base: P.Parser<T>, ...funcs: ((r: T) => P.Parser<T>)[]): P.Parser<T>;
export type PostfixFragment = {
  type: 'dot';
  field: string;
} | {
  type: 'index';
  field: Field;
} | {
  type: 'function';
  fields: Field[];
};
export interface ExpressionLanguage {
  number: number;
  string: string;
  escapeCharacter: string;
  bool: boolean;
  tag: string;
  identifier: string;
  link: Link;
  embedLink: Link;
  rootDate: DateTime;
  dateShorthand: keyof typeof DATE_SHORTHANDS;
  date: DateTime;
  datePlus: DateTime;
  durationType: keyof typeof DURATION_TYPES;
  duration: Duration;
  rawNull: string;
  binaryPlusMinus: BinaryOp;
  binaryMulDiv: BinaryOp;
  binaryCompareOp: BinaryOp;
  binaryBooleanOp: BinaryOp;
  tagSource: TagSource;
  csvSource: CsvSource;
  folderSource: FolderSource;
  parensSource: Source;
  atomSource: Source;
  linkIncomingSource: Source;
  linkOutgoingSource: Source;
  negateSource: NegatedSource;
  binaryOpSource: Source;
  source: Source;
  variableField: VariableField;
  numberField: LiteralField;
  boolField: LiteralField;
  stringField: LiteralField;
  dateField: LiteralField;
  durationField: LiteralField;
  linkField: LiteralField;
  nullField: LiteralField;
  listField: ListField;
  objectField: ObjectField;
  atomInlineField: Literal;
  inlineFieldList: Literal[];
  inlineField: Literal;
  negatedField: Field;
  atomField: Field;
  indexField: Field;
  lambdaField: LambdaField;
  dotPostfix: PostfixFragment;
  indexPostfix: PostfixFragment;
  functionPostfix: PostfixFragment;
  binaryMulDivField: Field;
  binaryPlusMinusField: Field;
  binaryCompareField: Field;
  binaryBooleanField: Field;
  binaryOpField: Field;
  parensField: Field;
  field: Field;
}
export declare const EXPRESSION: P.TypedLanguage<ExpressionLanguage>;
/**
 * Attempt to parse a field from the given text, returning a string error if the
 * parse failed.
 */
export declare function parseField(text: string): Result<Field, string>;
