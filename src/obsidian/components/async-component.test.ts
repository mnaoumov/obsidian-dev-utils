import {
  describe,
  expect,
  it
} from 'vitest';

import { noopAsync } from '../../function.ts';
import {
  AsyncComponent,
  loadChildrenFirstAsync
} from './async-component.ts';

class TestAsyncComponent extends AsyncComponent {
  public onloadCalled = false;

  public override async onload(): Promise<void> {
    await noopAsync();
    this.onloadCalled = true;
  }
}

describe('AsyncComponent', () => {
  it('should resolve base onload without error', async () => {
    const component = new AsyncComponent();
    await component.load();
    expect(component._loaded).toBe(true);
  });

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

    class SlowChildComponent extends AsyncComponent {
      public override async onload(): Promise<void> {
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, 10);
        });
        order.push('child');
      }
    }

    class ParentComponent extends AsyncComponent {
      public override async onload(): Promise<void> {
        await noopAsync();
        order.push('parent');
      }
    }

    const parent = new ParentComponent();
    parent.addChild(new SlowChildComponent());

    await parent.load();

    expect(order).toEqual(['parent', 'child']);
  });
});

describe('loadChildrenFirstAsync', () => {
  it('should load children before parent', async () => {
    const order: string[] = [];

    class ChildComponent extends AsyncComponent {
      public override async onload(): Promise<void> {
        await noopAsync();
        order.push('child');
      }
    }

    class ParentComponent extends AsyncComponent {
      public override async onload(): Promise<void> {
        await noopAsync();
        order.push('parent');
      }
    }

    const parent = new ParentComponent();
    parent.addChild(new ChildComponent());

    await loadChildrenFirstAsync(parent);

    expect(order).toEqual(['child', 'parent']);
  });

  it('should not re-load if already loaded', async () => {
    const component = new TestAsyncComponent();

    await loadChildrenFirstAsync(component);
    component.onloadCalled = false;
    await loadChildrenFirstAsync(component);

    expect(component.onloadCalled).toBe(false);
  });

  it('should load deeply nested children in correct order', async () => {
    const order: string[] = [];

    class OrderedComponent extends AsyncComponent {
      public constructor(private readonly label: string) {
        super();
      }

      public override async onload(): Promise<void> {
        await noopAsync();
        order.push(this.label);
      }
    }

    const parent = new OrderedComponent('parent');
    const child = new OrderedComponent('child');
    const grandchild = new OrderedComponent('grandchild');
    child.addChild(grandchild);
    parent.addChild(child);

    await loadChildrenFirstAsync(parent);

    expect(order).toEqual(['grandchild', 'child', 'parent']);
  });
});
