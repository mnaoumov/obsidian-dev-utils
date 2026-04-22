import {
  describe,
  expect,
  it
} from 'vitest';

import { AsyncComponentBase } from './async-component.ts';

class TestAsyncComponent extends AsyncComponentBase {
  public onloadCalled = false;

  public override async onload(): Promise<void> {
    await super.onload();
    this.onloadCalled = true;
  }
}

describe('AsyncComponentBase', () => {
  it('should call onload and load children sequentially', async () => {
    const parent = new TestAsyncComponent();
    const child = new TestAsyncComponent();
    parent.addChild(child);

    await parent.load();

    expect(parent.onloadCalled).toBe(true);
    expect(child.onloadCalled).toBe(true);
  });

  it('should not re-load if already loaded', async () => {
    const component = new TestAsyncComponent();

    await component.load();
    component.onloadCalled = false;
    await component.load();

    expect(component.onloadCalled).toBe(false);
  });

  it('should await async children load in order', async () => {
    const order: string[] = [];

    class SlowChild extends AsyncComponentBase {
      public override async onload(): Promise<void> {
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, 10);
        });
        order.push('child');
      }
    }

    class ParentComponent extends AsyncComponentBase {
      public override async onload(): Promise<void> {
        await super.onload();
        order.push('parent');
      }
    }

    const parent = new ParentComponent();
    parent.addChild(new SlowChild());

    await parent.load();

    expect(order).toEqual(['parent', 'child']);
  });
});
