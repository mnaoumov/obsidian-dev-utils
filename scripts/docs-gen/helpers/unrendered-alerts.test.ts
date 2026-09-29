import {
  describe,
  expect,
  it
} from 'vitest';

import {
  collectUnrenderedAlerts,
  formatUnrenderedAlerts
} from './unrendered-alerts.ts';

describe('collectUnrenderedAlerts', () => {
  it('reports every alert marker opening a blockquote, whatever its case', () => {
    const pages = [
      { html: '<blockquote>\n<p>[!WARNING]\nBody</p>\n</blockquote><blockquote class="x"><p> [!note] Body</p></blockquote>', relativePath: 'a/index.html' },
      { html: '<blockquote><p>[!TIP]</p></blockquote>', relativePath: 'b/index.html' }
    ];

    expect(collectUnrenderedAlerts(pages)).toEqual([
      { marker: '[!WARNING]', relativePath: 'a/index.html' },
      { marker: '[!note]', relativePath: 'a/index.html' },
      { marker: '[!TIP]', relativePath: 'b/index.html' }
    ]);
  });

  it('ignores a marker that does not open a blockquote, an unknown type, and a rendered aside', () => {
    const pages = [{
      html: [
        '<p>Write <code>&gt; [!NOTE]</code> to get an aside.</p>',
        '<blockquote><p>Quoted [!NOTE] mid-sentence.</p></blockquote>',
        '<blockquote><p>[!BOGUS] not a GitHub type</p></blockquote>',
        '<aside class="starlight-aside starlight-aside--note"><p>Body</p></aside>'
      ].join('\n'),
      relativePath: 'c/index.html'
    }];

    expect(collectUnrenderedAlerts(pages)).toEqual([]);
  });
});

describe('formatUnrenderedAlerts', () => {
  it('prints one line per alert', () => {
    expect(formatUnrenderedAlerts([
      { marker: '[!NOTE]', relativePath: 'a/index.html' },
      { marker: '[!TIP]', relativePath: 'b/index.html' }
    ])).toBe('  a/index.html: [!NOTE]\n  b/index.html: [!TIP]');
  });
});
