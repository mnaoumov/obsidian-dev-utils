/**
 * @file
 *
 * Contains utility functions for Blob objects.
 */

import {
  extractJpegMetadataSegments,
  injectJpegMetadataSegments
} from './jpeg-metadata.ts';
import { assertNonNullable } from './type-guards.ts';

/**
 * Options for {@link blobToJpegArrayBuffer}.
 */
export interface BlobToJpegArrayBufferOptions {
  /**
   * Whether to carry the source image's metadata segments (EXIF, GPS, XMP, ICC profile) into the
   * re-encoded JPEG. Only has an effect when the source is a JPEG. Defaults to `false`, which is the
   * behavior a canvas re-encode has always had.
   */
  readonly shouldPreserveMetadata?: boolean | undefined;
}

/**
 * Converts a {@link Blob} object to an {@link ArrayBuffer}.
 *
 * @param blob - The Blob object to convert.
 * @returns A {@link Promise} that resolves to an {@link ArrayBuffer}.
 */
export async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return await blob.arrayBuffer();
}

/**
 * Converts a {@link Blob} object to a data URL.
 *
 * @param blob - The Blob object to convert.
 * @returns A {@link Promise} that resolves to a data URL.
 */
export async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise((resolve) => {
    const reader = new FileReader();
    reader.addEventListener('loadend', handleLoadEnd);
    reader.readAsDataURL(blob);

    function handleLoadEnd(): void {
      resolve(reader.result as string);
    }
  });
}

/**
 * Converts a {@link Blob} object to a JPEG ArrayBuffer with the specified quality.
 *
 * The conversion is a canvas re-encode, which keeps only the pixels — EXIF, GPS, XMP and the ICC
 * profile are dropped by construction. Pass {@link BlobToJpegArrayBufferOptions.shouldPreserveMetadata}
 * to carry those segments across from the source, which works only when the source is itself a JPEG:
 * nothing else stores them in a form that can be copied verbatim.
 *
 * @param blob - The Blob object to convert.
 * @param jpegQuality - The quality of the JPEG image (0 to 1).
 * @param options - Conversion options.
 * @returns A {@link Promise} that resolves to an {@link ArrayBuffer}.
 */
export async function blobToJpegArrayBuffer(blob: Blob, jpegQuality: number, options?: BlobToJpegArrayBufferOptions): Promise<ArrayBuffer> {
  const sourceSegments = options?.shouldPreserveMetadata
    ? extractJpegMetadataSegments(new Uint8Array(await blob.arrayBuffer()))
    : [];
  const dataUrl = await blobToDataUrl(blob);
  return new Promise((resolve) => {
    const image = new Image();
    image.addEventListener('load', handleLoad);
    image.src = dataUrl;

    function handleLoad(): void {
      // eslint-disable-next-line obsidianmd/prefer-create-el -- Agnostic module.
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      assertNonNullable(context, 'Could not get 2D context.');
      const imageWidth = image.width;
      const imageHeight = image.height;

      canvas.width = imageWidth;
      canvas.height = imageHeight;

      context.fillStyle = '#fff';
      context.fillRect(0, 0, imageWidth, imageHeight);
      context.save();

      const HALF = 0.5;
      context.translate(imageWidth * HALF, imageHeight * HALF);
      context.drawImage(image, 0, 0, imageWidth, imageHeight, -imageWidth * HALF, -imageHeight * HALF, imageWidth, imageHeight);
      context.restore();

      const jpegDataUrl = canvas.toDataURL('image/jpeg', jpegQuality);
      const arrayBuffer = dataUrlToArrayBuffer(jpegDataUrl);
      const withMetadata = injectJpegMetadataSegments(new Uint8Array(arrayBuffer), sourceSegments);
      resolve(withMetadata.buffer as ArrayBuffer);
    }
  });
}

/**
 * Converts a base64 encoded string to an {@link ArrayBuffer}.
 *
 * @param dataUrl - The data URL to convert.
 * @returns The decoded ArrayBuffer.
 */
export function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer {
  const parts = dataUrl.split(';base64,');
  const base64 = parts[1];
  if (!base64) {
    throw new Error('Invalid data URL');
  }

  const raw = atob(base64);
  const rawLength = raw.length;

  const uInt8Array = new Uint8Array(rawLength);

  for (let index = 0; index < rawLength; index++) {
    // eslint-disable-next-line unicorn/prefer-code-point -- `raw` is a binary string, one byte per code unit. `codePointAt` would combine a surrogate pair into a value above 255 and consume two positions, which is exactly the wrong reading here.
    uInt8Array[index] = raw.charCodeAt(index);
  }
  return uInt8Array.buffer;
}

/**
 * Checks if a given file is an image.
 *
 * @param file - The file to check.
 * @returns `true` if the file is an image, `false` otherwise.
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}
