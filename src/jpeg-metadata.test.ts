import {
  describe,
  expect,
  it
} from 'vitest';

import {
  extractJpegMetadataSegments,
  injectJpegMetadataSegments
} from './jpeg-metadata.ts';

const APP0_MARKER = 0xE0;
const APP1_MARKER = 0xE1;
const APP2_MARKER = 0xE2;
const APP3_MARKER = 0xE3;
const EOI_MARKER = 0xD9;
const MARKER_PREFIX = 0xFF;
const SOI_MARKER = 0xD8;
const SOS_MARKER = 0xDA;

const EXIF_HEADER = 'Exif\0\0';
const ICC_PROFILE_HEADER = 'ICC_PROFILE\0';
// eslint-disable-next-line unicorn/prefer-https -- Must be byte-for-byte what the source module looks for. See the matching note there.
const XMP_HEADER = 'http://ns.adobe.com/xap/1.0/\0';

const ORIENTATION_TAG = 0x01_12;
const SHORT_TYPE = 3;
/**
 * One more than the largest byte, so `% BYTE_BASE` takes the low byte and `/ BYTE_BASE` the high one.
 */
const BYTE_BASE = 256;

function bytesOf(text: string): number[] {
  return Array.from(text, (character) => character.codePointAt(0) ?? 0);
}

/**
 * Builds a minimal EXIF `APP1` payload holding a single IFD0 entry, so the orientation rewrite has
 * something real to walk. Little-endian, because that is what phone cameras emit.
 */
function exifPayload(orientation: number): number[] {
  const TIFF_HEADER = [
    0x49,
    0x49, // 'II' -- little-endian
    0x2A,
    0x00, // Magic 42
    0x08,
    0x00,
    0x00,
    0x00 // IFD0 starts 8 bytes into the TIFF block
  ];
  const ENTRY_COUNT = [0x01, 0x00];
  const ORIENTATION_ENTRY = [
    lowByte(ORIENTATION_TAG),
    highByte(ORIENTATION_TAG), // Tag, little-endian
    SHORT_TYPE,
    0x00, // Type SHORT
    0x01,
    0x00,
    0x00,
    0x00, // Count 1
    orientation,
    0x00,
    0x00,
    0x00 // Inline value
  ];
  const NEXT_IFD = [0x00, 0x00, 0x00, 0x00];
  return [...bytesOf(EXIF_HEADER), ...TIFF_HEADER, ...ENTRY_COUNT, ...ORIENTATION_ENTRY, ...NEXT_IFD];
}

function highByte(value: number): number {
  return Math.floor(value / BYTE_BASE) % BYTE_BASE;
}

function jpegOf(...parts: number[][]): Uint8Array {
  return new Uint8Array([MARKER_PREFIX, SOI_MARKER, ...parts.flat(), MARKER_PREFIX, EOI_MARKER]);
}

function lowByte(value: number): number {
  return value % BYTE_BASE;
}

function readOrientation(exifSegment: Uint8Array): number {
  const SEGMENT_HEADER_SIZE = 4;
  const IFD_VALUE_OFFSET = SEGMENT_HEADER_SIZE + EXIF_HEADER.length + 8 + 2 + 8;
  return exifSegment[IFD_VALUE_OFFSET] ?? -1;
}

/**
 * Builds one JPEG segment: marker, big-endian length (counting itself), then the payload.
 */
function segment(marker: number, payload: number[]): number[] {
  const LENGTH_SIZE = 2;
  const length = payload.length + LENGTH_SIZE;
  return [MARKER_PREFIX, marker, highByte(length), lowByte(length), ...payload];
}

