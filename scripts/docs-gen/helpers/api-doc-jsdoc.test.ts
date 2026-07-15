import { Project } from 'ts-morph';
import {
  describe,
  expect,
  it
} from 'vitest';

import {
  extractClassInfo,
  extractFileOverview,
  extractInterfaceInfo,
  getDescription,
  getExamples,
  getParamDescriptions,
  getRemarks,
  getReturnDescription,
  getSince
} from './api-doc-jsdoc.ts';

describe('api-doc JSDoc extraction', () => {
  it('extracts class members, parameter metadata, and documentation tags', () => {
    const sourceFile = new Project({ useInMemoryFileSystem: true }).createSourceFile('alpha.ts', `/**
 * @file
 *
 * Alpha module overview.
 */
/** Alpha description.
 *
 * @remarks Alpha remarks.
 * @example alphaExample();
 * @since 1.0.0
 */
export class Alpha<T> {
  /** Creates Alpha.
   * @param value - Alpha value.
   */
  public constructor(value: T) {}
  /** Gets the value.
   * @returns - The current value.
   */
  public getValue(): T { throw new Error('not used'); }
  private hidden(): void {}
}`);
    const alpha = sourceFile.getClassOrThrow('Alpha');

    const info = extractClassInfo(alpha, 'alpha');

    expect(extractFileOverview(sourceFile)).toBe('Alpha module overview.');
    expect(info).toMatchObject({
      constructorInfo: { parameters: [{ description: 'Alpha value.', name: 'value', type: 'T' }] },
      description: 'Alpha description.',
      methods: [{ name: 'getValue', returnDescription: 'The current value.', returnType: 'T' }],
      remarks: 'Alpha remarks.',
      typeParameters: ['T']
    });
    expect(info.examples).toEqual(['alphaExample();']);
    expect(getSince(alpha)).toBe('1.0.0');
  });

  it('extracts interface documentation from declarations', () => {
    const sourceFile = new Project({ useInMemoryFileSystem: true }).createSourceFile('bravo.ts', `/** Bravo interface. */
export interface Bravo {
  /** A label. */
  label?: string;
}`);
    const bravo = sourceFile.getInterfaceOrThrow('Bravo');

    expect(extractInterfaceInfo(bravo, 'bravo')).toMatchObject({
      description: 'Bravo interface.',
      properties: [{ name: 'label?', type: 'string' }]
    });
    expect(getDescription(bravo)).toBe('Bravo interface.');
    expect(getExamples(bravo)).toEqual([]);
    expect(getParamDescriptions(bravo)).toEqual(new Map());
    expect(getRemarks(bravo)).toBe('');
    expect(getReturnDescription(bravo)).toBe('');
  });
});
