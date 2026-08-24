/**
 * @file
 *
 * This module provides utility functions for processing Markdown content in Obsidian.
 */

/* v8 ignore start -- Deeply coupled to Obsidian runtime; requires running vault for meaningful testing. */

import type {
  DomEventsHandlers,
  DomEventsHandlersInfo,
  EmbedRegistryEmbedByExtensionRecord
} from '@obsidian-typings/obsidian-public-latest';
import type {
  App,
  TAbstractFile,
  TFile,
  TFolder
} from 'obsidian';

import { InternalPluginName } from '@obsidian-typings/obsidian-public-latest/implementations';
import { t } from 'i18next';
import {
  Component,
  HoverPopover,
  Keymap,
  MarkdownPreviewRenderer,
  MarkdownRenderer,
  Menu,
  Notice
} from 'obsidian';

import type { PathOrAbstractFile } from './file-system.ts';
import type { FolderNoteLocation } from './folder-note.ts';

import {
  invokeAsyncSafely,
  sleep
} from '../async.ts';
import {
  getZIndex,
  waitUntilConnected
} from '../html-element.ts';
import { normalizeOptionalProperties } from '../object-utils.ts';
import { isUrl } from '../url.ts';
import { MonkeyAroundComponent } from './components/monkey-around-component.ts';
import {
  getAbstractFileOrNull,
  getPath,
  isFile,
  isFolder
} from './file-system.ts';
import {
  resolveFolderNote,
  resolveFolderNoteConfig
} from './folder-note.ts';

/**
 * How long to let Obsidian settle before opening a folder note. The click can land right after an
 * operation that created, rewrote and trashed notes, and opening into the middle of Obsidian's own
 * reaction to that shows the note before its metadata has caught up.
 */
const DELAY_BEFORE_OPEN_IN_MILLISECONDS = 200;

/**
 * The sections an external link's context menu declares, in Obsidian's own order. The order is what
 * {@link Menu.sort} groups the items by, so it has to match what
 * {@link Workspace.handleExternalLinkContextMenu} and every `url-menu` listener expect to fill.
 */
const EXTERNAL_LINK_MENU_SECTIONS = [
  'title',
  'open',
  'selection',
  'clipboard',
  'info',
  'action',
  'view',
  '',
  'danger'
];

/**
 * The sections an internal link's context menu declares, in Obsidian's own order. See
 * {@link EXTERNAL_LINK_MENU_SECTIONS} — the counterpart for `file-menu` listeners.
 */
const INTERNAL_LINK_MENU_SECTIONS = [
  'title',
  'open',
  'action',
  'clipboard',
  'view',
  'info',
  '',
  'danger'
];

/**
 * The params for the full render.
 */
export interface FullRenderParams {
  /**
   * The Obsidian app instance.
   */
  readonly app: App;

  /**
   * The Component instance to use for the render.
   */
  readonly component?: Component;

  /**
   * The HTMLElement to render to.
   */
  readonly el: HTMLElement;

  /**
   * The Markdown string to render.
   */
  readonly markdown: string;

  /**
   * Whether to register link handlers for the rendered element.
   *
   * @default `false`
   */
  readonly shouldRegisterLinkHandlers?: boolean;

  /**
   * The source path to resolve relative links.
   *
   * @default `'/'`
   */
  readonly sourcePath?: string;
}

/**
 * Parameters for {@link markdownToHtml}.
 */
export interface MarkdownToHtmlParams {
  /**
   * The Obsidian app instance.
   */
  readonly app: App;

  /**
   * The Markdown string to convert.
   */
  readonly markdown: string;

  /**
   * The source path to resolve relative links.
   *
   * @default `''`
   */
  readonly sourcePath?: string;
}

/**
 * Parameters for {@link registerLinkHandlers}.
 */
export interface RegisterLinkHandlersParams {
  /**
   * The Obsidian app instance.
   */
  readonly app: App;

  /**
   * The HTMLElement to register link handlers for.
   */
  readonly el: HTMLElement;