describe('extractJpegMetadataSegments', () => {
  it('returns the EXIF, XMP and ICC segments', () => {
    const bytes = jpegOf(
      segment(APP0_MARKER, bytesOf('JFIF\0')),
      segment(APP1_MARKER, exifPayload(1)),
      segment(APP1_MARKER, bytesOf(`${XMP_HEADER}<x/>`)),
      segment(APP2_MARKER, bytesOf(`${ICC_PROFILE_HEADER}profile`)),
      segment(SOS_MARKER, [0x00])
    );

    const segments = extractJpegMetadataSegments(bytes);

    expect(segments).toHaveLength(3);
    expect(segments[0]?.[1]).toBe(APP1_MARKER);
    expect(segments[1]?.[1]).toBe(APP1_MARKER);
    expect(segments[2]?.[1]).toBe(APP2_MARKER);
  });

  it('leaves APP0 behind, because the re-encode writes its own', () => {
    const bytes = jpegOf(segment(APP0_MARKER, bytesOf('JFIF\0')));
    expect(extractJpegMetadataSegments(bytes)).toStrictEqual([]);
  });

  it('ignores an APP1 that is neither EXIF nor XMP, and an APP2 that is not an ICC profile', () => {
    const bytes = jpegOf(
      segment(APP1_MARKER, bytesOf('Something else\0')),
      segment(APP2_MARKER, bytesOf('Not a profile\0')),
      segment(APP3_MARKER, bytesOf('Ignored\0'))
    );
    expect(extractJpegMetadataSegments(bytes)).toStrictEqual([]);
  });

  it('ignores a segment too short to hold the header it would have to match', () => {
    const bytes = jpegOf(
      segment(APP1_MARKER, [0x45]),
      segment(APP2_MARKER, [0x49])
    );
    expect(extractJpegMetadataSegments(bytes)).toStrictEqual([]);
  });

  it('stops at the start of the scan data', () => {
    // Everything after SOS is entropy-coded, and a byte in it can look exactly like a marker.
    const bytes = jpegOf(
      segment(SOS_MARKER, [0x00]),
      segment(APP1_MARKER, exifPayload(1))
    );
    expect(extractJpegMetadataSegments(bytes)).toStrictEqual([]);
  });

  it('returns nothing for something that is not a JPEG', () => {
    expect(extractJpegMetadataSegments(new Uint8Array([0x89, 0x50, 0x4E, 0x47]))).toStrictEqual([]);
    expect(extractJpegMetadataSegments(new Uint8Array([MARKER_PREFIX]))).toStrictEqual([]);
    expect(extractJpegMetadataSegments(new Uint8Array())).toStrictEqual([]);
  });

  it('stops rather than throwing on a truncated or malformed segment', () => {
    // A length that runs past the end of the file, and a length too small to include itself.
    const overlong = new Uint8Array([MARKER_PREFIX, SOI_MARKER, MARKER_PREFIX, APP1_MARKER, 0xFF, 0xFF, 0x00]);
    expect(extractJpegMetadataSegments(overlong)).toStrictEqual([]);

    const undersized = new Uint8Array([MARKER_PREFIX, SOI_MARKER, MARKER_PREFIX, APP1_MARKER, 0x00, 0x01, 0x00]);
    expect(extractJpegMetadataSegments(undersized)).toStrictEqual([]);

    const notAMarker = new Uint8Array([MARKER_PREFIX, SOI_MARKER, 0x00, 0x00, 0x00, 0x00]);
    expect(extractJpegMetadataSegments(notAMarker)).toStrictEqual([]);

    const endsAtSoi = new Uint8Array([MARKER_PREFIX, SOI_MARKER, MARKER_PREFIX]);
    expect(extractJpegMetadataSegments(endsAtSoi)).toStrictEqual([]);
  });
});

