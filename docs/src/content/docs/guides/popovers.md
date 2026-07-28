---
title: Popovers
---

A popover is a small floating panel that asks the user for a value and resolves a promise with it —
the same shape as the [Modals](/obsidian-dev-utils/guides/modals/), for the cases a modal cannot
serve.

Reach for a popover instead of a modal when the UI must appear **at** the thing it acts on. A modal
dims the screen and is positioned by Obsidian, which is wrong for editing a link the user just
clicked, a value at the caret, or whatever a context menu was raised over.

In order for popovers to look properly, their styles have to be initialized. See
[Styling](/obsidian-dev-utils/guides/styling/) for more details.

## Anchors

A popover is placed at a resolved `PopoverAnchor` — viewport coordinates plus the document they
belong to — rather than at an element, because callers know the position in different ways. Carrying
the document explicitly is what makes an anchor inside a pop-out window work: the panel is appended
to, and clamped against, that window rather than the main one.

```ts
import {
  createAnchorFromDocumentCenter,
  createAnchorFromElement,
  createAnchorFromPoint,
  createAnchorFromSelection
} from 'obsidian-dev-utils/obsidian/popovers/popover-anchor';

const fromClick = createAnchorFromElement(linkEl);
const fromPointer = createAnchorFromPoint(evt.clientX, evt.clientY, activeDocument);
const fromCaret = createAnchorFromSelection(activeDocument);
const fallback = createAnchorFromDocumentCenter(activeDocument);
```

Wherever the popover is anchored, it is clamped back inside the window, so an anchor near the right
or bottom edge does not render it off-screen.

## Edit fields in a popover

`editFieldsInPopover` is the common case spelled declaratively: a text field per entry, resolving
with their values keyed by `key`, or `null` if the popover was dismissed. The keys are inferred, so
the result is typed without a cast.

```ts
import { editFieldsInPopover } from 'obsidian-dev-utils/obsidian/popovers/field-popover';

const values = await editFieldsInPopover({
  anchor: createAnchorFromElement(linkEl),
  fields: [
    { defaultValue: url, key: 'url', name: 'URL' },
    { defaultValue: alias, key: 'alias', name: 'Alias', placeholder: 'Display text' }
  ]
});

// values: { alias: string; url: string } | null
if (values) {
  applyLink(values.url, values.alias);
}
```

## Build a popover yourself

For anything the declarative form cannot express — a dropdown, a toggle, rendered markdown — use
`showPopover` and populate the content element. `build` returns a getter that is read when the
popover is confirmed; `cancel` and `confirm` let the content resolve the popover itself.

```ts
import { showPopover } from 'obsidian-dev-utils/obsidian/popovers/popover';

const chosen = await showPopover<string>({
  anchor: createAnchorFromSelection(activeDocument),
  build({ confirm, contentEl }) {
    const dropdown = new DropdownComponent(contentEl);
    dropdown.addOptions({ bar: 'Bar', foo: 'Foo' });
    dropdown.onChange(confirm);
    return () => dropdown.getValue();
  }
});
```

Both entry points accept `okButtonText`, `cancelButtonText` and extra `cssClasses`.

## Anchoring at a context menu

Obsidian's `file-menu` and `url-menu` events carry the target file or url but no event and no DOM
element, and by the time a menu item's callback runs the menu is closing — so there is nothing left
to measure. `PointerPositionComponent` records the right-click (or long-press) that raised the menu,
which is exactly where the user is looking.

```ts
import { PointerPositionComponent } from 'obsidian-dev-utils/obsidian/components/pointer-position-component';

const pointerPositionComponent = this.addChild(new PointerPositionComponent(this.app));

// Later, inside a menu item's callback:
const anchor = pointerPositionComponent.getLastPointerAnchor() ?? createAnchorFromDocumentCenter(activeDocument);
```

## Dismissal

A popover is dismissed by `Escape`, by its Cancel button, or by the next pointer gesture that starts
outside it — resolving with `null` in each case. `Enter` and the OK button confirm it.

The outside dismissal listens for `pointerdown` rather than `click` deliberately. A popover is
typically opened from a `click` handler, and the very same click would otherwise reach the listener
and close the popover the instant it appears.
