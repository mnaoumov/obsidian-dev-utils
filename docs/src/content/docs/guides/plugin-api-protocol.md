---
title: Plugin API protocol
description: The wire-level contract behind cross-plugin APIs, so a plugin that will never install obsidian-dev-utils can still depend on one that did.
---

[Cross-plugin APIs](/obsidian-dev-utils/guides/cross-plugin-apis/) describes the registry from the inside,
through `publishPluginApi` and `watchPluginApi`. This page describes the same mechanism from the **outside**,
as a wire protocol, for the developer whose plugin does not use `obsidian-dev-utils` and is not going to.

You are in the right place if some plugin you want to depend on is built on this library, you want its API,
and you would rather not take on somebody else's framework to get it. You do not have to. Everything below
is reachable with the `obsidian` module you already import and nothing else — no install, no dependency, no
bundle weight.

## What is frozen, and why that is not a promise anyone had to make

Three things are a permanent contract: the two **event names**, the **event payload**, and the **registry
record**. None of them may ever change incompatibly, and new fields may only ever be added.

That is worth stating plainly because it sounds like a favour, and it is not. Every plugin built on
`obsidian-dev-utils` bundles **its own copy** of it, so two plugins in one vault routinely run two different
versions of this library, publishing to and reading from the same registry. The wire format is therefore
already a compatibility boundary *between the library and itself*, and a breaking change to it would break
the library against its own older copies before it ever reached you. The constraint predates you, and it is
load-bearing.

The practical consequence: you may hardcode the strings and the shapes below. They are as stable as
Obsidian's own API surface, and considerably more stable than most plugins' internals.

## Yes, the names say `obsidian-dev-utils`

The events are called `obsidian-dev-utils:plugin-loaded` and `obsidian-dev-utils:plugin-unloaded`. The
prefix names the library that introduced them rather than the thing they describe, which is a wart, and it
is a permanent one.

It stays for a reason that cuts in your favour. A neutral second name would not retire the first: every
already-released plugin emits the old name and only the old one, so a correct consumer would have to listen
for **both**, forever, and would have twice as much protocol to learn. Renaming outright would be worse
still — it would silently break every listener already written. So the spelling is historical, it is the
only spelling, and you can rely on it.

## Knowing when a plugin is ready

Both events ride `app.workspace`, which every plugin can reach without holding anything belonging to anyone
else:

```typescript
this.registerEvent(
  this.app.workspace.on('obsidian-dev-utils:plugin-loaded', (payload) => {
    console.log(payload.pluginId, payload.apiVersions);
  })
);
```

The payload is plain data:

| Field | Type | Meaning |
| --- | --- | --- |
| `pluginId` | `string` | The plugin's `manifest.id`. |
| `pluginName` | `string` | The plugin's `manifest.name`, for display. |
| `pluginVersion` | `string` | The plugin's `manifest.version`. |
| `apiVersions` | `readonly string[]` | The **contract** versions it just published. Empty when it publishes no API. |
| `dependencyPluginIds` | `readonly string[]` | The plugins it declares as mandatory dependencies. Empty when it declares none. |

Four things the events guarantee, each of which saves you a defensive workaround:

- **Each event fires after the registry already agrees with it.** `plugin-loaded` is triggered once every API
  that plugin declares has been published, and `plugin-unloaded` once they have been revoked — so you may go
  and read the registry inside either handler, and there is no window where the announcement is true and the
  registry has not caught up.
- **The pair tracks the plugin's FEATURE SURFACE, not its enabled bit.** A plugin whose own dependency
  disappears tears its surface down and broadcasts `plugin-unloaded` while remaining loaded and enabled. So
  `app.plugins.enabledPlugins.has(id)` is not a substitute for the event, in either direction.
- **The two are paired.** A plugin that never got its surface up never announced itself, and does not
  announce a departure either. You will not see an unload you did not see a load for.
- **`apiVersion` is the CONTRACT version, not the plugin version.** Plugin `1.4.7` may perfectly well
  publish API `2.0.0`, and a single plugin may publish several contract versions side by side so that
  consumers pinned to an older one keep working across a breaking change.

The one thing the events do not do is replay. Obsidian's `trigger` has no backlog, so a listener registered
after a provider has already loaded hears nothing. Read the current state once at your own load — the
registry below is the authority — and use the events for the transitions after that.

