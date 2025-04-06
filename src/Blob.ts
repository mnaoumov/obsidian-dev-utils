/**
 * @packageDocumentation Async
 * Contains utility functions for Blob objects.
 */

/**
 * Converts a {@link Blob} object to an {@link ArrayBuffer}.
 *
 * @param blob - The Blob object to convert.
 * @returns A {@link Promise} that resolves to an {@link ArrayBuffer}.
 */
export async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return await new Promise((resolve) => {
    const reader = new FileReader();
    reader.addEventListener('loadend', handleLoadEnd);
    reader.readAsArrayBuffer(blob);

    function handleLoadEnd(): void {
      resolve(reader.result as ArrayBuffer);
    }
  });
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
 * @param blob - The Blob object to convert.
 * @param jpegQuality - The quality of the JPEG image (0 to 1).
 * @returns A {@link Promise} that resolves to an {@link ArrayBuffer}.
 */
export async function blobToJpegArrayBuffer(blob: Blob, jpegQuality: number): Promise<ArrayBuffer> {
  const dataUrl = await blobToDataUrl(blob);
  return new Promise((resolve) => {
    const image = new Image();
    image.addEventListener('load', handleLoad);
    image.src = dataUrl;

    function handleLoad(): void {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Could not get 2D context.');
      }
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
      resolve(arrayBuffer);
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

  const raw = window.atob(base64);
  const rawLength = raw.length;

  const uInt8Array = new Uint8Array(rawLength);

  for (let i = 0; i < rawLength; i++) {
    uInt8Array[i] = raw.charCodeAt(i);
  }
  return uInt8Array.buffer;
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
