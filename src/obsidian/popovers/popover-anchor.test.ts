// @vitest-environment jsdom

import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { strictProxy } from '../../strict-proxy.ts';
import {
  createAnchorFromDocumentCenter,
  createAnchorFromElement,
  createAnchorFromPoint,
  createAnchorFromSelection
} from './popover-anchor.ts';

function createRect(bottom: number, left: number): DOMRect {
  return strictProxy<DOMRect>({
    bottom,
    left
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createAnchorFromDocumentCenter', () => {
  it('should anchor at the middle of the window', () => {
    const anchor = createAnchorFromDocumentCenter(document);

    expect(anchor).toStrictEqual({
      bottom: window.innerHeight / 2,
      doc: document,
      left: window.innerWidth / 2
    });
  });
});

describe('createAnchorFromElement', () => {
  it('should anchor at the bottom left of the element rect', () => {
    const element = document.body.createDiv();
    element.getBoundingClientRect = (): DOMRect => createRect(120, 40);

    const anchor = createAnchorFromElement(element);

    expect(anchor).toStrictEqual({
      bottom: 120,
      doc: document,
      left: 40
    });
  });
});

describe('createAnchorFromPoint', () => {
  it('should anchor at the given coordinates in the given document', () => {
    const anchor = createAnchorFromPoint(15, 25, document);

    expect(anchor).toStrictEqual({
      bottom: 25,
      doc: document,
      left: 15
    });
  });
});

describe('createAnchorFromSelection', () => {
  it('should anchor at the caret rect', () => {
    stubSelection(createRect(80, 30));

    const anchor = createAnchorFromSelection(document);

    expect(anchor).toStrictEqual({
      bottom: 80,
      doc: document,
      left: 30
    });
  });

  it('should anchor at the caret rect when only one coordinate is zero', () => {
    stubSelection(createRect(0, 30));

    const anchor = createAnchorFromSelection(document);

    expect(anchor).toStrictEqual({
      bottom: 0,
      doc: document,
      left: 30
    });
  });

  it('should fall back to the document center when there is no selection', () => {
    vi.spyOn(document, 'getSelection').mockReturnValue(null);

    expect(createAnchorFromSelection(document)).toStrictEqual(createAnchorFromDocumentCenter(document));
  });

  it('should fall back to the document center when the selection has no range', () => {
    vi.spyOn(document, 'getSelection').mockReturnValue(strictProxy<Selection>({ rangeCount: 0 }));

    expect(createAnchorFromSelection(document)).toStrictEqual(createAnchorFromDocumentCenter(document));
  });

  it('should fall back to the document center when the caret rect is empty', () => {
    stubSelection(createRect(0, 0));

    expect(createAnchorFromSelection(document)).toStrictEqual(createAnchorFromDocumentCenter(document));
  });

  function stubSelection(rect: DOMRect): void {
    const range = strictProxy<Range>({
      getBoundingClientRect: (): DOMRect => rect
    });
    vi.spyOn(document, 'getSelection').mockReturnValue(strictProxy<Selection>({
      getRangeAt: (): Range => range,
      rangeCount: 1
    }));
  }
});