  /**
   * The source path to resolve relative links from.
   *
   * @default `''`
   */
  readonly sourcePath?: string;
}

/**
 * Parameters for {@link renderExternalLink}.
 */
export interface RenderExternalLinkParams {
  /**
   * The Obsidian app instance.
   */
  readonly app: App;

  /**
   * The text to display for the external link.
   */
  readonly displayText?: string;

  /**
   * The URL to render the external link for.
   */
  readonly url: string;
}

/**
 * The folder-note setup {@link renderInternalLink} resolves a folder link's note with — everything
 * {@link resolveFolderNoteConfig} takes except the app, which the link already carries.
 */
export interface RenderInternalLinkFolderNoteOptions {
  /**
   * The extensions a folder note may carry. See {@link ResolveFolderNoteConfigParams.extensions}.
   *
   * @default `['md']`
   */
  readonly extensions?: readonly string[];

  /**
   * Whether the folder note is hidden in the file explorer. See
   * {@link ResolveFolderNoteConfigParams.isHidden}.
   *
   * @default `false`
   */
  readonly isHidden?: boolean;

  /**
   * Where the note sits relative to its folder. See {@link ResolveFolderNoteConfigParams.location}.
   *
   * @default {@link FolderNoteLocation.Auto}
   */
  readonly location?: FolderNoteLocation;

  /**
   * Names the folder note of a folder. See {@link ResolveFolderNoteConfigParams.resolveName}.
   *
   * @param folder - The folder whose note is being named.
   * @returns The note's name.
   * @default `(folder) => folder.name`
   */
  resolveName?(this: void, folder: TFolder): string;
}

/**
 * Parameters for {@link renderInternalLink}.
 */
export interface RenderInternalLinkParams {
  /**
   * The Obsidian app instance.
   */
  readonly app: App;

  /**
   * The text to display for the internal link.
   */
  readonly displayText?: string;

  /**
   * How to answer which note is a folder's folder note, when the link names a FOLDER.
   *
   * Omitted means {@link FolderNoteLocation.Auto}: the installed `folder-notes` plugin's live
   * configuration, or a note named after its folder, inside it, when that plugin is absent. Pass
   * `{ location: FolderNoteLocation.None }` for a folder link that must only ever reveal.
   *
   * @default `{}`
   */
  readonly folderNote?: RenderInternalLinkFolderNoteOptions;

  /**
   * The path or abstract file to render the internal link for.
   */
  readonly pathOrAbstractFile: PathOrAbstractFile;

  /**
   * Whether clicking a FILE link also highlights that file in the file explorer, on top of the open
   * Obsidian's own link handler performs.
   *
   * Opt-in, unlike the folder branch: a folder link has always revealed (revealing was all its click
   * could mean), whereas a file link has always only opened — so turning this on by default would change
   * what every existing caller's link does.
   *
   * @default `false`
   */
  readonly shouldRevealFile?: boolean;
}

interface FixedZIndexDomEventsHandlersInfoConstructorParams {
  readonly app: App;
  readonly el: HTMLElement;
  readonly path: string;
}

class EmbedByExtensionMdPatchComponent extends MonkeyAroundComponent {
  public constructor(private readonly embedByExtension: EmbedRegistryEmbedByExtensionRecord) {
    super();
  }

  public override onload(): void {
    this.registerMethodPatch({
      $object: this.embedByExtension,
      methodName: 'md',
      patchHandler: ({
        fallback,
        originalArguments: [context]
      }) => {
        context.displayMode = false;
        return fallback();
      }
    });
  }
}

class FixedZIndexDomEventsHandlersInfo implements DomEventsHandlersInfo {
  public readonly app: App;
  public readonly path: string;
  public get hoverPopover(): HoverPopover | null {
    return this._hoverPopover;
  }

  public set hoverPopover(hoverPopover: HoverPopover | null) {
    this._hoverPopover = hoverPopover;
    if (hoverPopover && this.zIndex !== undefined) {
      hoverPopover.hoverEl.setCssStyles({
        zIndex: String(this.zIndex)
      });
    }
  }