## Reaching the API

The published APIs live in a registry on the renderer's global object, at a fixed path:

```text
globalThis.__obsidianDevUtils.pluginApiRegistry.value.records[pluginId]
```

Every segment of that path is part of the contract:

- `__obsidianDevUtils` is a bag of shared state. **Only `pluginApiRegistry` is public**; the rest of the bag
  is the library's business and will change without notice. Do not browse it.
- `pluginApiRegistry` is a wrapper object whose `value` holds the registry. The indirection exists for
  reasons internal to the library; for you it is one extra `.value`.
- `records` maps a provider's `manifest.id` to an array of everything it currently has published.

Any segment may be missing — nothing has published yet, or no plugin in the vault uses this library at all —
so read the path optionally, and treat absent as "not available right now" rather than "not installed".
**Read it, never create it.** The library adopts whatever it finds at that key rather than overwriting it,
so a stand-in you put there first becomes the real registry, and every provider in the vault publishes into
your approximation of it.

Each entry in the array is a record:

| Field | Type | Meaning |
| --- | --- | --- |
| `api` | `object` | The API object itself. Call its methods on it; do not detach them from it. |
| `apiVersion` | `string` | The contract version this record satisfies. |
| `pluginId` | `string` | The publishing plugin's `manifest.id`. |
| `isRevoked` | `boolean` | `true` once the provider has torn this API down. |
| `contract` | `object` | The method names the provider promises, for an optional shape check. Ignorable. |

Records hold plain data and plain functions only, deliberately, because they cross between separately
bundled copies of the library. **So read them structurally and never `instanceof` anything you find there** —
including a `Promise` an API method returns, which may come from another realm. Test for a `then` method
instead.

## Choosing among several versions

When a provider has published more than one contract version, the rule the library applies — and the one you
should apply — is: discard revoked records, keep those whose `apiVersion` satisfies the range you compiled
against, and take the **highest** of what remains.

```typescript
function compareApiVersions(a: string, b: string): number {
  const aParts = a.split('.').map(Number);
  const bParts = b.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    const diff = (aParts[i] ?? 0) - (bParts[i] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }

  return 0;
}
```

Contract versions are plain `major.minor.patch` semver — that is what the library's own comparison assumes,
so a provider publishing a prerelease tag is already outside the protocol and this three-number comparison
is faithful to it.

## Revocation, and the one rule that matters

When a provider's surface unloads, its record is marked `isRevoked` **and removed from the array**. Consumers
using `obsidian-dev-utils` never notice, because what they hold is a revocable handle that starts throwing a
named error at that moment. Reading the registry directly, you hold the raw object instead — and a raw object
does not know it has been retired. It will go on answering calls into a plugin that is no longer there.

So: **look the record up every time you use it, and never cache `record.api` in a field.** The lookup is a
property read on an object already in memory; it is cheaper than the defensive code you would otherwise have
to write around a stale handle.

```typescript
function getApi<TApi extends object>(pluginId: string, majorVersion: number): null | TApi {
  const records = globalThis.__obsidianDevUtils?.pluginApiRegistry?.value?.records?.[pluginId] ?? [];

  const match = records
    .filter((record) => !record.isRevoked)
    .filter((record) => Number(record.apiVersion.split('.')[0]) === majorVersion)
    .sort((a, b) => compareApiVersions(b.apiVersion, a.apiVersion))[0];

  return (match?.api as TApi | undefined) ?? null;
}
```

Call through the object you looked up — `api.doSomething()` — rather than pulling the method out first. The
methods are invoked with the API object as their `this`, and an implementation using private class fields
stops working the moment you detach one.

## Types, without installing anything

The protocol's entire type surface is small enough to paste into your own plugin. Drop this in a file of its
own; it adds no dependency and compiles against the `obsidian` types you already have.

