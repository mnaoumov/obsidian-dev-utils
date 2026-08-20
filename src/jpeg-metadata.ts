/**
 * @file
 *
 * Reads and re-attaches a JPEG's metadata segments.
 *
 * Re-encoding an image through a canvas keeps only pixels: EXIF, GPS, XMP and the ICC profile are all
 * dropped by construction, because the canvas holds decoded samples and nothing else. These helpers
 * lift the metadata segments off the original bytes so they can be spliced back into the re-encoded
 * JPEG.
 */

const APP0_MARKER = 0xE0;
const APP1_MARKER = 0xE1;
const APP2_MARKER = 0xE2;
const EOI_MARKER = 0xD9;
const MARKER_PREFIX = 0xFF;
const SOI_MARKER = 0xD8;
const SOS_MARKER = 0xDA;

const EXIF_HEADER = 'Exif\0\0';
const ICC_PROFILE_HEADER = 'ICC_PROFILE\0';
// eslint-disable-next-line unicorn/prefer-https -- The literal bytes Adobe writes into the `APP1` segment. It is a namespace identifier, never fetched, and rewriting it to `https` would stop XMP from ever matching.
const XMP_HEADER = 'http://ns.adobe.com/xap/1.0/\0';

/**
 * Bytes from the start of a segment to its payload: the two marker bytes plus the two length bytes.
 */
const SEGMENT_HEADER_SIZE = 4;

/**
 * The segment length field itself counts the two bytes it occupies.
 */
const SEGMENT_LENGTH_SIZE = 2;

/**
 * The `SOI` marker that opens every JPEG.
 */
const SOI_SIZE = 2;

const BIG_ENDIAN_TIFF_BYTE_ORDER = 0x4D_4D;
const IFD_ENTRY_SIZE = 12;
/**
 * Bytes from the start of an IFD entry to its inline value: tag (2) + type (2) + count (4).
 */
const IFD_ENTRY_VALUE_OFFSET = 8;
const IFD_ENTRY_COUNT_SIZE = 2;
const LITTLE_ENDIAN_TIFF_BYTE_ORDER = 0x49_49;
const ORIENTATION_TAG = 0x01_12;
const ORIENTATION_UPRIGHT = 1;
const TIFF_HEADER_SIZE = 8;
const TIFF_IFD_POINTER_OFFSET = 4;
const TIFF_MAGIC = 0x00_2A;
const TIFF_MAGIC_OFFSET = 2;

/**
 * Extracts the metadata segments of a JPEG.
 *
 * Returns each matching segment whole — marker, length and payload — so
 * {@link injectJpegMetadataSegments} can splice it into another JPEG untouched. Only the segments that
 * carry metadata are returned: the EXIF and XMP `APP1`s and the ICC profile `APP2`. `APP0` (JFIF) is
 * deliberately left behind, because the re-encoded JPEG writes its own.
 *
 * Returns an empty array for anything that is not a JPEG, including a truncated or malformed one — a
 * caller that cannot preserve metadata should carry on without it rather than fail.
 *
 * @param bytes - The bytes of the source image.
 * @returns The metadata segments, in the order they appeared.
 */
export function extractJpegMetadataSegments(bytes: Uint8Array): Uint8Array[] {
  if (!checkIsJpeg(bytes)) {
    return [];
  }

  const view = createView(bytes);
  const segments: Uint8Array[] = [];
  let offset = SOI_SIZE;

  while (offset + SEGMENT_HEADER_SIZE <= bytes.length) {
    if (bytes[offset] !== MARKER_PREFIX) {
      break;
    }

    const marker = bytes[offset + 1];
    if (marker === SOS_MARKER || marker === EOI_MARKER) {
      break;
    }

    const segmentLength = view.getUint16(offset + SEGMENT_LENGTH_SIZE);
    const segmentEnd = offset + SEGMENT_LENGTH_SIZE + segmentLength;
    if (segmentLength < SEGMENT_LENGTH_SIZE || segmentEnd > bytes.length) {
      break;
    }

    if (checkIsMetadataSegment(bytes, offset, marker)) {
      segments.push(bytes.slice(offset, segmentEnd));
    }

    offset = segmentEnd;
  }

  return segments;
}

/**
 * Splices metadata segments into a JPEG.
 *
 * The segments go directly after the `SOI` and the re-encoded JPEG's own `APP0`, which is where a
 * reader expects to find them.
 *
 * Every copied EXIF block has its orientation tag reset to upright. The canvas decode already applied
 * the original orientation to the pixels, so carrying the tag across verbatim would rotate the image a
 * second time — the one piece of metadata that is wrong to preserve as-is.
 *
 * @param jpegBytes - The bytes of the re-encoded JPEG.
 * @param segments - The segments returned by {@link extractJpegMetadataSegments}.
 * @returns The JPEG with the segments spliced in, or the input unchanged when there is nothing to add
 *   or the input is not a JPEG.
 */
