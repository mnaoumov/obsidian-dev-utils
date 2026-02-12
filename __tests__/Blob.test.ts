// @vitest-environment jsdom

import {
  describe,
  expect,
  it
} from 'vitest';

import {
  blobToArrayBuffer,
  blobToDataUrl,
  dataUrlToArrayBuffer,
  isImageFile
} from '../src/Blob.ts';

describe('dataUrlToArrayBuffer', () => {
  it('should convert a valid base64 data URL to an ArrayBuffer', () => {
    // "hello" in base64 is "aGVsbG8="
    const dataUrl = 'data:text/plain;base64,aGVsbG8=';
    const buffer = dataUrlToArrayBuffer(dataUrl);
    const view = new Uint8Array(buffer);
    const text = String.fromCharCode(...view);
    expect(text).toBe('hello');
  });

  it('should return an ArrayBuffer instance', () => {
    const dataUrl = 'data:text/plain;base64,dGVzdA==';
    const buffer = dataUrlToArrayBuffer(dataUrl);
    expect(buffer).toBeInstanceOf(ArrayBuffer);
  });

  it('should throw for invalid data URL without base64 part', () => {
    expect(() => dataUrlToArrayBuffer('data:text/plain')).toThrow('Invalid data URL');
  });

  it('should throw for empty base64 content', () => {
    const dataUrl = 'data:text/plain;base64,';
    expect(() => dataUrlToArrayBuffer(dataUrl)).toThrow('Invalid data URL');
  });

  it.each([
    [0, 0],
    [1, 1],
    [2, 2],
    [3, 255]
  ])('should correctly decode binary byte at index %i to %i', (index: number, expectedValue: number) => {
    // [0, 1, 2, 255] as base64 = "AAEC/w=="
    const dataUrl = 'data:application/octet-stream;base64,AAEC/w==';
    const buffer = dataUrlToArrayBuffer(dataUrl);
    const view = new Uint8Array(buffer);
    expect(view[index]).toBe(expectedValue);
  });
});

describe('isImageFile', () => {
  it('should return true for image/png type', () => {
    const file = new File([''], 'test.png', { type: 'image/png' });
    expect(isImageFile(file)).toBe(true);
  });

  it('should return true for image/jpeg type', () => {
    const file = new File([''], 'photo.jpg', { type: 'image/jpeg' });
    expect(isImageFile(file)).toBe(true);
  });

  it('should return true for image/gif type', () => {
    const file = new File([''], 'animation.gif', { type: 'image/gif' });
    expect(isImageFile(file)).toBe(true);
  });

  it('should return true for image/svg+xml type', () => {
    const file = new File([''], 'icon.svg', { type: 'image/svg+xml' });
    expect(isImageFile(file)).toBe(true);
  });

  it('should return false for text/plain type', () => {
    const file = new File([''], 'readme.txt', { type: 'text/plain' });
    expect(isImageFile(file)).toBe(false);
  });

  it('should return false for application/pdf type', () => {
    const file = new File([''], 'document.pdf', { type: 'application/pdf' });
    expect(isImageFile(file)).toBe(false);
  });

  it('should return false for empty type', () => {
    const file = new File([''], 'unknown', { type: '' });
    expect(isImageFile(file)).toBe(false);
  });
});

describe('blobToArrayBuffer', () => {
  it('should convert a text Blob to an ArrayBuffer', async () => {
    const blob = new Blob(['hello'], { type: 'text/plain' });
    const buffer = await blobToArrayBuffer(blob);
    expect(buffer).toBeInstanceOf(ArrayBuffer);
  });

  it('should preserve the content of the Blob', async () => {
    const blob = new Blob(['test'], { type: 'text/plain' });
    const buffer = await blobToArrayBuffer(blob);
    const text = new TextDecoder().decode(buffer);
    expect(text).toBe('test');
  });

  it('should handle an empty Blob', async () => {
    const blob = new Blob([], { type: 'text/plain' });
    const buffer = await blobToArrayBuffer(blob);
    expect(buffer.byteLength).toBe(0);
  });
});

describe('blobToDataUrl', () => {
  it('should convert a text Blob to a data URL', async () => {
    const blob = new Blob(['hello'], { type: 'text/plain' });
    const dataUrl = await blobToDataUrl(blob);
    expect(dataUrl).toContain('data:');
  });

  it('should produce a data URL starting with the expected prefix', async () => {
    const blob = new Blob(['test'], { type: 'text/plain' });
    const dataUrl = await blobToDataUrl(blob);
    expect(dataUrl.startsWith('data:text/plain')).toBe(true);
  });

  it('should contain base64 encoding', async () => {
    const blob = new Blob(['abc'], { type: 'text/plain' });
    const dataUrl = await blobToDataUrl(blob);
    expect(dataUrl).toContain(';base64,');
  });
});