describe('injectJpegMetadataSegments', () => {
  const reEncoded = jpegOf(segment(APP0_MARKER, bytesOf('JFIF\0')), segment(SOS_MARKER, [0x00]));

  it('places the segments after SOI and the re-encoded APP0', () => {
    const source = jpegOf(segment(APP1_MARKER, exifPayload(1)), segment(SOS_MARKER, [0x00]));
    const segments = extractJpegMetadataSegments(source);

    const result = injectJpegMetadataSegments(reEncoded, segments);

    const APP0_END = 2 + 4 + bytesOf('JFIF\0').length;
    expect(result[APP0_END]).toBe(MARKER_PREFIX);
    expect(result[APP0_END + 1]).toBe(APP1_MARKER);
    expect(result.length).toBe(reEncoded.length + (segments[0]?.length ?? 0));
  });

  it('resets the orientation the canvas has already applied', () => {
    // The decode rotates the pixels, so copying the tag across verbatim would rotate them again.
    const ROTATED_180 = 3;
    const source = jpegOf(segment(APP1_MARKER, exifPayload(ROTATED_180)));
    const segments = extractJpegMetadataSegments(source);
    expect(readOrientation(segments[0] ?? new Uint8Array())).toBe(ROTATED_180);

    const result = injectJpegMetadataSegments(reEncoded, segments);

    const APP0_END = 2 + 4 + bytesOf('JFIF\0').length;
    expect(readOrientation(result.slice(APP0_END))).toBe(1);
  });

  it('leaves the source segments untouched', () => {
    const ROTATED_180 = 3;
    const source = jpegOf(segment(APP1_MARKER, exifPayload(ROTATED_180)));
    const segments = extractJpegMetadataSegments(source);

    injectJpegMetadataSegments(reEncoded, segments);

    expect(readOrientation(segments[0] ?? new Uint8Array())).toBe(ROTATED_180);
  });

  it('returns the input unchanged when there is nothing to add', () => {
    expect(injectJpegMetadataSegments(reEncoded, [])).toBe(reEncoded);
  });

  it('returns the input unchanged when it is not a JPEG', () => {
    const notAJpeg = new Uint8Array([0x89, 0x50, 0x4E, 0x47]);
    const segments = extractJpegMetadataSegments(jpegOf(segment(APP1_MARKER, exifPayload(1))));
    expect(injectJpegMetadataSegments(notAJpeg, segments)).toBe(notAJpeg);
  });

  it('inserts straight after SOI when there is no APP0 to follow', () => {
    const withoutApp0 = jpegOf(segment(SOS_MARKER, [0x00]));
    const segments = extractJpegMetadataSegments(jpegOf(segment(APP1_MARKER, exifPayload(1))));

    const result = injectJpegMetadataSegments(withoutApp0, segments);

    expect(result[2]).toBe(MARKER_PREFIX);
    expect(result[3]).toBe(APP1_MARKER);
  });

  it('inserts straight after SOI when the JPEG is too short to hold an APP0, or its APP0 overruns', () => {
    const segments = extractJpegMetadataSegments(jpegOf(segment(APP1_MARKER, exifPayload(1))));

    const tooShort = new Uint8Array([MARKER_PREFIX, SOI_MARKER, MARKER_PREFIX]);
    expect(injectJpegMetadataSegments(tooShort, segments).length).toBe(tooShort.length + (segments[0]?.length ?? 0));

    const overrunningApp0 = new Uint8Array([MARKER_PREFIX, SOI_MARKER, MARKER_PREFIX, APP0_MARKER, 0xFF, 0xFF]);
    const result = injectJpegMetadataSegments(overrunningApp0, segments);
    expect(result[2]).toBe(MARKER_PREFIX);
    expect(result[3]).toBe(APP1_MARKER);
  });

  describe('leaves an EXIF block it cannot walk alone', () => {
    function injectAndReadFirstSegmentBytes(exifSegmentPayload: number[]): Uint8Array {
      const source = jpegOf(segment(APP1_MARKER, exifSegmentPayload));
      const segments = extractJpegMetadataSegments(source);
      const APP0_END = 2 + 4 + bytesOf('JFIF\0').length;
      return injectJpegMetadataSegments(reEncoded, segments).slice(APP0_END);
    }

    it('when the TIFF byte order is neither II nor MM', () => {
      const payload = exifPayload(3);
      payload[EXIF_HEADER.length] = 0x00;
      payload[EXIF_HEADER.length + 1] = 0x00;
      expect(injectAndReadFirstSegmentBytes(payload)[4 + EXIF_HEADER.length]).toBe(0x00);
    });

    it('when the TIFF magic is wrong', () => {
      const payload = exifPayload(3);
      payload[EXIF_HEADER.length + 2] = 0x00;
      expect(readOrientation(injectAndReadFirstSegmentBytes(payload))).toBe(3);
    });

    it('when the IFD pointer runs past the segment', () => {
      const payload = exifPayload(3);
      payload[EXIF_HEADER.length + 4] = 0xFF;
      expect(readOrientation(injectAndReadFirstSegmentBytes(payload))).toBe(3);
    });

    it('when the entry count runs past the segment', () => {
      const payload = exifPayload(3);
      payload[EXIF_HEADER.length + 8] = 0xFF;
      expect(readOrientation(injectAndReadFirstSegmentBytes(payload))).toBe(3);
    });

    it('when the segment stops before the TIFF header', () => {
      const payload = bytesOf(EXIF_HEADER);
      const source = jpegOf(segment(APP1_MARKER, payload));
      const segments = extractJpegMetadataSegments(source);
      expect(injectJpegMetadataSegments(reEncoded, segments).length).toBe(reEncoded.length + (segments[0]?.length ?? 0));
    });
  });

  it('leaves the IFD entries that are not the orientation alone', () => {
    // A real IFD is mostly other tags; walking it must skip them rather than overwrite whatever sits
    // At the value slot.
    const X_RESOLUTION_TAG_LOW_BYTE = 0x1A;
    const UNTOUCHED_VALUE = 3;
    const payload = exifPayload(UNTOUCHED_VALUE);
    const TAG_OFFSET_IN_PAYLOAD = EXIF_HEADER.length + 8 + 2;
    payload[TAG_OFFSET_IN_PAYLOAD] = X_RESOLUTION_TAG_LOW_BYTE;

    const segments = extractJpegMetadataSegments(jpegOf(segment(APP1_MARKER, payload)));
    const result = injectJpegMetadataSegments(reEncoded, segments);

    const APP0_END = 2 + 4 + bytesOf('JFIF\0').length;
    expect(readOrientation(result.slice(APP0_END))).toBe(UNTOUCHED_VALUE);
  });

  it('does not try to rewrite the orientation of a non-EXIF segment', () => {
    const source = jpegOf(segment(APP2_MARKER, bytesOf(`${ICC_PROFILE_HEADER}profile`)));
    const segments = extractJpegMetadataSegments(source);

    const result = injectJpegMetadataSegments(reEncoded, segments);

    const APP0_END = 2 + 4 + bytesOf('JFIF\0').length;
    expect(result[APP0_END + 1]).toBe(APP2_MARKER);
  });
});
