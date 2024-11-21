/**
 * @packageDocumentation Async
 * Contains utility functions for Blob objects.
 */

import { throwExpression } from './Error.ts';

/**
 * Converts a base64 encoded string to an ArrayBuffer.
 *
 * @param code - The base64 encoded string.
 * @returns The decoded ArrayBuffer.
 */
export function base64ToArrayBuffer(code: string): ArrayBuffer {
  const parts = code.split(';base64,');
  const raw = window.atob(parts[1] ?? throwExpression(new Error('Invalid base64 string')));
  const rawLength = raw.length;

  const uInt8Array = new Uint8Array(rawLength);

  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }
  return uInt8Array.buffer;
}

/**
 * Converts a Blob object to an ArrayBuffer.
 *
 * @param blob - The Blob object to convert.
 * @returns A promise that resolves to an ArrayBuffer.
 */
export async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = (): void => {
      resolve(reader.result as ArrayBuffer);
    };
    reader.readAsArrayBuffer(blob);
  });
}

/**
 * Converts a Blob object to a JPEG ArrayBuffer with the specified quality.
 *
 * @param blob - The Blob object to convert.
 * @param jpegQuality - The quality of the JPEG image (0 to 1).
 * @returns A promise that resolves to an ArrayBuffer.
 */
export async function blobToJpegArrayBuffer(blob: Blob, jpegQuality: number): Promise<ArrayBuffer> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = (): void => {
      const image = new Image();
      image.onload = (): void => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) {
          throw new Error('Could not get 2D context.');
        }
        const imageWidth = image.width;
        const imageHeight = image.height;
        let data = '';

        canvas.width = imageWidth;
        canvas.height = imageHeight;

        context.fillStyle = '#fff';
        context.fillRect(0, 0, imageWidth, imageHeight);
        context.save();

        context.translate(imageWidth / 2, imageHeight / 2);
        context.drawImage(image, 0, 0, imageWidth, imageHeight, -imageWidth / 2, -imageHeight / 2, imageWidth, imageHeight);
        context.restore();

        data = canvas.toDataURL('image/jpeg', jpegQuality);

        const arrayBuffer = base64ToArrayBuffer(data);
        resolve(arrayBuffer);
      };

      image.src = reader.result as string;
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Checks if a given file is an image.
 *
 * @param file - The file to check.
 * @returns True if the file is an image, false otherwise.
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}
