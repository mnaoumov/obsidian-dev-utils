---
title: Cross-plugin APIs
description: Publish and consume another plugin's API with version negotiation, revocable handles, typed failures, and optional payload validation.
---

Obsidian gives plugins no first-class way to expose an API to each other. The usual workaround —
[`@vanakat/plugin-api`](https://github.com/vanakat/plugin-api) — puts an object on `window.PluginApi` and types both ends as `any`. That works right
up until one of five things happens:

1. **Load order.** The lookup runs in your `onload` before the provider has loaded, and returns `undefined`.
2. **Version drift.** The provider ships API v2, you compiled against v1, and nothing says so.
3. **Stale handles.** The provider gets disabled and you keep calling into a torn-down plugin.
4. **Name collisions.** Nothing stops two plugins claiming the same free-form key.
5. **Opaque failure.** All five causes collapse into a `Notice` and an `undefined`.

`obsidian-dev-utils` ships a registry that answers all five.

```typescript
import {
  publishPluginApi,
  watchPluginApi
} from 'obsidian-dev-utils/obsidian/plugin/plugin-api';
```

## Declaring the contract

A cross-plugin call is **RPC across a version boundary**: the code on the other side was compiled separately,
released separately, and may be older or newer than what you compiled against. So the contract is where you
write down what each method takes and returns — and the payload schemas are the substance of it, not a
decoration.

Schemas are reached through [Standard Schema](https://standardschema.dev), so zod, valibot, arktype or a
hand-written validator all plug in and **none of them becomes a dependency of `obsidian-dev-utils`** or of a
plugin that does not want one.

```typescript
import type { PluginApiContract } from 'obsidian-dev-utils/obsidian/plugin/plugin-api';

import { z } from 'zod';

export interface SearchOptions {
  limit: number;
}

export interface SearchHit {
  path: string;
  score: number;
}

export interface SearchApi {
  search(query: string, options: SearchOptions): Promise<SearchHit[]>;
}

export const SEARCH_CONTRACT: PluginApiContract = {
  search: {
    // `input` validates the ARGUMENT LIST as an array — hence a tuple, one member per parameter.
    input: z.tuple([
      z.string().min(1),
      z.object({ limit: z.number().int().positive() })
    ]),
    // `output` validates the return value — or, for a method returning a thenable, what it resolves to.
    output: z.array(z.object({
      path: z.string(),
      score: z.number()
    }))
  }
};
```

That is what turns "the provider is on 1.9 and returns `{ path }` where I expect `{ file }`" into a legible
error naming the method and the offending field, at the call site that made the call:

```text
PluginApiValidationError: The output of "their-plugin-id" API method "search"
failed validation: 0.path: Invalid input: expected string, received undefined
```

Both schemas are optional per method. A method entry may declare only its input, only its output, or neither
— `{ search: {} }` still declares that `search` must **exist**, which is the shape check every consumer gets
for free. Declaring nothing is what `@vanakat/plugin-api` gives you, so there is not much point stopping
there.

## Providing an API

```typescript
export default class MyPlugin extends Plugin {
  public override onload(): void {
    publishPluginApi({
      api: new MySearchApi(this),
      apiVersion: '2.1.0',
      contract: SEARCH_CONTRACT,
      plugin: this
    });
  }
}
```

The record is keyed by `plugin.manifest.id`, which Obsidian already keeps unique — so no consumer can be
misdirected by a typo, and no two plugins can collide.

`apiVersion` is the **contract** version, not the plugin version. Plugin `1.4.7` may perfectly well expose API
`2.1.0`, and the two move independently. You may publish several versions side by side, which is how you move
to `3.0.0` without breaking consumers pinned to `^2`:

```typescript
publishPluginApi({ api: legacyApi, apiVersion: '2.1.0', contract: SEARCH_CONTRACT, plugin: this });
publishPluginApi({ api: nextApi, apiVersion: '3.0.0', contract: SEARCH_CONTRACT_V3, plugin: this });
```

Revocation is automatic: `publishPluginApi` registers it on the plugin, so unloading revokes every record it
published.

## Consuming an API

`watchPluginApi` is the whole consumer surface. It returns a **live ref** whose `value` is always current.

```typescript
export default class MyConsumerPlugin extends Plugin {
  private searchApi: SearchApi | null = null;

  public override onload(): void {
    const ref = watchPluginApi<SearchApi>({
      apiVersionRange: '^2',
      app: this.app,
      component: this,
      contract: SEARCH_CONTRACT,
      pluginId: 'their-plugin-id'
    });

    ref.on('change', () => {
      this.searchApi = ref.value;
    });
  }
}
```

Three ways to read it, in the order you will usually want them:

```typescript
ref.value;                   // SearchApi | null — synchronous, free, always correct
await ref.whenAvailable();   // one-shot flows: a command execution, a script
ref.on('change', () => {});  // when you must REACT rather than read
```

`null` from `ref.value` means **"not available right now"**, not "not installed". During your `onload` the
provider may simply not have loaded yet; the value becomes non-`null` on its own, with no polling on your part.

The watch is scoped to the `component` you pass, so it is torn down with it.

### There is deliberately no synchronous probe

Some Obsidian callbacks cannot `await` — `checkCallback(isChecking): boolean`, `canExecute()`, a settings-row
`visible` predicate. The answer is not a lookup function; it is the field the ref already maintains for you:

```typescript
protected canExecute(): boolean {
  return this.searchApi !== null;
}
```

That is free (no registry lookup per keystroke in the command palette) and it is correct across **both** edges,
which a probe never is — a probe only ever answers "now", and never tells you when "now" changed.

### Version negotiation

`apiVersionRange` is evaluated by [`compare-versions`](https://github.com/omichelsen/compare-versions), and the
**highest** published version satisfying it wins. It accepts `^`, `~`, comparison operators and `x` wildcards
— but not a bare `*`. Spell "any version" as `'>=0.0.0'`.

### Revoked handles

`ref.value` is a revocable handle. Once the provider unloads, reading any property off a handle you cached
throws a `PluginApiRevokedError` naming the provider — instead of a `Cannot read properties of undefined` deep
inside somebody else's torn-down stack.

Note that a re-enabled provider publishes a **new** record, so an old handle stays dead forever. This is
exactly why the watch, and not a one-shot "give me the API" call, is the entire consumer surface: `ref.value`
recovers, a cached handle does not.

## When it is not available

`whenAvailable()` waits (10 seconds by default, configurable via `timeoutInMilliseconds`) and then rejects with
a `PluginApiUnavailableError` carrying the reason:

| `PluginApiUnavailabilityReason` | What happened |
| --- | --- |
| `NotInstalled` | The plugin is not installed in this vault. |
| `NotEnabled` | It is installed but switched off. |
| `NotPublished` | It is running but published no API — likely too old to have one. |
| `VersionMismatch` | It published an API, but nothing satisfies your range. |
| `ShapeMismatch` | A satisfying record exists, but the object is missing a method the contract declares. |
| `Revoked` | The handle was valid and the provider has since unloaded. |

```typescript
try {
  const api = await ref.whenAvailable();
  await api.search('query', { limit: 10 });
} catch (error) {
  if (error instanceof PluginApiUnavailableError) {
    console.log(error.reason, error.pluginId);
  }
}
```

## When validation runs

Validation runs **only while the `obsidian-dev-utils:PluginApi` debugger is enabled**. Outside debug mode the
methods are not wrapped at all, so production pays nothing — no schema call, no proxy hop, nothing. See
[Debugging](/obsidian-dev-utils/guides/debugging/) for how to turn the namespace on. The gate is checked per
call, so flipping `DEBUG` at runtime takes effect without re-acquiring the handle.

A schema that answers **synchronously** throws a `PluginApiValidationError` at the call site — which is the
point, because that is where the wrong assumption lives. A schema that answers with a **`Promise`** cannot do
that: the synchronous call it was guarding has already returned by the time the answer arrives, so there is
nothing left to throw into and the failure is reported through the debugger instead. Prefer synchronous
schemas for anything you want to fail loudly.

Both sides may declare a contract, and **the consumer's wins when it supplies one** — it is the consumer's own
compiled-against expectation, so its violation is the consumer's problem to see. With no consumer contract,
the provider's published one is used.

### Why the contract is a map of methods, not one schema over the whole API

An API is a bag of functions, and in zod 4 `z.function()` returns a function *factory* rather than a schema,
so it cannot be a `z.object()` member directly. There is a
[known workaround](https://github.com/colinhacks/zod/issues/4143#issuecomment-2845134912):

```typescript
const functionSchema = <T extends z.core.$ZodFunction>(schema: T) =>
  z.custom<Parameters<T['implement']>[0]>((fn) => schema.implement(fn));
```

It is genuinely useful if you want `z.infer` to produce your API type from a single schema. It does **not**
give you runtime validation, though: `z.custom` is a boolean predicate that returns its input unchanged, so
the validating wrapper `implement` builds is thrown away and the runtime check collapses back to "is it
callable". Keeping the wrapper would take a further `.transform()` — and that would put validation on every
call rather than behind the debug gate, and tie the contract to zod specifically, which is the coupling
reaching through Standard Schema is meant to avoid.

So the contract declares method **names**, checked with a plain `typeof`, and validates **payloads** per
method.

## A note on library copies

Every plugin bundles its own copy of `obsidian-dev-utils`, so a registry record travels between **different
library versions**. The record therefore holds nothing but plain data and plain functions, and every read of it
is structural — never `instanceof`. You do not have to do anything about this; it just means a provider on an
old library version and a consumer on a new one keep working.
