import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { GenerateMarkdownLinkParams } from '../link.ts';

import { getGenerateMarkdownLinkDefaultParamsFns } from '../link.ts';
import { GenerateMarkdownLinkDefaultParamsComponent } from './generate-markdown-link-default-params-component.ts';

vi.mock('../link.ts', () => ({
  getGenerateMarkdownLinkDefaultParamsFns: vi.fn()
}));

type DefaultParamsFn = (this: void) => Partial<GenerateMarkdownLinkParams>;

describe('GenerateMarkdownLinkDefaultParamsComponent', () => {
  it('should append the default-params function on load and remove it on unload', () => {
    const fns: DefaultParamsFn[] = [];
    vi.mocked(getGenerateMarkdownLinkDefaultParamsFns).mockReturnValue(fns);

    const component = new GenerateMarkdownLinkDefaultParamsComponent({ getDefaultParams });

    component.load();
    expect(getGenerateMarkdownLinkDefaultParamsFns).toHaveBeenCalledOnce();
    expect(fns).toStrictEqual([getDefaultParams]);

    component.unload();
    expect(fns).toStrictEqual([]);

    function getDefaultParams(this: void): Partial<GenerateMarkdownLinkParams> {
      return { shouldUseLeadingSlashForAbsolutePaths: true };
    }
  });
});