  private _hoverPopover: HoverPopover | null = null;

  private readonly el: HTMLElement;

  private zIndex?: number;

  public constructor(params: FixedZIndexDomEventsHandlersInfoConstructorParams) {
    this.app = params.app;
    this.path = params.path;
    this.el = params.el;

    invokeAsyncSafely(async () => {
      await waitUntilConnected(this.el);
      this.updateZIndex(this.el);
    });
  }

  private updateZIndex(element: HTMLElement): void {
    this.zIndex = getZIndex(element) + 1;
  }
}

/**
 * What a rendered link DOES when it is clicked, hovered, dragged or right-clicked.
 *
 * {@link MarkdownPreviewRenderer.registerDomEvents} only performs the DELEGATION half — which element an
 * event landed on, which link text it carries, and which of these methods to call. The half it does not
 * provide is this one, and Obsidian keeps its own implementation private: the only handle on it is the
 * instance a live preview view passes in. {@link getDomEventsHandlersConstructor} used to obtain it by
 * opening a real leaf on an arbitrary note and intercepting that call — which mutated the user's
 * workspace on EVERY consumer's load (a tab opening and closing, two `file-open` and two
 * `active-leaf-change` events, an unrelated note rendered in preview).
 *
 * These bodies are a port of that class, so nothing has to be opened. Keeping
 * {@link MarkdownPreviewRenderer.registerDomEvents} for the delegation is what keeps footnote links,
 * tags, external links, mod-click and drag behaving exactly as they do inside a real preview.
 */
class LinkDomEventsHandlers implements DomEventsHandlers {
  public constructor(private readonly info: DomEventsHandlersInfo) {}

  public onExternalLinkClick($event: MouseEvent, targetEl: HTMLElement, linkText: string): void {
    $event.preventDefault();
    if (!isUrl(linkText)) {
      new Notice(t(($) => $.obsidianDevUtils.notices.failedToOpenUrl, { url: linkText }));
      return;
    }

    const modifierPaneType = Keymap.isModEvent($event);
    targetEl.win.open(linkText, typeof modifierPaneType === 'boolean' ? '' : modifierPaneType);
  }

  public onExternalLinkRightClick($event: MouseEvent, targetEl: HTMLElement, linkText: string): void {
    const menu = Menu.forEvent($event);
    menu.addSections(EXTERNAL_LINK_MENU_SECTIONS);
    addCopyMenuItem(menu, targetEl);
    this.info.app.workspace.handleExternalLinkContextMenu(menu, linkText);
  }

  public onInternalLinkClick($event: MouseEvent, _targetEl: HTMLElement, linkText: string): void {
    $event.preventDefault();
    invokeAsyncSafely(() => this.info.app.workspace.openLinkText(linkText, this.info.path, Keymap.isModEvent($event)));
  }

  public onInternalLinkDrag($event: DragEvent, _targetEl: HTMLElement, linkText: string, title?: string): void {
    const dragManager = this.info.app.dragManager;
    dragManager.onDragStart($event, dragManager.dragLink($event, linkText, this.info.path, title));
  }

  public onInternalLinkMouseover($event: MouseEvent, targetEl: HTMLElement, linkText: string): void {
    // `hoverParent` is the info object itself, exactly as Obsidian passes its own — which is what keeps
    // `FixedZIndexDomEventsHandlersInfo`'s popover z-index fix in play.
    this.info.app.workspace.trigger('hover-link', {
      event: $event,
      hoverParent: this.info,
      linktext: linkText,
      source: 'preview',
      sourcePath: this.info.path,
      targetEl
    });
  }

  public onInternalLinkRightClick($event: MouseEvent, targetEl: HTMLElement, linkText: string): void {
    const menu = Menu.forEvent($event);
    menu.setParentElement(targetEl);
    menu.addSections(INTERNAL_LINK_MENU_SECTIONS);
    addCopyMenuItem(menu, targetEl);
    this.info.app.workspace.handleLinkContextMenu(menu, linkText, this.info.path);
  }

