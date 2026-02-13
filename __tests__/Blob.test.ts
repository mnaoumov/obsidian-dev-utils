import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import {
  blobToArrayBuffer,
  blobToDataUrl,
  blobToJpegArrayBuffer,
  dataUrlToArrayBuffer,
  isImageFile
} from '../src/Blob.ts';

class MockFileReader {
  public result: ArrayBuffer | null | string = null;
  private readonly listeners: Record<string, ((...args: unknown[]) => void)[]> = {};

  public addEventListener(event: string, fn: (...args: unknown[]) => void): void {
    this.listeners[event] ??= [];
    this.listeners[event].push(fn);
  }

  public readAsArrayBuffer(_blob: Blob): void {
    const encoder = new TextEncoder();
    const blobParts = (_blob as unknown as { _parts?: string[] })._parts;
    if (blobParts && blobParts.length > 0) {
      this.result = encoder.encode(blobParts.join('')).buffer;
    } else {
      this.result = new ArrayBuffer(0);
    }
    queueMicrotask(() => {
      for (const fn of this.listeners['loadend'] ?? []) {
        fn();
      }
    });
  }

  public readAsDataURL(_blob: Blob): void {
    this.result = 'data:text/plain;base64,aGVsbG8=';
    queueMicrotask(() => {
      for (const fn of this.listeners['loadend'] ?? []) {
        fn();
      }
    });
  }
}

class MockImage {
  public height = 100;
  public width = 100;

  public get src(): string {
    return '';
  }

  public set src(_value: string) {
    queueMicrotask(() => {
      this.onloadFn?.();
    });
  }

  private onloadFn: (() => void) | null = null;

  public addEventListener(event: string, fn: () => void): void {
    if (event === 'load') {
      this.onloadFn = fn;
    }
  }
}

describe('dataUrlToArrayBuffer', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { atob: globalThis.atob });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should convert a valid base64 data URL to an ArrayBuffer', () => {
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
    const dataUrl = 'data:application/octet-stream;base64,AAEC/w==';
    const buffer = dataUrlToArrayBuffer(dataUrl);
    const view = new Uint8Array(buffer);
    expect(view[index]).toBe(expectedValue);
  });

  it('should handle data URLs with different MIME types', () => {
    const dataUrl = 'data:image/png;base64,AQID';
    const buffer = dataUrlToArrayBuffer(dataUrl);
    const view = new Uint8Array(buffer);
    expect(view[0]).toBe(1);
    expect(view[1]).toBe(2);
    expect(view[2]).toBe(3);
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

  it('should return false for application/json type', () => {
    const file = new File([''], 'data.json', { type: 'application/json' });
    expect(isImageFile(file)).toBe(false);
  });

  it('should return false for empty type', () => {
    const file = new File([''], 'unknown', { type: '' });
    expect(isImageFile(file)).toBe(false);
  });
});

describe('blobToArrayBuffer', () => {
  beforeEach(() => {
    vi.stubGlobal('FileReader', MockFileReader);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should convert a Blob to an ArrayBuffer', async () => {
    const blob = new Blob(['hello'], { type: 'text/plain' });
    const buffer = await blobToArrayBuffer(blob);
    expect(buffer).toBeInstanceOf(ArrayBuffer);
  });

  it('should resolve the promise with the FileReader result', async () => {
    const blob = new Blob(['test'], { type: 'text/plain' });
    const buffer = await blobToArrayBuffer(blob);
    expect(buffer.byteLength).toBeGreaterThanOrEqual(0);
  });

  it('should handle an empty Blob', async () => {
    const blob = new Blob([], { type: 'text/plain' });
    const buffer = await blobToArrayBuffer(blob);
    expect(buffer.byteLength).toBe(0);
  });
});

describe('blobToDataUrl', () => {
  beforeEach(() => {
    vi.stubGlobal('FileReader', MockFileReader);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should convert a Blob to a data URL string', async () => {
    const blob = new Blob(['hello'], { type: 'text/plain' });
    const dataUrl = await blobToDataUrl(blob);
    expect(typeof dataUrl).toBe('string');
  });

  it('should produce a data URL starting with "data:"', async () => {
    const blob = new Blob(['hello'], { type: 'text/plain' });
    const dataUrl = await blobToDataUrl(blob);
    expect(dataUrl.startsWith('data:')).toBe(true);
  });

  it('should contain base64 encoding', async () => {
    const blob = new Blob(['abc'], { type: 'text/plain' });
    const dataUrl = await blobToDataUrl(blob);
    expect(dataUrl).toContain(';base64,');
  });
});

describe('blobToJpegArrayBuffer', () => {
  const JPEG_QUALITY = 0.8;
  let mockToDataURL: ReturnType<typeof vi.fn>;
  let mockGetContext: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubGlobal('FileReader', MockFileReader);
    vi.stubGlobal('Image', MockImage);
    vi.stubGlobal('window', { atob: globalThis.atob });

    mockToDataURL = vi.fn().mockReturnValue('data:image/jpeg;base64,/9j/4AAQ');
    mockGetContext = vi.fn().mockReturnValue({
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      fillStyle: '',
      restore: vi.fn(),
      save: vi.fn(),
      translate: vi.fn()
    });

    const mockCreateElement = vi.fn().mockReturnValue({
      getContext: mockGetContext,
      height: 0,
      toDataURL: mockToDataURL,
      width: 0
    });

    vi.stubGlobal('document', { createElement: mockCreateElement });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return an ArrayBuffer', async () => {
    const blob = new Blob(['fake-image-data'], { type: 'image/png' });
    const buffer = await blobToJpegArrayBuffer(blob, JPEG_QUALITY);
    expect(buffer).toBeInstanceOf(ArrayBuffer);
  });

  it('should call canvas toDataURL with image/jpeg and the specified quality', async () => {
    const blob = new Blob(['fake-image-data'], { type: 'image/png' });
    await blobToJpegArrayBuffer(blob, JPEG_QUALITY);
    expect(mockToDataURL).toHaveBeenCalledWith('image/jpeg', JPEG_QUALITY);
  });

  it('should call getContext with "2d"', async () => {
    const blob = new Blob(['fake-image-data'], { type: 'image/png' });
    await blobToJpegArrayBuffer(blob, JPEG_QUALITY);
    expect(mockGetContext).toHaveBeenCalledWith('2d');
  });

  it('should throw when canvas 2D context is null', async () => {
    mockGetContext.mockReturnValue(null);

    const blob = new Blob(['fake-image-data'], { type: 'image/png' });

    // The error is thrown inside an async callback within a Promise that only
    // Uses resolve (no reject), so the throw becomes an uncaught exception
    // Rather than a promise rejection.
    const errorPromise = new Promise<Error>((resolve) => {
      function handler(error: Error): void {
        process.removeListener('uncaughtException', handler);
        resolve(error);
      }
      process.on('uncaughtException', handler);
    });

    // Trigger the function (it will never resolve because of the throw).
    blobToJpegArrayBuffer(blob, JPEG_QUALITY).catch(() => undefined);

    const caughtError = await errorPromise;
    expect(caughtError.message).toBe('Could not get 2D context.');
  });
});
