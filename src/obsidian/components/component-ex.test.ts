/**
 * @file
 *
 * Tests for {@link ComponentEx}.
 */

import { Component } from 'obsidian';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { ErrorWrapper } from '../../error.ts';
import { noopAsync } from '../../function.ts';
import { assertNonNullable } from '../../type-guards.ts';
import { ComponentEx } from './component-ex.ts';

// eslint-disable-next-line obsidian-dev-utils/require-component-suffix -- Testing ComponentEx.
class SyncComponentEx extends ComponentEx {
  public onloadCalled = false;

  public override onload(): void {
    this.onloadCalled = true;
  }
}

// eslint-disable-next-line obsidian-dev-utils/require-component-suffix -- Testing ComponentEx.
class TestComponentEx extends ComponentEx {
  public asyncLoadFn = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

  public override async onloadAsync(): Promise<void> {
    await this.asyncLoadFn();
  }
}

describe('ComponentEx', () => {
  describe('load', () => {
    it('should set _loaded and call onload', () => {
      const component = new SyncComponentEx();
      component.load();
      expect(component._loaded).toBe(true);
      expect(component.onloadCalled).toBe(true);
    });

    it('should not load twice', () => {
      const component = new SyncComponentEx();
      component.load();
      component.onloadCalled = false;
      component.load();
      expect(component.onloadCalled).toBe(false);
    });

    it('should chain onloadAsync when overridden', async () => {
      const component = new TestComponentEx();
      await component.loadWithPromises();
      expect(component.asyncLoadFn).toHaveBeenCalledOnce();
    });

    it('should load children sequentially', async () => {
      const parent = new TestComponentEx();
      const child1 = new TestComponentEx();
      const child2 = new TestComponentEx();
      parent.addChild(child1);
      parent.addChild(child2);

      await parent.loadWithPromises();

      expect(child1.asyncLoadFn).toHaveBeenCalledOnce();
      expect(child2.asyncLoadFn).toHaveBeenCalledOnce();
      expect(child1._loaded).toBe(true);
      expect(child2._loaded).toBe(true);
    });

    it('should load plain Component children', () => {
      const parent = new SyncComponentEx();
      const child = new Component();
      const loadSpy = vi.spyOn(child, 'load');
      parent.addChild(child);

      parent.load();

      expect(loadSpy).toHaveBeenCalledOnce();
    });
  });

  describe('loadWithPromises', () => {
    it('should return null for fully synchronous component', () => {
      const component = new SyncComponentEx();
      const result = component.loadWithPromises();
      expect(result).toBeNull();
    });

    it('should return a Promise for async component', () => {
      const component = new TestComponentEx();
      const result = component.loadWithPromises();
      expect(result).toBeInstanceOf(Promise);
    });

    it('should reject with an AggregateError holding the onloadAsync failure', async () => {
      const error = new Error('load failed');
      const component = new TestComponentEx();
      component.asyncLoadFn.mockRejectedValue(error);

      const promise = component.loadWithPromises();
      assertNonNullable(promise);
      const rejection = await promise.catch((thrown: unknown) => thrown);
      expect(rejection).toBeInstanceOf(AggregateError);
      if (rejection instanceof AggregateError) {
        expect(rejection.errors).toEqual([error]);
      }
    });

    it('should keep a child load failure grouped in its own AggregateError', async () => {
      const childError = new Error('child failed');
      const parent = new TestComponentEx();
      parent.asyncLoadFn.mockResolvedValue(undefined);
      const child = new TestComponentEx();
      child.asyncLoadFn.mockRejectedValue(childError);
      parent.addChild(child);

      const promise = parent.loadWithPromises();
      assertNonNullable(promise);
      const rejection = await promise.catch((thrown: unknown) => thrown);
      expect(rejection).toBeInstanceOf(AggregateError);
      if (rejection instanceof AggregateError) {
        expect(rejection.errors).toHaveLength(1);
        const [childAggregate] = rejection.errors;
        expect(childAggregate).toBeInstanceOf(AggregateError);
        if (childAggregate instanceof AggregateError) {
          expect(childAggregate.errors).toEqual([childError]);
        }
      }
    });

    it('should keep each child failure grouped in its own AggregateError', async () => {
      const parent = new ComponentEx();
      const child1 = new TestComponentEx();
      child1.asyncLoadFn.mockRejectedValue(new Error('error 1'));
      const child2 = new TestComponentEx();
      child2.asyncLoadFn.mockRejectedValue(new Error('error 2'));
      parent.addChild(child1);
      parent.addChild(child2);

      const promise = parent.loadWithPromises();
      assertNonNullable(promise);
      const rejection = await promise.catch((thrown: unknown) => thrown);
      expect(rejection).toBeInstanceOf(AggregateError);
      if (rejection instanceof AggregateError) {
        expect(rejection.errors).toHaveLength(2);
        const messages = rejection.errors.map((childAggregate: unknown) =>
          childAggregate instanceof AggregateError && childAggregate.errors[0] instanceof Error
            ? childAggregate.errors[0].message
            : 'unexpected'
        );
        expect(messages).toEqual(['error 1', 'error 2']);
      }
    });

    it('should wrap a non-Error throwable via ErrorWrapper', async () => {
      const component = new TestComponentEx();
      component.asyncLoadFn.mockRejectedValue('string failure');

      const promise = component.loadWithPromises();
      assertNonNullable(promise);
      const rejection = await promise.catch((thrown: unknown) => thrown);
      expect(rejection).toBeInstanceOf(AggregateError);
      if (rejection instanceof AggregateError) {
        const [firstError] = rejection.errors;
        expect(firstError).toBeInstanceOf(ErrorWrapper);
        if (firstError instanceof ErrorWrapper) {
          expect(firstError.cause).toBe('string failure');
        }
      }
    });

    it('should reset its load promise after settling', async () => {
      const component = new TestComponentEx();
      await component.loadWithPromises();
      expect(component.loadWithPromises()).toBeNull();
    });
  });

  describe('onloadAsync', () => {
    it('should return noopAsyncSingletonPromise by default', () => {
      const component = new ComponentEx();
      const result1 = component.onloadAsync();
      const result2 = component.onloadAsync();
      expect(result1).toBe(result2);
    });
  });

  describe('addChild', () => {
    it('should add component to children', () => {
      const parent = new SyncComponentEx();
      const child = new SyncComponentEx();
      const returned = parent.addChild(child);

      expect(returned).toBe(child);
      expect(parent._children).toContain(child);
    });

    it('should chain loading when added after parent is loaded', async () => {
      const parent = new TestComponentEx();
      await parent.loadWithPromises();

      const child = new TestComponentEx();
      parent.addChild(child);

      // LoadPromise is extended — need to wait for it
      await vi.waitFor(() => {
        expect(child.asyncLoadFn).toHaveBeenCalledOnce();
      });
    });

    it('should not load child immediately when parent is not loaded', () => {
      const parent = new SyncComponentEx();
      const child = new SyncComponentEx();
      parent.addChild(child);

      expect(child._loaded).toBe(false);
    });

    it('should load a child synchronously even while the parent async load is in flight', () => {
      const parent = new TestComponentEx();
      parent.load();

      const child = new SyncComponentEx();
      parent.addChild(child);

      expect(child._loaded).toBe(true);
    });
  });

  describe('removeChild', () => {
    it('should remove component from children and childrenSet', () => {
      const parent = new SyncComponentEx();
      const child = new SyncComponentEx();
      parent.addChild(child);
      parent.load();

      expect(parent._children).toContain(child);

      const returned = parent.removeChild(child);
      expect(returned).toBe(child);
      expect(parent._children).not.toContain(child);
    });

    it('should skip loading removed child in chain', async () => {
      const parent = new TestComponentEx();
      const child = new TestComponentEx();
      parent.addChild(child);

      // Remove the child before parent loads
      parent.removeChild(child);

      await parent.loadWithPromises();

      // Child should not have been loaded
      expect(child.asyncLoadFn).not.toHaveBeenCalled();
    });

    it('should skip loading child removed during async chain', async () => {
      const parent = new ComponentEx();
      const child1 = new TestComponentEx();
      const child2 = new TestComponentEx();

      child1.asyncLoadFn.mockImplementation(async () => {
        await noopAsync();
        // Remove child2 while child1 is loading
        parent.removeChild(child2);
      });

      parent.addChild(child1);
      parent.addChild(child2);

      await parent.loadWithPromises();

      expect(child1.asyncLoadFn).toHaveBeenCalledOnce();
      expect(child2.asyncLoadFn).not.toHaveBeenCalled();
    });
  });

  describe('Symbol.dispose', () => {
    it('should call unload', () => {
      const component = new SyncComponentEx();
      component.load();
      expect(component._loaded).toBe(true);

      component[Symbol.dispose]();
      expect(component._loaded).toBe(false);
    });
  });

  describe('chain', () => {
    it('should handle PromiseLike that is not a Promise', async () => {
      const parent = new ComponentEx();
      const child = new Component();
      const thenable: PromiseLike<void> = {
        async then(resolve) {
          await resolve?.();
        }
      };
      // eslint-disable-next-line @typescript-eslint/no-invalid-void-type, no-restricted-syntax -- We need to bypass type system to return `Promise<void>`.
      vi.spyOn(child, 'load').mockReturnValue(thenable as unknown as void);
      parent.addChild(child);

      const result = parent.loadWithPromises();
      expect(result).toBeInstanceOf(Promise);
      await result;
    });

    it('should chain multiple async operations sequentially', async () => {
      const order: number[] = [];
      const parent = new ComponentEx();

      const child1 = new TestComponentEx();
      child1.asyncLoadFn.mockImplementation(async () => {
        await noopAsync();
        order.push(1);
      });

      const child2 = new TestComponentEx();
      child2.asyncLoadFn.mockImplementation(async () => {
        await noopAsync();
        order.push(2);
      });

      parent.addChild(child1);
      parent.addChild(child2);

      await parent.loadWithPromises();
      expect(order).toEqual([1, 2]);
    });
  });
});