  public onTagClick(_$event: MouseEvent, _targetEl: HTMLElement, tag: string): void {
    // `registerDomEvents` has already called `preventDefault()` for a tag click.
    this.info.app.internalPlugins.getEnabledPluginById(InternalPluginName.GlobalSearch)?.openGlobalSearch(`tag:${tag}`);
  }
}

/**
 * Render the markdown and embeds.
 *
 * @param params - The parameters for the full render.
 * @returns The {@link Promise} that resolves when the full render is complete.
 */
export async function fullRender(params: FullRenderParams): Promise<void> {
  const sourcePath = params.sourcePath ?? '/';
  let shouldUnloadComponent = false;
  let component: Component;
  if (params.component) {
    component = params.component;
  } else {
    component = new Component();
    component.load();
    shouldUnloadComponent = true;
  }

  using _ = component.addChild(new EmbedByExtensionMdPatchComponent(params.app.embedRegistry.embedByExtension));

  await MarkdownRenderer.render(params.app, params.markdown, params.el, sourcePath, component);

  if (shouldUnloadComponent) {
    component.unload();
  }

  if (params.shouldRegisterLinkHandlers) {
    registerLinkHandlers(normalizeOptionalProperties<RegisterLinkHandlersParams>({
      app: params.app,
      el: params.el,
      sourcePath: params.sourcePath
    }));
  }
}

/**
 * Converts Markdown to HTML.
 *
 * @param params - The parameters for the conversion.
 * @returns The HTML string.
 */
export async function markdownToHtml(params: MarkdownToHtmlParams): Promise<string> {
  const {
    app,
    markdown,
    sourcePath
  } = params;
  const component = new Component();
  component.load();
  const renderDiv = createDiv();
  await MarkdownRenderer.render(app, markdown, renderDiv, sourcePath ?? '', component);
  const html = renderDiv.innerHTML;
  component.unload();
  return html;
}

/**
 * Registers link handlers for the given element.
 *
 * @param params - The parameters for registering link handlers.
 */
export function registerLinkHandlers(params: RegisterLinkHandlersParams): void {
  const {
    app,
    el,
    sourcePath
  } = params;
  MarkdownPreviewRenderer.registerDomEvents(
    el,
    new LinkDomEventsHandlers(
      new FixedZIndexDomEventsHandlersInfo({
        app,
        el,
        path: sourcePath ?? ''
      })
    )
  );
}

/**
 * Renders an external link.
 *
 * @param params - The parameters for rendering the external link.
 * @returns The HTMLAnchorElement containing the rendered external link.
 */
export async function renderExternalLink(params: RenderExternalLinkParams): Promise<HTMLAnchorElement> {
  const {
    app,
    url
  } = params;
  const displayText = params.displayText ?? url;
  const wrapperEl = createSpan();
  await fullRender({
    app,
    el: wrapperEl,
    markdown: `[${displayText}](${url})`
  });
  const aEl = wrapperEl.find('a') as HTMLAnchorElement;
  registerLinkHandlers({
    app,
    el: aEl
  });
  return aEl;
}

/**
 * Renders an internal link.
 *
 * What clicking the rendered link does depends on what it names:
 *
 * - A FILE is opened by Obsidian's own link handler — and, with
 *   {@link RenderInternalLinkParams.shouldRevealFile}, additionally revealed in the file explorer.
 * - A FOLDER cannot be opened, so its FOLDER NOTE is — the note whose properties describe the folder
 *   itself, resolved through {@link resolveFolderNote} (by default from the installed `folder-notes`
 *   plugin's live configuration). The reveal lands on that note, unless the note is hidden in the
 *   explorer, in which case it lands on the folder — revealing a hidden note would highlight nothing.
 *   A folder with NO folder note reveals the folder and opens nothing: nothing here ever creates a note.
 *
 * Everything is resolved at CLICK time rather than at render time, deliberately: a rendered link outlives
 * the operation that produced it, so a destination renamed in between still reveals the right item, and a
 * folder note written after the link appeared is still found.
 *
 * @param params - The parameters for rendering the internal link.
 * @returns The HTMLAnchorElement containing the rendered internal link.
 */