export function injectJpegMetadataSegments(jpegBytes: Uint8Array, segments: readonly Uint8Array[]): Uint8Array {
  if (segments.length === 0 || !checkIsJpeg(jpegBytes)) {
    return jpegBytes;
  }

  const normalizedSegments = segments.map((segment) => normalizeOrientation(segment));
  const insertAt = findInsertOffset(jpegBytes);
  const addedLength = normalizedSegments.reduce((total, segment) => total + segment.length, 0);
  const result = new Uint8Array(jpegBytes.length + addedLength);

  result.set(jpegBytes.subarray(0, insertAt), 0);
  let writeAt = insertAt;
  for (const segment of normalizedSegments) {
    result.set(segment, writeAt);
    writeAt += segment.length;
  }
  result.set(jpegBytes.subarray(insertAt), writeAt);

  return result;
}

function checkIsJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= SOI_SIZE && bytes[0] === MARKER_PREFIX && bytes[1] === SOI_MARKER;
}

function checkIsMetadataSegment(bytes: Uint8Array, offset: number, marker: number | undefined): boolean {
  const payloadOffset = offset + SEGMENT_HEADER_SIZE;
  if (marker === APP1_MARKER) {
    return checkMatchesHeader(bytes, payloadOffset, EXIF_HEADER) || checkMatchesHeader(bytes, payloadOffset, XMP_HEADER);
  }
  if (marker === APP2_MARKER) {
    return checkMatchesHeader(bytes, payloadOffset, ICC_PROFILE_HEADER);
  }
  return false;
}

function checkMatchesHeader(bytes: Uint8Array, offset: number, header: string): boolean {
  if (offset + header.length > bytes.length) {
    return false;
  }
  for (let index = 0; index < header.length; index++) {
    if (bytes[offset + index] !== header.codePointAt(index)) {
      return false;
    }
  }
  return true;
}

function createView(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function findInsertOffset(jpegBytes: Uint8Array): number {
  if (SOI_SIZE + SEGMENT_HEADER_SIZE > jpegBytes.length) {
    return SOI_SIZE;
  }
  if (jpegBytes[SOI_SIZE] !== MARKER_PREFIX || jpegBytes[SOI_SIZE + 1] !== APP0_MARKER) {
    return SOI_SIZE;
  }

  const app0End = SOI_SIZE + SEGMENT_LENGTH_SIZE + createView(jpegBytes).getUint16(SOI_SIZE + SEGMENT_LENGTH_SIZE);
  return app0End > jpegBytes.length ? SOI_SIZE : app0End;
}

function normalizeOrientation(segment: Uint8Array): Uint8Array {
  if (segment[1] !== APP1_MARKER || !checkMatchesHeader(segment, SEGMENT_HEADER_SIZE, EXIF_HEADER)) {
    return segment;
  }

  const tiffOffset = SEGMENT_HEADER_SIZE + EXIF_HEADER.length;
  if (tiffOffset + TIFF_HEADER_SIZE > segment.length) {
    return segment;
  }

  const view = createView(segment);
  const byteOrder = view.getUint16(tiffOffset);
  const isLittleEndian = byteOrder === LITTLE_ENDIAN_TIFF_BYTE_ORDER;
  if (!isLittleEndian && byteOrder !== BIG_ENDIAN_TIFF_BYTE_ORDER) {
    return segment;
  }

  if (view.getUint16(tiffOffset + TIFF_MAGIC_OFFSET, isLittleEndian) !== TIFF_MAGIC) {
    return segment;
  }

  const ifdOffset = tiffOffset + view.getUint32(tiffOffset + TIFF_IFD_POINTER_OFFSET, isLittleEndian);
  if (ifdOffset + IFD_ENTRY_COUNT_SIZE > segment.length) {
    return segment;
  }

  const entryCount = view.getUint16(ifdOffset, isLittleEndian);
  const entriesOffset = ifdOffset + IFD_ENTRY_COUNT_SIZE;
  if (entriesOffset + entryCount * IFD_ENTRY_SIZE > segment.length) {
    return segment;
  }

  const result = new Uint8Array(segment);
  const resultView = createView(result);
  for (let index = 0; index < entryCount; index++) {
    const entryOffset = entriesOffset + index * IFD_ENTRY_SIZE;
    if (resultView.getUint16(entryOffset, isLittleEndian) === ORIENTATION_TAG) {
      resultView.setUint16(entryOffset + IFD_ENTRY_VALUE_OFFSET, ORIENTATION_UPRIGHT, isLittleEndian);
    }
  }

  return result;
}