```typescript
import type { EventRef } from 'obsidian';

export interface PluginLifecycleEventPayload {
  readonly apiVersions: readonly string[];
  readonly dependencyPluginIds: readonly string[];
  readonly pluginId: string;
  readonly pluginName: string;
  readonly pluginVersion: string;
}

export interface PublishedPluginApiRecord {
  readonly api: object;
  readonly apiVersion: string;
  readonly contract: Record<string, unknown>;
  readonly isRevoked: boolean;
  readonly pluginId: string;
}

declare global {
  // eslint-disable-next-line no-var -- `declare global` can only add a global through `var`.
  var __obsidianDevUtils: undefined | {
    pluginApiRegistry?: {
      value?: {
        records?: Record<string, PublishedPluginApiRecord[] | undefined>;
      };
    };
  };
}

declare module 'obsidian' {
  interface Workspace {
    on(
      name: 'obsidian-dev-utils:plugin-loaded' | 'obsidian-dev-utils:plugin-unloaded',
      callback: (payload: PluginLifecycleEventPayload) => unknown,
      context?: unknown
    ): EventRef;
  }
}
```

If you would rather not maintain a copy, there is a second route that is also free at runtime: add
`obsidian-dev-utils` as a **`devDependency`** and import the types from it. Types are erased when you build,
so nothing of this library reaches your bundle and your plugin's runtime is untouched — declining a framework
is a decision about the code you ship, and a type-only import ships nothing.

```typescript
import type { PluginLifecycleEventPayload } from 'obsidian-dev-utils/obsidian/plugin/plugin-lifecycle-events';
```

That import also carries the `Workspace.on` overload with it, so the `declare module 'obsidian'` block above
becomes unnecessary. The registry record type is the one piece it does not give you: nothing that consumes
this library ever reads a record — `watchPluginApi` is its whole surface — so the type stays unexported, and
those few lines are yours to keep either way.

## A complete consumer

Putting it together — read the current state at load, then follow the transitions:

```typescript
import { Plugin } from 'obsidian';

const PROVIDER_ID = 'their-plugin-id';
const PROVIDER_API_MAJOR_VERSION = 2;

interface TheirApi {
  doSomething(): void;
}

export class MyPlugin extends Plugin {
  private isProviderReady = false;

  public override onload(): void {
    this.isProviderReady = this.getProviderApi() !== null;

    this.registerEvent(this.app.workspace.on('obsidian-dev-utils:plugin-loaded', (payload) => {
      if (payload.pluginId === PROVIDER_ID) {
        this.isProviderReady = true;
      }
    }));

    this.registerEvent(this.app.workspace.on('obsidian-dev-utils:plugin-unloaded', (payload) => {
      if (payload.pluginId === PROVIDER_ID) {
        this.isProviderReady = false;
      }
    }));

    this.addCommand({
      checkCallback: (isChecking: boolean): boolean => {
        if (isChecking) {
          return this.isProviderReady;
        }

        this.getProviderApi()?.doSomething();
        return true;
      },
      id: 'do-something',
      name: 'Do something'
    });
  }

  private getProviderApi(): null | TheirApi {
    return getApi<TheirApi>(PROVIDER_ID, PROVIDER_API_MAJOR_VERSION);
  }
}
```

Two things in that shape are load-bearing. The **initial read** matters because the provider may well have
loaded before you did, and there is no replay to catch you up. And the **cached flag is a flag, never the
API** — `checkCallback` cannot `await` and has to answer synchronously, so availability is worth holding in
a field; the object itself is looked up again at the moment of use, one line further down.

Note what this example does **not** do when the provider is missing — it declines to act, and says nothing.
Whether a missing dependency should degrade quietly, warn, or refuse to run is yours to decide, and the
protocol takes no position on it.

## What is deliberately not in the protocol

Some of what `obsidian-dev-utils` builds on top of this is consumer-side policy rather than contract, and it
stays on that side on purpose. None of it is a gap, and you are entitled to a different answer for every
item:

- **The mandatory dependency gate** — refusing to run the plugin's feature surface until a dependency is
  present, the settings tab that explains why, the one-click repair button. Graceful degradation is a
  perfectly good alternative policy.
- **Revocable handles.** The named error on a call into an unloaded provider is a convenience the library
  builds for its own consumers; the rule above — look it up per use — buys you the same safety.
- **Payload validation.** Optional, debug-gated checking of an API call's arguments and return value.
- **Shape checking.** Verifying that a published API actually carries every method its contract names,
  before handing it over.

What *is* protocol is exactly the four things you need and cannot build for yourself: **discovery,
readiness, handle retrieval, and version negotiation**.