export async function renderInternalLink(params: RenderInternalLinkParams): Promise<HTMLAnchorElement> {
  const {
    app,
    folderNote,
    pathOrAbstractFile,
    shouldRevealFile
  } = params;
  const abstractFile = getAbstractFileOrNull({ app, pathOrFile: pathOrAbstractFile });
  const path = getPath(app, pathOrAbstractFile);
  const displayText = params.displayText ?? path;
  if (isFolder(abstractFile)) {
    return createEl('a', { text: displayText }, (aEl) => {
      aEl.addEventListener('click', ($event) => {
        $event.preventDefault();
        const config = resolveFolderNoteConfig({ app, ...folderNote });
        const folderNoteFile = resolveFolderNote({ app, config, folder: abstractFile });
        revealInFileExplorer(app, folderNoteFile && !config.isHidden ? folderNoteFile : abstractFile);
        if (folderNoteFile) {
          // A DOM listener cannot await, and the open has to outlive this handler: it settles first, for
          // The click that lands right as an operation finishes writing.
          invokeAsyncSafely(() => openAfterSettling(app, folderNoteFile));
        }
      });
    });
  }

  const wrapperEl = createSpan();
  await fullRender({
    app,
    el: wrapperEl,
    markdown: `[[${path}|${displayText}]]`
  });
  const aEl = wrapperEl.find('a') as HTMLAnchorElement;
  registerLinkHandlers({
    app,
    el: aEl
  });
  if (shouldRevealFile ?? false) {
    aEl.addEventListener('click', () => {
      // Layered ON TOP of Obsidian's own handler — no `preventDefault`, so the open is untouched. A path
      // That resolves to nothing gets no reveal: an unresolved link has nothing to reveal, and clicking
      // One CREATES the note it names.
      const file = getAbstractFileOrNull({ app, pathOrFile: pathOrAbstractFile });
      if (isFile(file)) {
        revealInFileExplorer(app, file);
      }
    });
  }
  return aEl;
}

/**
 * Adds the `clipboard`-section Copy item every link context menu carries, copying the link's DISPLAY
 * text — which is what Obsidian's own menu copies, not the target path.
 *
 * @param menu - The menu to add the item to.
 * @param targetEl - The link element the menu was opened on.
 */
function addCopyMenuItem(menu: Menu, targetEl: HTMLElement): void {
  menu.addItem((item) => {
    item
      .setSection('clipboard')
      .setTitle(t(($) => $.obsidianDevUtils.menu.copy))
      .setIcon('lucide-copy')
      .onClick(() => {
        invokeAsyncSafely(() => targetEl.win.navigator.clipboard.writeText(targetEl.getText()));
      });
  });
}

/**
 * Opens a file in the active leaf, once the vault has settled.
 *
 * @param app - The Obsidian app instance.
 * @param file - The file to open.
 * @returns A {@link Promise} that resolves once the file is open.
 */
async function openAfterSettling(app: App, file: TFile): Promise<void> {
  await sleep({ milliseconds: DELAY_BEFORE_OPEN_IN_MILLISECONDS });
  await app.workspace.getLeaf().openFile(file, { active: true });
}

/**
 * Highlights a file or folder in the file explorer, when that core plugin is enabled.
 *
 * @param app - The Obsidian app instance.
 * @param abstractFile - The file or folder to reveal.
 */
function revealInFileExplorer(app: App, abstractFile: TAbstractFile): void {
  app.internalPlugins.getEnabledPluginById(InternalPluginName.FileExplorer)?.revealInFolder(abstractFile);
}

/* v8 ignore stop */
