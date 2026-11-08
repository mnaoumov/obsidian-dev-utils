# CHANGELOG

## 107.5.1

This release has 1 documentation change.

### Documentation

- explain in the README why `obsidian-dev-utils` was retired and split into five packages

## 107.5.0

This release has 1 documentation change.

### Documentation

- retire `obsidian-dev-utils` in favour of the `@mnaoumov/*` packages, with an import map in the README

## 107.4.1

This release has 1 fix.

### Fixed

- **styles:** merge scoping the tldraw button color workaround to the library UI

## 107.4.0

This release has 1 new feature.

### New

- **obsidian:** merge parsing GFM `www.` autolink literals as external links

## 107.3.1

This release has 2 fixes.

### Fixed

- **obsidian:** merge waiting out a plugin update before announcing a lost dependency
- **docs:** merge rendering GitHub alerts as Starlight asides again

## 107.3.0

This release has 1 new feature.

### New

- **obsidian:** merge delivering trusted input to a popout window, not always the main one

## 107.2.0

This release has 1 new feature and 1 fix.

### New

- **script-utils:** close the issues a release carries from publishGitHubRelease

### Fixed

- **obsidian:** skip a folder already gone from disk in deleteEmptyFolder

## 107.1.0

This release has 2 new features. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### New

- **obsidian:** match property entries in isTreatedAsAttachment
- **commitlint:** spellcheck the commit header before it can reach a changelog

## 107.0.0

This release has 4 breaking changes, 14 new features, 24 fixes and 2 documentation changes. 4 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Breaking changes

- **obsidian:** remove the deprecated fixFrontmatterMarkdownLinks
- **deps:** move obsidian-integration-testing to ^17.0.1, peer range included
- **eslint:** fail lint on a warning
- **esbuild:** stop resolving dependencies to their Node builds in plugin bundles

### New

- **obsidian:** deprecate fixFrontmatterMarkdownLinks
- **markdown:** make the file-explorer reveal awaitable
- **metadata-cache:** answer per-file backlink lookups from a backlink index
- **components:** add ReleaseNotesComponent that names its plugin
- **eslint-rules:** report a {@link} whose target no longer resolves
- **gate:** refuse a package-lock entry with no resolved or integrity
- **commitlint:** refuse a commit message matching the forbidden-patterns list
- **components:** add CorePluginToggleComponent for core plugin enable/disable edges
- **vitest-config:** refuse to run integration tests against a stale plugin build
- **exec:** say when a child crashed instead of reporting an ordinary exit code
- **nano-staged-config:** partition spellcheck so it never reads a file being rewritten
- **vitest-config:** give desktop-performance a 600 s eval cap and lint perf suites against it
- **obsidian:** add normalizeLinkName, the one definition of when two link names match
- **version:** refuse a changelog section matching the maintainer's unpublished forbidden patterns

### Fixed

- **obsidian:** wait for the whole component tree before a layout-ready handler
- **obsidian:** locate an empty link label relative to its own node
- **obsidian:** anchor the templates language delimiters
- **obsidian:** refuse a code block that appears twice in the note
- **canvas:** mirror only the multi-value links the frontmatter plugin adds
- **transformers:** omit a key whose transformed value is undefined
- **gate:** skip a check whose script the project does not define
- **metadata-cache:** stop getBacklinksForFileSafe retrying forever on a canvas
- **vault-delete:** visit every child of a folder in deleteIfNotUsed
- **styles:** make the multiple-dropdown and loop selectors match their elements
- **link:** key a backlink snapshot's edit by the provider it was built with
- **plugin-settings:** write the default record when no data.json exists
- **demo-vault-coverage:** read readonly interface property signatures
- **markdown-code-block-processor:** stop getCodeBlockMarkdownInfo saving the note
- **deps:** restore the lockfile's missing resolved and integrity fields
- **demo-vault-buttons:** name a caption two buttons share, not a button never rendered
- **esbuild:** make `using` work on engines without Symbol.dispose
- **error:** keep the error message on engines whose stack carries no header line
- **eslint-config:** let a consumer's no-console setting reach the console check
- **loop:** keep the progress notice on screen for the whole run
- **demo-vault:** count only the code buttons a note renders, and add the options a docs vault needs
- **markdownlint:** stop MD025 counting a front matter title property as a heading
- **deps:** raise eslint-plugin-unicorn to 76, whose early-exit fixers stop emitting a tab
- **demo-vault-coverage:** count function-typed property signatures as methods

### Documentation

- fix two {@link} tags left behind by renames
- **metadata-cache:** warn that the read-named helpers save dirty editor views

## 106.0.0

This release has 2 breaking changes, 3 new features, 1 fix and 3 documentation changes. 2 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Breaking changes

- **deps:** move the obsidian-integration-testing peer range to ^16.0.0
- **version:** refuse a bump below what the commits since the last tag force

### New

- **link:** carry offsetRange through the four update-link wrappers
- **vitest-config:** pin the reporters so a run reports the same for a session as for a developer
- **metadata-cache:** recognize the Advanced Metadata Cache plugin id beside backlink-cache

### Fixed

- **nano-staged-config:** run lint:fix and format under one key so the writers cannot race

### Documentation

- **changelog:** say 105.1.0's vitest-config change was breaking and should have been a major
- **og-image:** say the favicon is rendered in the header, because it is
- **og-image:** say that the Inter TTFs are vendored, because they are

## 105.2.0

This release has 1 new feature and 3 documentation changes. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### New

- **frontmatter:** add an opt-in CST-splice formatting preserver

### Documentation

- **frontmatter:** reword a comment the spell check cannot read
- index the deliberately-under-cap marker beside the rule it belongs to
- say how a closure deliberately left under the eval cap records that

## 105.1.0

- style: satisfy the rules the unicorn 75 update brings
- chore: update libs
- docs(agents): record the local .astro glob in the nano-staged entry
- chore(nano-staged): lint staged .astro files before a commit
- feat(vitest-config)!: run every plugin's unit tests on the VM pool

Added after the fact: the `feat(vitest-config)!` entry above is a BREAKING change, so this release should have been `106.0.0` rather than a minor, and every consumer on a caret range took the move to the VM pool with no version signal. It is published and cannot be unpublished. `npm run version` now refuses a bump lower than the commits since the last tag force, so a break can no longer ship without a version signal.

## 105.0.0

This release has 2 breaking changes, 1 new feature, 4 fixes, 1 improvement and 5 documentation changes. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Breaking changes

- take method-signature-style back to its property default
- import the per-eval cap instead of restating it

### New

- **version:** spellcheck the settled changelog section before it is written

### Fixed

- **eslint-config:** lint the docs-site test as a test, not as a source file
- **eslint-config:** treat a build-script test as a test, not as a script
- **markdownlint:** exempt a callout marker line from no-soft-break-in-paragraph
- **version:** lint the settled changelog before it is written

### Improved

- **vitest-config:** build jsdom once per worker, not once per test file

### Documentation

- record the docs-site test glob beside its build-script sibling
- record the VM pool's one cost where a test author will meet it
- record the changelog spellcheck and why that half shells out
- stop crediting markdownlint-cli2 to the js-yaml backport
- record why the harness peer range is now a hard floor

## 104.0.1

This release has 7 new features, 3 fixes and 3 documentation changes. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### New

- **eslint-rules:** count a bounded retry helper once per call site
- **markdownlint:** unwrap this repo's markdown and turn no-soft-break-in-paragraph on
- **markdownlint:** add a no-soft-break-in-paragraph rule, registered but turned off
- **gate:** add --integration, and give the integration default a reason that is true
- **demo-vault-buttons:** refuse a budget pair the transport cannot honour
- **eslint-rules:** size deadline-bounded and counting loops in the wait-cap rule
- require every custom vitest project to declare its own include

### Fixed

- **lint:** let a comment open by naming a camelCase symbol
- **version:** stop a default merge subject reaching the published changelog
- **integration:** make an over-cap eval say so, and stop the hover helper lying

### Documentation

- **changelog:** replace a raw merge subject with the change it shipped
- **agents:** land the provider side of the cross-plugin API rule
- correct the perf project's cost claim and name its weekly sweep

## 104.0.0

This release has 1 breaking change, 3 fixes and 2 documentation changes. 3 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Breaking changes

- **disposable:** give both dispose-path aggregates a message that names the failure — BREAKING: `createAggregateError` moved to the `aggregate-error` subpath; import it from `obsidian-dev-utils/aggregate-error`.

### Fixed

- **lint:** stop capitalizing every continuation line of a wrapped comment
- **lint:** read Astro's generated types from where Astro writes them
- **linters:** ignore Claude Code's worktree folder in the ESLint and markdownlint configs

### Documentation

- **agents:** say the harness switches the settings popout off, which the recipe below assumes
- state what each convention says instead of citing it by id

## 103.2.0

This release has 2 fixes and 2 documentation changes.

### Fixed

- **command-handlers:** tie onloadImpl commands to the feature surface, not to the plugin
- **plugin:** store the gate component before adding it, so onloadImpl can read it

### Documentation

- **plugin-api:** document the protocol for plugins that do not use this library
- document the deepmerge-ts and fflate advisory overrides

## 103.1.0

This release has 1 new feature and 2 documentation changes.

### New

- **error:** give every AggregateError a message naming the failure

### Documentation

- strip private tracker references from checked-in files
- **script-utils:** say the integration aggregate leaves desktop-performance out on purpose

## 103.0.0

This release has 1 breaking change.

### Breaking changes

- **eslint-config:** enforce no-untrusted-input-events on Android files too

## 102.2.0

This release has 2 new features. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### New

- **components:** share the Templates language grammar across every plugin built on this library
- **plugin-gate-component:** expose whether a warning conflict is in force

## 102.1.0

This release has 1 new feature. 4 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### New

- **obsidian/link:** add editBacklinksSnapshot, the primitive editBacklinks now wraps

## 102.0.0

This release has 1 breaking change.

### Breaking changes

- **script-utils:** write demo-vault archives with fflate, dropping adm-zip from the package

## 101.8.0

This release has 1 new feature.

### New

- **script-utils:** enforce the transport's script-timeout cap on in-Obsidian closures

## 101.7.0

This release has 2 new features.

### New

- **obsidian:** let a plugin declare what it refuses to run beside
- **obsidian:** make plugin dependencies a first-class concept

## 101.6.0

This release has 1 new feature and 1 documentation change. 2 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### New

- **obsidian:** add a reusable settings-migration component and its contract

### Documentation

- **obsidian:** name the two CDP commands behind a mobile tap and a long-press

## 101.5.0

This release has 3 new features and 1 fix.

### New

- let a call site choose whether a modal input is spell-checked
- **link:** accept the remaining shaping params on the bulk link-update path
- **script-utils:** add a gate command that is the release preflight itself

### Fixed

- **script-utils:** run the tests once in the gate, not once plain and once with coverage

## 101.4.1

This release has 1 fix. 2 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Fixed

- **vitest-config:** stop declaring a root-level include, which widens every project under vitest 5

## 101.4.0

This release has 1 new feature.

### New

- **vault:** add VaultTransaction.copy and folder support in copySafe

## 101.3.0

This release has 1 fix and 1 other change.

### Fixed

- **modals:** space the instruction strip's key hint and its injected control

### Other changes

- The fix adds two exported `CssClass` members, `ModalCommandControl` and `PromptInstructionCommand`, so this is a minor rather than a patch.

## 101.2.0

This release has 1 new feature.

### New

- add formatBytes and toArrayBuffer

## 101.1.1

This release has 1 fix.

### Fixed

- **canvas:** stop serializing a retry sentinel over a canvas text node

## 101.1.0

This release has 1 new feature.

### New

- **link:** accept a linkPathStyle on the bulk link-update path

## 101.0.0

This release has 1 breaking change and 1 fix.

### Breaking changes

- **rename-delete-handler:** reduce the component to a single owner

### Fixed

- **version:** fall back to the full history when the changelog heading is not a tag

## 100.2.0

This release has 1 new feature and 2 documentation changes. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### New

- **eslint-config:** exempt desktop-only modules and unit tests from the Node-builtins bans

### Documentation

- **eslint-config:** reword the comment coinage cspell rejects
- **agents:** name the eslint-typecheck timeout as load, not a broken rule

## 100.1.0

This release has 1 new feature and 1 documentation change.

### New

- **note-priority:** publish filterHighestPriorityNotePaths

### Documentation

- **agents:** scope the npm 12 npm pack breakage to the library release path

## 100.0.0

This release has 1 breaking change.

### Breaking changes

- **attachment-unit-folder:** own the designation, not just the walker

## 99.0.0

This release has 1 breaking change, 2 new features and 3 fixes.

### Breaking changes

- **plugin-suggestion:** decide the notice after the host settings load

### New

- **validation:** own the Windows reserved-name and trailing-character rules
- **link:** scope link editing to an offset range

### Fixed

- **vault:** complete the operation when there is nothing to write
- **package-manager:** collect every signal before picking the manager
- **script-utils:** route the remaining npm run hops through the detected package manager

## 98.0.0

This release has 3 breaking changes, 1 new feature, 4 fixes and 2 documentation changes. 4 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Breaking changes

- **deps:** require obsidian-integration-testing ^12 as a peer, so version 11 no longer resolves
- **demo-vault:** move the version out of the archive name and into the archive
- **obsidian:** mirror the mobile trusted-input path into the library

### New

- **script-utils:** lint the root manifest.json and LICENSE, which nothing linted before

### Fixed

- **build:** glob svelte extensions, so svelte-check can actually run
- **build:** run the buildCompile orchestrator instead of the typescript leaf
- **script-utils:** make the release run end to end on npm 12
- **script-utils:** resolve tool binaries from node_modules/.bin instead of npx

### Documentation

- **deps:** record that the obsidian-integration-testing peer is at 12.x, not 11.x
- **eslint-config:** record that jsdoc/no-defaults is kept deliberately

## 97.0.0

This release has 1 breaking change and 1 documentation change.

### Breaking changes

- **zip-extractor:** read demo-vault archives with node:zlib, dropping adm-zip from the bundle

### Documentation

- **agents:** record the two npm 12 regressions on the release path, and how to get past each

## 96.6.0

This release has 1 new feature.

### New

- **modals:** let the command builder drive any modal, and prompt() take one

## 96.5.4

This release has 1 fix.

### Fixed

- **templates:** call parseVersionArguments, and type-check templates so a rename cannot ship broken

## 96.5.3

This release has 2 fixes.

### Fixed

- **version:** extract the changelog section by lines, so a first release ships its notes
- **version:** settle the changelog before bumping, and refuse a blocking review with no TTY

## 96.5.2

This release has 2 fixes and 1 documentation change. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Fixed

- **deps:** declare the obsidian-integration-testing peer at ^11
- **deps:** drop the brace-expansion file: override that breaks a clean install

### Documentation

- **agents:** record how to pick a release bump, and squash superseded commits

## 96.5.1

This release has 1 breaking change, 4 new features and 1 fix.

### Breaking changes

- **url:** add pathToFileUrl and move encodeUrl into url.ts

### New

- **templater:** add best-effort access to Templater's internals
- **frontmatter:** add a recursive empty-value cleaner
- **file-system:** add getBasename and getExtension for files and folders
- **rmdir-guard:** add opt-in RmdirGuardComponent

### Fixed

- **obsidian:** load adm-zip lazily so the whole library still imports on mobile

## 96.5.0

This release has 1 new feature and 1 documentation change.

### New

- **abort-controller:** add a shared, resettable app-wide abort controller

### Documentation

- note that find-overexposed only runs in the release preflight

## 96.4.0

This release has 1 new feature and 1 fix.

### New

- **plugin-api:** add a typed, versioned, lifecycle-aware cross-plugin API registry

### Fixed

- **over-exposure:** do not abort the member analysis on a TSDoc link to a member

## 96.3.1

This release has 1 fix. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Fixed

- **monkey-around:** record the patch token on the method a patch installs

## 96.3.0

This release has 1 new feature. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### New

- **components:** add PluginSuggestionComponent and take note-priority in

## 96.2.2

This release has 1 breaking change and 1 documentation change. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Breaking changes

- **setup:** fail a test on any unhandled async error, including between tests

### Documentation

- point other plugins at their community.obsidian.md pages

## 96.2.1

This release has 1 fix. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Fixed

- **exec:** reserve command-line budget for the child's own shim expansion

## 96.2.0

This release has 1 new feature. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### New

- **eslint:** add no-untrusted-input-events, banning dispatched input in integration tests

## 96.1.0

This release has 1 new feature and 1 documentation change.

### New

- **desktop-trusted-input:** add trusted clickMouse and clickElement

### Documentation

- **agents:** record why a position-bearing link key breaks, and that a skipped link must be logged

## 96.0.3

This release has 1 fix.

### Fixed

- **rename-delete-handler:** key links by text, not position, so a concurrent edit cannot orphan them (<https://github.com/mnaoumov/obsidian-custom-attachment-location/issues/60>)

## 96.0.2

This release has 1 fix and 1 documentation change. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Fixed

- **strict-proxy:** yield on the properties test tooling duck-types on

### Documentation

- **agents:** record that the build must be self-sufficient, because CI rebuilds

## 96.0.1

This release has 1 fix.

### Fixed

- **build:** stamp the generated library values during the build, not during the release

## 96.0.0

This release has 1 breaking change and 1 new feature. 2 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Breaking changes

- **version:** read minAppVersion from the desktop feed, not GitHub's latest release

### New

- **command-handlers:** let an editor command add itself to the readable-line-length margin menu

## 95.0.0

This release has 1 breaking change and 1 fix. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Breaking changes

- **markdown:** register link handlers without opening a workspace leaf

### Fixed

- **preprocess-plugin:** fill in a partial host process instead of skipping the shim

## 94.8.0

This release has 1 new feature. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### New

- **rename-delete-handler:** let a consumer relocate an attachment a deletion would strand

## 94.7.0

This release has 1 breaking change and 1 fix. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Breaking changes

- **npm-publish:** authenticate the publish with trusted publishing instead of an NPM token

### Fixed

- **rename-delete-handler:** protect a still-referenced attachment from a folder deletion

## 94.6.1

This release has 1 fix. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Fixed

- resolve the child environment at spawn time, not at import

## 94.6.0

This release has 2 new features and 2 fixes.

### New

- **attachment-unit-folder:** resolve the folder an attachment must travel with
- **blob:** carry JPEG metadata across a canvas re-encode, behind an option

### Fixed

- override deepmerge-ts to clear GHSA-ggr8-5vv4-36mx
- **plugin-settings-component:** stop a component that knows no properties from emptying data.json

## 94.5.0

This release has 1 new feature.

### New

- **demo-vault-buttons:** walk group folders, not just the vault root

## 94.4.2

This release has 1 fix and 1 documentation change.

### Fixed

- **demo-vault-buttons:** re-open the note before each click

### Documentation

- **demo-vault:** document the mechanism details only the rule set held

## 94.4.1

This release has 1 fix.

### Fixed

- **demo-vault-buttons:** walk the note instead of pinning the preview to the bottom

## 94.4.0

This release has 1 new feature, 1 fix and 1 documentation change. 3 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### New

- **script-utils:** add a demo-vault button-clicking suite

### Fixed

- **vitest-config:** exclude declaration files from coverage by default

### Documentation

- **demo-vault:** document the button-clicking suite and make it the mechanism every plugin uses

## 94.3.0

This release has 1 new feature and 1 documentation change.

### New

- **demo-vault-coverage:** let a settings-less plugin register the suite

### Documentation

- use NATO placeholders instead of foo, bar and baz

## 94.2.0

This release has 1 new feature.

### New

- **markdown:** teach renderInternalLink the folder-note concept

## 94.1.0

This release has 1 new feature. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### New

- **prompt:** follow the vault spellcheck setting

## 94.0.0

This release has 1 breaking change.

### Breaking changes

- **demo-vault:** own the four app.json settings instead of asking every vault to pin them

## 93.3.1

This release has 1 fix.

### Fixed

- **markdownlint:** ignore every GitHub alert label, not just note and warning

## 93.3.0

This release has 2 new features.

### New

- **demo-vault:** add inline wikilink directives, shaped after ESLint's
- **demo-vault:** let a note declare why its wikilinks are the point

## 93.2.2

This release has 1 new feature. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### New

- install folder notes in every demo vault

## 93.2.1

This release has 1 fix. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Fixed

- **prompt:** defer the invalid outline until the input is touched

## 93.2.0

This release has 1 new feature.

### New

- **plugin:** add a settings component and unload replaced components

## 93.1.0

This release has 1 breaking change.

### Breaking changes

- **community-plugins:** apply settings through a running plugin instead of data.json

## 93.0.0

This release has 2 breaking changes, 1 new feature and 1 fix.

### Breaking changes

- **demo-vault:** name the demonstrated plugin in the helper settings
- **notices:** replace isReusable with a notice mode, adding append

### New

- **workspace:** add main-window helpers and scoped window switching

### Fixed

- **demo-vault:** keep the opener progress notice out of the shared slot

## 92.1.0

This release has 1 documentation change.

### Documentation

- missing descriptions

## 92.0.0

This release has 2 new features and 1 documentation change. 2 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### New

- **demo-vault:** warn that the demo vault is a sandbox and enforce the authoring convention
- **modals:** minimize a minimizable modal on a background click

### Documentation

- describe the three test layers instead of claiming unit tests only

## 91.0.1

This release has 1 fix. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Fixed

- **modals:** report prompt validity only once touched

## 91.0.0

This release has 1 breaking change.

### Breaking changes

- update libs and adopt obsidian-integration-testing 10

## 90.2.0

This release has 1 new feature. 2 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### New

- **attachment-path:** add getAttachmentFolderPathSyncOrNull

## 90.1.1

This release has 1 fix. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Fixed

- hotreload

## 90.1.0

This release has 1 new feature. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### New

- stop the dev build when its owned Obsidian instance is closed

## 90.0.1

This release has 1 fix.

### Fixed

- load the plugin's component wrapper before wiring anything up

## 90.0.0

This release has maintenance changes only. 2 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

## 89.0.0

This release has 3 breaking changes, 1 new feature and 5 fixes. 7 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Breaking changes

- bridge every plugin's command handlers into Notebook Navigator's context menus
- migrate to unicorn rules
- drop the Async suffix from SyntaxHighlightingComponent's register methods

### New

- **eslint:** enforce kebab-case file names

### Fixed

- build
- **resource-lock:** make a lock follow its resource across a rename
- **rename-delete-handler:** stop the phantom old-path registration disarming the link update
- **markdownlint:** ignore vendored node_modules markdown on top of the gitignore-derived set
- **i18n:** report the lazy I18N fallback via a debug namespace

## 88.8.0

This release has 1 new feature.

### New

- **script-utils:** unify the per-plugin vitest configuration

## 88.7.0

This release has 2 new features. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### New

- add SyntaxHighlightingComponent
- **script-utils:** derive tooling ignores from .gitignore and add per-script off switches

## 88.6.0

This release has 1 new feature and 2 fixes. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### New

- **plugin-settings-tab:** render declaratively via the Obsidian 1.13 settings API

### Fixed

- **component-ex:** abandon lifecycle-guarded work quietly after unload
- **deps:** correct @lezer/common to 1.5.2, the version Obsidian bundles

## 88.5.0

This release has 1 new feature. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### New

- **integration-test:** publish the consumer integration-test setup

## 88.4.0

This release has 2 new features and 2 fixes. 2 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### New

- **file-system:** add isTreatedAsAttachment predicate
- **popovers:** add an anchored field-editor popover

### Fixed

- **attachment-path:** resolve the note folder from the path
- **path-settings:** stop throwing on un-parseable path entries

## 88.3.0

This release has 2 new features, 1 fix and 1 documentation change. 2 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### New

- autolink bare URLs in generated changelog
- re <https://github.com/mnaoumov/obsidian-custom-attachment-location/issues/25>

### Fixed

- re <https://github.com/mnaoumov/obsidian-advanced-note-composer/issues/146>

### Documentation

- autolink bare URLs in the 88.2.0 changelog section

## 88.2.0

This release has 1 new feature and 4 fixes. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### New

- **attachment-path:** add isAtProperAttachmentPath helper

### Fixed

- re <https://github.com/mnaoumov/obsidian-custom-attachment-location/issues/20>
- re <https://github.com/mnaoumov/obsidian-custom-attachment-location/issues/27>
- re <https://github.com/mnaoumov/obsidian-custom-attachment-location/issues/45>
- re <https://github.com/mnaoumov/obsidian-custom-attachment-location/issues/22>

## 88.1.2

This release has 1 fix. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Fixed

- **canvas:** apply fixFrontmatterMarkdownLinks in getCanvasReferences text-node parse

## 88.1.1

This release has maintenance changes only. 2 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

## 88.1.0

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 88.0.0

This release has 1 breaking change, 1 new feature and 3 fixes.

### Breaking changes

- **vault:** thread pluginNoticeComponent to fix process() timeout-notice crash

### New

- **vault:** export cleanupEmptyFolders helper

### Fixed

- **docs:** skip base-absolute internal links on the 127.0.0.1 linkinator host
- don't run onLayoutReady on failures
- **layout-ready-component:** run onLayoutReady only after the in-flight load settles

## 87.3.1

This release has 1 fix. 3 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Fixed

- **rename-delete-handler:** move attachments regardless of update-links setting

## 87.3.0

This release has 1 new feature.

### New

- change demo vault artifact name

## 87.2.0

This release has 1 new feature. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### New

- **demo-vault:** show progress immediately, cache archives only, extract fresh per open

## 87.1.2

This release has 2 new features. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### New

- **demo-vault-helper:** create the invocable scripts folder on bootstrap
- **community-plugins:** add installConfigureEnableCommunityPlugin

## 87.1.1

This release has 1 fix. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Fixed

- load original-fs via window.require so demo-vault asar extraction works

## 87.1.0

This release has 1 fix.

### Fixed

- demo-vault with asar

## 87.0.4

This release has 1 new feature.

### New

- **demo-vault-coverage:** reflect class & enum and add exported-function coverage

## 87.0.3

This release has 1 new feature and 1 fix. 2 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### New

- universal demo-vault-helper bootstrap plugin

### Fixed

- **reg-exp:** prevent code-block scan from freezing on unterminated fences

## 87.0.2

This release has 1 fix.

### Fixed

- exclude nested node_modules from markdown lint/link-check globs

## 87.0.1

This release has 2 fixes. 2 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Fixed

- shell-quote exec args per platform so paths with metacharacters survive
- quote batched exec args so paths with spaces stay a single argument

## 87.0.0

This release has 1 breaking change and 1 fix.

### Breaking changes

- rework hard-to-close notice close API

### Fixed

- style the notice close button as a round clickable-icon

## 86.2.0

This release has 1 breaking change, 2 new features and 6 fixes. 6 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Breaking changes

- **type:** replace the typeAsserter() factory with a TypeAsserter class

### New

- install community plugin
- **docs:** validate built-site links and expand generator test coverage

### Fixed

- remove unreachable abstract definite-assignment lint rule
- build
- **dev:** install/enable HotReload via the owned Obsidian instance
- **notices:** let interactive buttons on a hard-to-close notice receive clicks
- dynamic import
- **docs:** restore cached API sidebar

## 86.1.3

This release has 1 fix.

### Fixed

- **ci:** dispatch Pages deployment with repository

## 86.1.2

This release has 2 documentation changes. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Documentation

- render GitHub alerts as Starlight asides
- migrate to AGENTS.md

## 86.1.1

This release has 1 new feature, 3 fixes and 1 documentation change.

### New

- **docs:** add Getting started guide, __merged examples, and hero logo

### Fixed

- **docs:** eliminate broken links in the generated API pages
- **docs:** resolve guide cross-links and the edit-page link
- **docs:** repair the Pages build — track the API barrel, bump cache action

### Documentation

- fix links

## 86.1.0

This release has 1 documentation change.

### Documentation

- add generator

## 86.0.0

This release has 2 breaking changes, 4 new features and 1 fix. 6 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Breaking changes

- add hard to close notices
- add `unlock current note` command to each plugin

### New

- close button on minimized modal
- add EMPTY - common workaround to fight false-negatives with eslint
- demo vaults
- migrate funcs from obsidian-integration-testing

### Fixed

- build

## 85.1.0

This release has 1 new feature and 1 documentation change. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### New

- **link:** normalize file:// links in multi-link frontmatter values

### Documentation

- mark multi-value frontmatter file:// task done, pending release

## 85.0.0

This release has 1 breaking change, 3 new features and 1 fix. 2 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Breaking changes

- loop() signature

### New

- process file links in frontmatter
- improve lock
- add support for `file://` links

### Fixed

- **markdownlint:** restore default "x" ignored label for MD052

## 84.6.1

This release has 1 fix. 3 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Fixed

- block the settings popout while a modal is minimized

## 84.6.0

This release has 1 new feature and 1 fix. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### New

- prevent almost all actions while modal is minimized

### Fixed

- enforce editor lock against Shift+Enter and other key-driven edits

## 84.5.4

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 84.5.3

This release has 1 fix. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Fixed

- resolve classic TS API via typescript-6 alias so tooling survives TypeScript 7 consumers

## 84.5.2

This release has 1 documentation change. 4 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Documentation

- explain the typescript 6 (tooling) + 7 (compilation) split

## 84.5.1

This release has 1 fix.

### Fixed

- **async:** build sleep/abortSignalTimeout timer on globalThis.setTimeout

## 84.5.0

This release has 1 new feature and 3 documentation changes.

### New

- **obsidian:** add SuggestModalCommandBuilder

### Documentation

- fix markdown lint blanks around headings and lists
- mark SuggestModalCommandBuilder dev-utils extraction done
- prune shipped task sections and drop cross-scope rule refs

## 84.4.0

This release has 2 fixes and 1 documentation change. 2 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Fixed

- **test-helpers:** accept optional methods in mockImplementation
- keep minimized modal bar opaque on hover

### Documentation

- record deferred real-hover regression test for <https://github.com/mnaoumov/obsidian-advanced-note-composer/issues/124>

## 84.3.0

This release has 1 new feature, 1 fix and 1 documentation change. 3 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### New

- **obsidian:** restore minimized modal by clicking anywhere on the bar

### Fixed

- **async:** reject in runWithTimeout when terminated by timeout

### Documentation

- cleanup

## 84.2.0

This release has maintenance changes only. 2 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

## 84.1.0

This release has 1 new feature and 2 documentation changes.

### New

- **obsidian:** add syncOpenEditorBuffersForPath, use it in VaultTransaction rollback

### Documentation

- cleanup
- resolve the VaultTransaction open-editor blocker

## 84.0.0

This release has 1 breaking change, 6 new features and 9 documentation changes. 7 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Breaking changes

- **obsidian:** rename EditorLockComponent to ResourceLockComponent

### New

- **obsidian:** add external-change detection backstop for locked resources
- **obsidian:** let VaultTransaction hold a mutation-bypass scope
- **obsidian:** add owner sessions to arm sanctioned mutations past the blocker
- **obsidian:** block vault mutations of locked resources (opt-in)
- **obsidian:** add subtree-aware locking to the editor lock manager
- **obsidian:** add VaultTransaction reversible mutation log

### Documentation

- mark the ResourceLockComponent rename done (dev-utils half complete)
- mark phase 3 (external-change detection) done
- mark VaultTransaction bypass done; phase 3 detector is next
- record the ambient mutation-bypass design (supersedes one-shot arming)
- record owner-session arming done; note VaultTransaction-arming design care
- mark phase 2 complete and flag the phase 3/4 arming interdependency
- record approval to redesign the editor lock into unified records
- mark phase 2a done and record the phase 2b blocker-gating decision
- mark VaultTransaction (phase 1) done and record staging redesign

## 83.3.0

This release has 2 new features. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### New

- showNoticeAfterDelay
- don't close plugin notice on click on interactive els

## 83.2.0

This release has 2 new features, 1 fix and 2 documentation changes. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### New

- highlight the plugin name in notices with an accent color
- support custom content in runWithTimeoutNotice

### Fixed

- make sleep controllable by vitest fake timers

### Documentation

- cleanup
- record fake-timer-controllable timing-primitive rule

## 83.1.0

This release has 2 new features and 2 fixes. 4 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### New

- migrate obsidianmd rules
- add getBasesContextConstructor

### Fixed

- link
- compilation

## 83.0.0

This release has 4 breaking changes, 1 new feature, 1 fix and 2 documentation changes. 4 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Breaking changes

- reimplement html-element helpers agnostically (port enhance.js)
- split the Obsidian-coupled html-element helpers into the obsidian layer
- move css-class into the obsidian layer
- inject globalState instead of an ambient plugin id

### New

- enforce the agnostic-core boundary with an ESLint rule

### Fixed

- npm run dev owns a reused CDP Obsidian instance for live-enable

### Documentation

- refresh CLAUDE.md for the Library refactor and landed branch fixes
- record the completed agnostic-core boundary refactor

## 82.0.0

This release has 3 new features, 1 fix and 1 documentation change. 2 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### New

- **editor-lock:** beep on a type attempt in a locked note
- **editor-lock:** flash the lock indicators when typing in a locked note
- **editor-lock:** add Unlock to the file/tab context menu and render lockers as code

### Fixed

- **minimizable-modal:** float the minimized bar above the status bar

### Documentation

- cleanup

## 82.0.0-beta.10

This release has 1 fix. 4 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Fixed

- keep editors typable while a MinimizableModal is minimized

## 82.0.0-beta.9

This release has 1 new feature. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### New

- right-click a lock indicator to unlock and abort the operation

## 82.0.0-beta.8

This release has 1 breaking change and 1 fix.

### Breaking changes

- rename lockEditor/unlockEditor to toggleEditorReadOnly

### Fixed

- lock editors opened after a note's path is already locked

## 82.0.0-beta.7

This release has 1 breaking change. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Breaking changes

- require an editorLockComponent on the file-mutation API

## 82.0.0-beta.6

This release has 1 breaking change and 1 new feature.

### Breaking changes

- lock the editor during process() only via an opt-in component

### New

- own an EditorLockComponent in PluginBase

## 82.0.0-beta.5

This release has 1 new feature.

### New

- add EditorLockComponent for per-plugin lock ownership and auto-release

## 82.0.0-beta.4

This release has 1 new feature.

### New

- list the locking plugins in the editor-lock indicator tooltip

## 82.0.0-beta.3

This release has 2 new features.

### New

- pulse the minimized modal bar to keep it noticeable
- show editor-lock indicators in tab header and status bar

## 82.0.0-beta.2

This release has 1 new feature and 1 fix. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### New

- restart dev build on node_modules changes

### Fixed

- actually apply the editor lock and keep app hotkeys working

## 82.0.0-beta.1

This release has 1 new feature and 1 fix.

### New

- style minimizable modal

### Fixed

- reconcile editor locks on file-open

## 82.0.0-beta.0

This release has 4 breaking changes, 7 new features, 3 fixes and 3 documentation changes. 3 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Breaking changes

- remove tempRegisterFilesAndRun(Async) in favor of registerFiles
- return Disposables from enableAsyncOperationTracking and registerAsyncErrorEventHandler
- return a Disposable from onAncestorScrollOrResize
- return a Disposable from onAbort `onAbort` now returns a `Disposable`

### New

- return a Disposable from registerFiles and registerFileCacheForNonExistingFile
- return a Disposable from lockEditor
- log and rethrow errors thrown during plugin onload
- expand AggregateError sub-errors in errorToString
- add --verbose flag to build:validate-declarations
- add minimizable modal
- add reference-counted note-scoped editor locking

### Fixed

- update file name alias by default in updateLink
- show timeout notice by default in retry/runWithTimeoutNotice
- **build:** validate own declarations, ignore only node_modules

### Documentation

- clarify isCaseInsensitive default resolves to the file system
- add @default tags across TSDoc params/options bags
- record editor-lock + minimizable-modal task status

## 81.0.0

This release has 2 breaking changes, 2 new features, 1 fix and 1 documentation change. 2 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Breaking changes

- full-bag vault.ts functions into single params objects copySafe, getAbstractFilePathSafe, getOrCreateAbstractFileSafe, getSafeRenamePath, invokeWithFileSystemLock, isChild, isChildOrSelf, renameSafe, process (and internal invokeFileActionSafe) now take a single *Params object including app. isChild/ isChildOrSelf rename the ambiguous a/b to childPathOrFile/parentPathOrFile. ProcessParams folds in ProcessOptions (kept exported). All call sites and test mocks updated. BREAKING CHANGE: these vault functions take a single params object; app and the former positional args are now named members.
- extract param bags

### New

- add return type
- add fallback to requestAnimationFrameAsync

### Fixed

- restore button text color broken by tldraw's unscoped global rule

### Documentation

- record params/options extraction task

## 80.1.0

This release has 1 new feature.

### New

- return notice

## 80.0.2

This release has 1 fix.

### Fixed

- recognize string-literal key references in over-exposure analyzer

## 80.0.1

This release has 1 new feature. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### New

- add --force to find-overexposed:fix to tighten test-only declarations

## 80.0.0

This release has 1 breaking change and 1 fix.

### Breaking changes

- rename static folder to templates and strip .template on build

### Fixed

- resolve consumer config templates from dist/templates

## 79.0.0

This release has 1 breaking change and 1 new feature. 2 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Breaking changes

- over-exposure scripts

### New

- templates

## 78.1.0

This release has 1 new feature.

### New

- improve typing

## 78.0.0

This release has 1 breaking change and 2 new features. 3 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Breaking changes

- all plugin registrars

### New

- waitUntilConnected
- add fix over exposure

## 77.1.0

This release has 2 new features, 1 fix and 1 documentation change. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### New

- **over-exposure:** support rendering finding paths relative to a base folder
- **over-exposure:** render each finding on its own location and change line

### Fixed

- **over-exposure:** do not flag object-literal accessors nested in class methods

### Documentation

- **over-exposure:** pass baseFolder in the find-overexposed example script

## 77.0.0

This release has 1 breaking change, 3 new features, 1 fix, 1 improvement, 2 documentation changes and 1 other change. 3 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Breaking changes

- read attachment content lazily in getAttachmentFilePath

### New

- add progress
- view registrars
- over-exposure

### Fixed

- skip rename/delete handling for synthetic index-only deletions

### Improved

- make case-insensitive path resolution O(1) on a miss

### Documentation

- record performance fixes and pending consumer follow-up
- track eager attachment readBinary perf issue and lazy-content fix

### Other changes

- refactor! remove unused _app

## 76.1.0

This release has 1 breaking change, 1 new feature and 1 fix.

### Breaking changes

- rename param-bag types to follow the Params/Options convention

### New

- **eslint:** enforce params/options naming on all members and by optionality

### Fixed

- **eslint:** check private/protected members in params-options-name-match

## 76.0.0

This release has 1 breaking change.

### Breaking changes

- rename stats

## 75.0.0

This release has 2 breaking changes and 1 fix.

### Breaking changes

- rename test-setup endpoints to mirror obsidian-test-mocks
- store shared state on globalThis, drop app from the API

### Fixed

- **object-utils:** scope toJson placeholder regex to a "toJson:"

## 74.2.0

This release has 7 new features and 1 documentation change. 4 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### New

- add async-operation-tracking test-setup endpoints
- throw from waitForAllAsyncOperations when tracking is disabled
- add opt-in async-operation tracking for tests
- add no-unused-params-members ESLint rule
- distinguish methods / functions
- registerFunctionPatch to cover debouncers
- ban more of anonymous types

### Documentation

- document async-operation-tracking test-setup endpoints

## 74.1.0

This release has 1 new feature and 1 fix. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### New

- cloneFunction

### Fixed

- restore v8 ignore coverage on runtime-coupled exports

## 74.0.0

This release has 1 breaking change and 1 new feature.

### Breaking changes

- remove i18n-component

### New

- expose pluginName

## 73.0.0

This release has 1 breaking change and 1 new feature. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Breaking changes

- replace registerGenerateMarkdownLinkDefaultOptionsFn with component

### New

- permanent notices

## 72.0.0

This release has 1 new feature. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### New

- force Result interfaces have readonly fields

## 71.0.2

This release has 1 fix. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Fixed

- **deps:** stop listing override-only js-yaml/markdown-it as direct deps

## 71.0.1

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 71.0.0

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 70.4.0

This release has 1 documentation change. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Documentation

- add reference to Advanced Debug Mode

## 70.3.0

This release has 1 new feature and 1 documentation change. 4 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### New

- createFunction

### Documentation

- add missing tsdocs

## 70.2.2

This release has 1 fix. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Fixed

- allow actions after unloaded

## 70.2.1

This release has 1 fix. 3 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Fixed

- wrong lib

## 70.2.0

This release has 4 new features and 3 fixes. 2 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### New

- validate declarations against our types only
- manual type validation
- ensure not using Node 16.13.2+
- force es2022/node16

### Fixed

- tests in es2024 syntax
- properly identify current folder re <https://github.com/mnaoumov/obsidian-advanced-note-composer/issues/118>
- build plugins to support older env

## 70.1.0

This release has 1 new feature.

### New

- add flags to version update lifecycle

## 70.0.1

This release has 1 fix.

### Fixed

- getDomEventsHandlersConstructor

## 70.0.0

This release has 1 breaking change, 1 new feature, 1 fix and 1 documentation change. 3 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Breaking changes

- **components:** aggregate ComponentEx load errors and load children eagerly

### New

- **components:** add ensureLoaded lifecycle guard to ComponentEx and subclasses

### Fixed

- harden flaky integration tests under full-suite load

### Documentation

- document integration-test readiness-wait convention

## 69.2.4

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 69.2.3

This release has 2 new features, 2 fixes and 2 documentation changes. 11 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### New

- **strict-proxy:** pass through common test-framework probe properties
- **type-guards:** add assertNever for exhaustive switch checks

### Fixed

- resolve TypeScript and lint errors after as-never refactors
- **test:** satisfy GenericObject constraint in evalInObsidian args type

### Documentation

- clear stale pending questions
- update consoleDebug reference to consoleDebugComponent

## 69.2.2

This release has 1 breaking change. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Breaking changes

- move rename-delete-handler

## 69.2.1

This release has 1 new feature.

### New

- expose StrictProxyPartial

## 69.2.0

This release has 1 fix. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Fixed

- replace PartialDeep with custom StrictProxyPartial type

## 69.1.3

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 69.1.2

This release has 1 new feature and 1 improvement. 3 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### New

- expose LayoutReadyComponent.app

### Improved

- eliminate slow projectService startup in ESLint rule tests

## 69.1.1

This release has 1 fix. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Fixed

- make components non-nullable

## 69.1.0

This release has 1 new feature and 1 fix.

### New

- extract PluginEventSource

### Fixed

- add `/// <reference types="node" />` to generated declaration files

## 69.0.0

This release has 5 fixes. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Fixed

- **test:** run ESLint type-checked rule tests in single-thread mode
- prefix reference path with ./ for same-directory references
- make generated declarations self-contained via library.d.mts<noreply@anthropic.com>
- inject /// \<reference lib\>
- rewrite dynamic import()

## 68.0.0

This release has 1 breaking change, 2 new features, 2 fixes and 1 documentation change. 5 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Breaking changes

- components/plugins

### New

- add new eslint rules
- **eslint:** exclude all Obsidian Component subclasses from require-component-suffix

### Fixed

- resolve test hang and broken mocks
- build

### Documentation

- fix empty tsdocs

## 67.0.0

This release has 1 breaking change and 2 new features. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Breaking changes

- simplify PluginSettingsComponentBase

### New

- noopAsync eslint rule
- add component suffix rule

## 66.0.1

This release has 1 fix.

### Fixed

- accidental DisposableComponent leakage

## 66.0.0

This release has 4 breaking changes, 2 new features, 6 fixes and 1 documentation change. 12 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Breaking changes

- rewrite MonkeyAroundComponent API
- move components
- extract setting components
- rename AllWindowsEventHandler to AllWindowsEventComponent

### New

- add DisposableComponent with Symbol.dispose support
- add registerMethodPatch for simplified single-method patching

### Fixed

- patch token validation
- compilation
- inference
- simplify PatchComponent.onload by removing redundant uninstall guard
- make AppMenuEventRegistrar extend Component directly
- widen PluginSettingsTabComponent type to PluginSettingTab

### Documentation

- fix link

## 65.0.1

This release has 1 fix.

### Fixed

- mocks

## 65.0.0

This release has 1 breaking change, 1 new feature and 2 fixes. 5 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Breaking changes

- should* to methods

### New

- add eslint rules for params/options interfaces

### Fixed

- explicitly add DOM.Iterable
- support getters and setters in require-super-call eslint rule

## 64.0.0

This release has 1 breaking change. 4 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Breaking changes

- open settings

## 63.1.0

This release has 1 documentation change. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Documentation

- update link

## 63.0.1

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 63.0.0

This release has 1 documentation change. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Documentation

- update examples

## 62.3.0

This release has 3 fixes. 4 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Fixed

- **build:** run generate-index before TypeScript compilation
- **test:** update list HTML assertion
- **test:** use global vault and async/await in obsidian integration tests

## 62.2.0

This release has 1 fix. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Fixed

- **eslint:** handle unresolvable base types in require-super-call rule

## 62.1.0

This release has 2 new features. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### New

- validate generic types
- rule that forces super.method()

## 62.0.0

This release has 1 breaking change. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Breaking changes

- move plugin name to component

## 61.1.0

This release has 1 new feature.

### New

- add more registrars

## 61.0.1

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 61.0.0

This release has 1 new feature.

### New

- extract data-handler

## 60.0.0

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 59.0.2

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 59.0.1

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 59.0.0

This release has 1 breaking change.

### Breaking changes

- constructors

## 58.0.1

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 58.0.0

This release has 1 breaking change. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Breaking changes

- simplify PluginBase to IoC container with children-first loading

## 57.0.2

This release has maintenance changes only. 2 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

## 57.0.1

This release has maintenance changes only. 4 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

## 57.0.0

This release has 1 breaking change and 1 new feature. 2 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Breaking changes

- replace string-keyed component map with symbol-based

### New

- allow invokeAsyncSafely to accept sync functions returning Promisable

## 56.0.2

This release has 1 fix.

### Fixed

- bind loadData/saveData

## 56.0.1

This release has 2 breaking changes.

### Breaking changes

- switch to ReadonlyPluginSettings
- rename pluginSettingsComponent

## 56.0.0

This release has 2 breaking changes. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Breaking changes

- better config for obsidianmd-plugin
- plugins/commands

## 55.4.1

This release has 1 fix. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Fixed

- re-enable rules disabled by eslint-plugin-obsidianmd

## 55.4.0

This release has 1 new feature. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### New

- enable require-await, ban-ts-comment, and prefer-const

## 55.3.0

This release has 1 new feature.

### New

- disable unbound-method checks in tests

## 55.2.0

This release has 1 new feature and 1 fix.

### New

- allow bracket notation in tests

### Fixed

- remove global rule ID references from ESLint error messages

## 55.1.0

This release has 2 fixes. 4 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Fixed

- **test:** use ensureNonNullable
- **lint:** forbid as anonymous type

## 55.0.0

This release has 1 fix. 5 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Fixed

- build

## 54.0.3

This release has 1 fix.

### Fixed

- workaround for eslint bug <https://github.com/eslint/rewrite/issues/425>

## 54.0.2

This release has 1 fix. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Fixed

- pass vault root path instead of .obsidian folder

## 54.0.1

This release has 3 fixes. 5 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Fixed

- increase type-check test timeout from 30s to 60s
- build
- compilation

## 54.0.0

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 53.1.4

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 53.1.3

This release has maintenance changes only. 2 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

## 53.1.2

This release has maintenance changes only. 2 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

## 53.1.1

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 53.1.0

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 53.0.0

This release has maintenance changes only. 2 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

## 52.3.0

This release has 1 fix. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Fixed

- check if .gitignore exists

## 52.2.0

This release has 1 new feature.

### New

- more advanced enabling

## 52.1.1

This release has 1 fix.

### Fixed

- cover functions without results

## 52.1.0

This release has 1 fix. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Fixed

- Obsidian CLI

## 52.0.3

This release has 1 fix. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Fixed

- add JSON.stringify

## 52.0.2

This release has 1 fix.

### Fixed

- cli

## 52.0.1

This release has 2 fixes.

### Fixed

- dev script
- fail when no command

## 52.0.0

This release has 1 fix. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Fixed

- build scripts

## 51.2.0

This release has maintenance changes only. 2 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

## 51.1.8

This release has 1 fix.

### Fixed

- dep

## 51.1.7

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 51.1.6

This release has 1 fix.

### Fixed

- npm pack parsing

## 51.1.5

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 51.1.4

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 51.1.3

This release has 1 fix.

### Fixed

- republish

## 51.1.2

This release has 1 fix.

### Fixed

- publish script

## 51.1.1

This release has 1 fix. 2 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Fixed

- build

## 51.1.0

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 51.0.1

This release has 2 fixes. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Fixed

- increase test timeouts for heavy dynamic imports in i18n and pdf tests
- add debug logging and robust JSON extraction for npm pack output

## 51.0.0

This release has 2 new features and 1 fix. 4 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### New

- auto-enable hot-reload and dev plugin via community-plugins.json and Obsidian CLI
- add test commands

### Fixed

- log error when Obsidian CLI plugin enable fails

## 50.0.0

This release has 1 new feature. 2 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### New

- extract trashSafe

## 49.0.3

This release has maintenance changes only. 2 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

## 49.0.2

This release has 1 fix.

### Fixed

- parent path for deleted file re <https://github.com/mnaoumov/obsidian-custom-attachment-location/issues/19>

## 49.0.1

This release has 1 fix.

### Fixed

- switch to new resolver

## 49.0.0

This release has 1 new feature and 1 fix. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### New

- disallow anonymous types

### Fixed

- use proper type from typings

## 48.1.4

This release has 1 fix.

### Fixed

- cast

## 48.1.3

This release has maintenance changes only. 2 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

## 48.1.2

This release has maintenance changes only. 2 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

## 48.1.1

This release has 1 fix. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Fixed

- bind check callbacks re <https://github.com/mnaoumov/obsidian-codescript-toolkit/issues/46>

## 48.1.0

This release has 1 new feature.

### New

- expose original id/name

## 48.0.2

This release has 2 fixes.

### Fixed

- group commands by plugin name
- files menu section

## 48.0.1

This release has 1 fix.

### Fixed

- files menu icon

## 48.0.0

This release has 1 new feature.

### New

- add overridable properties

## 47.7.0

This release has 1 new feature. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### New

- init commands props via ctor

## 47.6.0

This release has 1 new feature.

### New

- clean empty folders when deletions is not handled re <https://github.com/mnaoumov/obsidian-custom-attachment-location/issues/11>

## 47.5.0

This release has 1 new feature.

### New

- add PathSettings

## 47.4.0

This release has 1 new feature.

### New

- add type arg

## 47.3.0

This release has 1 new feature. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### New

- add exists

## 47.2.0

This release has 1 new feature. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### New

- add submenu

## 47.1.0

This release has 1 new feature. 2 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### New

- add SettingGroupEx

## 47.0.0

This release has 1 fix. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Fixed

- rename EmptyFolderBehavior as it applies not only to attachment folders

## 46.17.2

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 46.17.1

This release has 1 fix.

### Fixed

- restore types exports

## 46.17.0

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 46.16.0

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 46.15.0

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 46.14.0

This release has 1 new feature. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### New

- add FileSystemType

## 46.13.0

This release has 1 new feature. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### New

- getFilePathSafe/getFolderPathSafe

## 46.12.0

This release has 1 new feature. 3 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### New

- configure [MD024](https://github.com/DavidAnson/markdownlint/blob/main/doc/md024.md)

## 46.11.2

This release has 1 fix.

### Fixed

- isChild for root

## 46.11.1

This release has 1 new feature.

### New

- renameSafe for abstract files

## 46.11.0

This release has 2 new features. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### New

- getSafeRenamePath
- reuse adapter.insensitive by default

## 46.10.0

This release has 1 new feature and 1 fix.

### New

- renderInternalLink to folder

### Fixed

- initialization re <https://github.com/mnaoumov/obsidian-advanced-note-composer/issues/57>

## 46.9.0

This release has 1 new feature.

### New

- rename with update links

## 46.8.0

This release has 1 new feature. 2 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### New

- isChild/isChildOrSelf

## 46.7.0

This release has 1 new feature.

### New

- getOrCreateFileSafe/getOrCreateFolderSafe

## 46.6.2

This release has 1 fix.

### Fixed

- renamed links

## 46.6.1

This release has 1 fix.

### Fixed

- don't fail on incompatible canvas changes

## 46.6.0

This release has 2 fixes.

### Fixed

- don't fail on incompatible canvas changes
- undo Advanced Canvas plugin changes

## 46.5.3

This release has 1 fix.

### Fixed

- missing originalReference

## 46.5.2

This release has 1 fix.

### Fixed

- canvas text link

## 46.5.1

This release has 1 new feature.

### New

- skip rename handling for the same path

## 46.5.0

This release has 1 new feature.

### New

- skip rename handling for the same path

## 46.4.1

This release has 1 fix. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Fixed

- add support for links from Advanced Canvas re <https://github.com/RainCat1998/obsidian-custom-attachment-location/issues/235>

## 46.4.0

This release has 1 new feature. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### New

- allow disabling notices re <https://github.com/mnaoumov/obsidian-backlink-cache/issues/11>

## 46.3.3

This release has 1 fix.

### Fixed

- handle multi windows

## 46.3.2

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 46.3.1

This release has 1 fix.

### Fixed

- notice init

## 46.3.0

This release has 1 new feature. 3 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### New

- don't show loop notice for first 500ms re <https://github.com/dy-sh/obsidian-consistent-attachments-and-links/issues/149>

## 46.2.2

This release has maintenance changes only. 3 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

## 46.2.1

This release has 1 new feature.

### New

- remove :

## 46.2.0

This release has 2 new features.

### New

- switch to FixedZIndexDomEventsHandlersInfo
- refactor fullRender

## 46.1.0

This release has 1 new feature and 1 fix.

### New

- add optional args

### Fixed

- link events

## 46.0.0

This release has 1 new feature.

### New

- extract HTMLAnchorElement

## 45.7.0

This release has 1 new feature.

### New

- allow path or file

## 45.6.1

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 45.6.0

This release has 1 new feature and 1 fix. 2 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### New

- add create*Async

### Fixed

- patch eslint-plugin-perfectionist re <https://github.com/azat-io/eslint-plugin-perfectionist/issues/642>

## 45.5.0

This release has 1 new feature.

### New

- render links methods

## 45.4.1

This release has 1 fix.

### Fixed

- detach temp open file

## 45.4.0

This release has 1 new feature and 1 fix. 2 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### New

- registerLinkHandlers

### Fixed

- optional default params

## 45.3.2

This release has 1 new feature and 1 documentation change. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### New

- don't copy file to itself

### Documentation

- fix link

## 45.3.1

This release has 1 fix. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Fixed

- addComponentSafe re <https://github.com/RainCat1998/obsidian-custom-attachment-location/issues/254>

## 45.3.0

This release has 2 new features.

### New

- add array-delegating command invocations
- don't execute when files are not selected

## 45.2.0

This release has 1 new feature.

### New

- use SequentialAbstractFilesCommandInvocationBase

## 45.1.0

This release has 1 new feature. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### New

- add SequentialAbstractFilesCommandInvocationBase

## 45.0.4

This release has 1 fix.

### Fixed

- unescape interpolations

## 45.0.3

This release has 1 fix.

### Fixed

- constant initialization

## 45.0.2

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 45.0.1

This release has 3 new features.

### New

- extract i18n
- round timestamps
- show total time

## 45.0.0

This release has 1 new feature.

### New

- don't break on timeout, just show notice

## 44.3.0

This release has 1 new feature.

### New

- refactor commands

## 44.2.4

This release has maintenance changes only. 2 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

## 44.2.3

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 44.2.2

This release has 1 fix. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Fixed

- escape alias from filename

## 44.2.1

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 44.2.0

- fix: handle attachments of md-attachments
  - re <https://github.com/RainCat1998/obsidian-custom-attachment-location/issues/245>
  - re <https://github.com/dy-sh/obsidian-consistent-attachments-and-links/issues/145>

## 44.1.0

This release has 1 fix.

### Fixed

- more support for overlapping changes re <https://github.com/mnaoumov/obsidian-better-markdown-links/issues/28>

## 44.0.0

This release has 2 new features, 1 fix and 1 documentation change. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### New

- add unescaped alias
- disable escaping aliases by default

### Fixed

- handle nested links re <https://github.com/mnaoumov/obsidian-better-markdown-links/issues/28>

### Documentation

- add examples

## 43.10.4

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 43.10.3

This release has 1 fix. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Fixed

- temporarily add globals until <https://github.com/obsidianmd/eslint-plugin/pull/73> is released

## 43.10.2

This release has 1 fix.

### Fixed

- move eslint-plugin-obsidianmd to runtime dependency

## 43.10.1

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 43.10.0

This release has 2 fixes. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Fixed

- determine obsidian-dev-utils
- handle nested links re <https://github.com/mnaoumov/obsidian-better-markdown-links/issues/28>

## 43.9.0

This release has 1 new feature.

### New

- add links update notice

## 43.8.0

This release has 1 new feature.

### New

- expose handleSilentError

## 43.7.1

- fix: force alias only for markdown files
  - re <https://github.com/mnaoumov/obsidian-better-markdown-links/issues/27>
- chore: update libs

## 43.7.0

This release has 1 fix. 2 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Fixed

- unescape alias

## 43.6.1

- fix: compilation after moving loadPrism
- fix: add check for old/new keys
  - re <https://github.com/dy-sh/obsidian-consistent-attachments-and-links/issues/143>
- chore: update libs

## 43.6.0

This release has 1 new feature. 3 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### New

- add lock editor and notice

## 43.5.0

This release has 1 new feature. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### New

- select default value in prompt

## 43.4.0

This release has 1 new feature.

### New

- generateRawMarkdownLink

## 43.3.0

This release has 1 new feature.

### New

- escapeAlias

## 43.2.7

This release has 1 fix.

### Fixed

- call mobile require only when it makes sense

## 43.2.6

This release has 1 fix.

### Fixed

- better fix for missing window

## 43.2.5

This release has 1 fix.

### Fixed

- window can be optional

## 43.2.4

This release has 1 fix.

### Fixed

- don't even try to call original require on mobile

## 43.2.3

This release has 2 new features. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### New

- hack for app.emulateMobile()
- don't show non-critical error by default

## 43.2.2

- docs: update links
- feat: initOriginalLinksMap
- fix: carefully check for oldPath
- Revert "fix: ensure backlinks work for old attachments"
  - This reverts commit 4eb57b423413a3de5b2b499c6f195f4d950b321d.

## 43.2.1

- fix: ensure backlinks work for old attachments
  - fix <https://github.com/RainCat1998/obsidian-custom-attachment-location/issues/231>

## 43.2.0

This release has 1 new feature.

### New

- highlight focused links

## 43.1.3

This release has 1 fix.

### Fixed

- fix tabIndex

## 43.1.2

This release has 1 fix.

### Fixed

- tabIndex of code highlighter

## 43.1.1

This release has 1 fix. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Fixed

- css query

## 43.1.0

This release has 1 new feature and 1 other change. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### New

- add oldAttachmentPathOrFile

### Other changes

- Revert "refactor: getAttachmentFilePath" This reverts commit 55bfdb908f64801b8f5d663dcddd86bc0b4d850a.

## 43.0.0

This release has maintenance changes only. 2 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

## 42.8.1

This release has 1 new feature and 1 documentation change. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### New

- include MarkdownlintCli2Config files for linting

### Documentation

- switch from tsx to jiti

## 42.8.0

This release has 1 new feature.

### New

- switch from tsx to jiti

## 42.7.0

This release has 5 new features. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### New

- add ctrl+tab/ctrl+shift+tab for CodeHighlighterComponent
- strongly-typed settings
- better error handling
- enable markdown lint
- allow node-js libs from scripts folder

## 42.6.5

This release has 1 fix. 3 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Fixed

- don't add ! for non-md files links starting from 1.10.0

## 42.6.4

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 42.6.3

This release has 1 fix. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Fixed

- file changes for frontmatterLinkCacheWithOffsets

## 42.6.2

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 42.6.1

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 42.6.0

This release has 1 new feature.

### New

- allow menu-only commands

## 42.5.0

This release has 1 new feature. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### New

- rename menu section fields

## 42.4.1

This release has 1 fix.

### Fixed

- init folder command current folder

## 42.4.0

This release has 2 new features and 1 documentation change.

### New

- preserve original name
- add separate filesMenuItemName

### Documentation

- force tsdocs for non-private properties

## 42.3.0

This release has 3 new features.

### New

- add AbstractFileCommandBase, support multiple files menu
- add FolderCommandBase
- switch to async commands

## 42.2.0

This release has 1 new feature.

### New

- add multiple default options

## 42.1.1

This release has 1 fix and 1 documentation change. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Fixed

- move Commands to source

### Documentation

- add missing tsdocs

## 42.1.0

This release has 1 new feature, 1 fix and 1 documentation change. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### New

- enable comments eslint rules

### Fixed

- jsdoc require-throws-type

### Documentation

- add lint comments

## 42.0.0

This release has 1 new feature and 1 documentation change.

### New

- rename RelativePathToTheSource BREAKING CHANGE: previous name RelativePathToTheNote was inconsistent

### Documentation

- unify examples form

## 41.0.0

- refactor: remove `GenerateMarkdownLinkDefaultOptionsWrapper`

BREAKING CHANGE: `generateMarkdownLink()` now doesn't support default options embedded. You should pass options explicitly

## 40.17.0

This release has 1 new feature. 2 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### New

- add commands

## 40.16.0

This release has 4 new features and 1 fix. 4 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### New

- enable commitizen
- move to next element on Esc
- add LinkPathStyle
- ensure loop progress bar is visible

### Fixed

- syntax

## 40.15.0

This release has 3 other changes.

### Other changes

- Ensure I18N initialized fully synchronously
- Ensure file saved before reading
- Update libs

## 40.14.0

This release has 2 other changes.

### Other changes

- Init default I18N
- Update libs

## 40.13.1

- Don't delete notes on rename
  - fix <https://github.com/RainCat1998/obsidian-custom-attachment-location/issues/223>

## 40.13.0

- @typescript-eslint/prefer-readonly
- Remove empty folder after attachment moved
  - fix <https://github.com/RainCat1998/obsidian-custom-attachment-location/issues/222>

## 40.12.1

- Ensure MetadataDeleted processed before queue
  - fix <https://github.com/RainCat1998/obsidian-custom-attachment-location/issues/220>

## 40.12.0

This release has 1 other change.

### Other changes

- Improve performance of getting global App

## 40.11.0

This release has 1 other change.

### Other changes

- shouldRevertToDefaultValueOnBlur

## 40.10.0

This release has 3 other changes.

### Other changes

- Refactor into classes
- Register old cache
- Allow cache of non-existing files

## 40.9.1

This release has 1 other change.

### Other changes

- Wait for layout ready

## 40.9.0

This release has 1 other change.

### Other changes

- getAllDomWindows

## 40.8.0

This release has 2 other changes.

### Other changes

- Ensure fileMap instance
- Unregister files

## 40.7.0

This release has 1 other change.

### Other changes

- Move warnings to debug

## 40.6.0

This release has 1 other change.

### Other changes

- Pass oldNotePathOrFile

## 40.5.2

This release has 1 other change.

### Other changes

- Switch to enum

## 40.5.1

This release has 1 other change.

### Other changes

- Switch to enum

## 40.5.0

This release has 1 other change.

### Other changes

- Pass context

## 40.4.0

This release has 1 other change.

### Other changes

- Add isSingleSubpathAllowed

## 40.3.1

This release has 1 other change.

### Other changes

- Add TranslationKeyMap

## 40.3.0

This release has 1 other change.

### Other changes

- Add i18n

## 40.2.0

This release has 1 other change.

### Other changes

- Extract handleAsyncError

## 40.1.3

- Handle frontmatter changes properly
  - fix <https://github.com/RainCat1998/obsidian-custom-attachment-location/issues/206>

## 40.1.2

This release has 1 other change.

### Other changes

- Prevent timeout warning if run completed with an error

## 40.1.1

This release has 1 other change.

### Other changes

- Parse alias

## 40.1.0

- shouldEscapeAlias
  - fix <https://github.com/mnaoumov/obsidian-better-markdown-links/issues/22>

## 40.0.2

This release has 1 other change.

### Other changes

- Refactor GetAvailablePathForAttachmentsFnExtended

## 40.0.1

This release has 1 other change.

### Other changes

- Refactor GetAvailablePathForAttachmentsFnExtendedWrapper

## 40.0.0

This release has 1 other change.

### Other changes

- Refactor GetAvailablePathForAttachments

## 39.0.1

This release has 3 other changes.

### Other changes

- Upgrade linter config
- Fix runWithTimeout flow
- Update libs

## 39.0.0

This release has 1 other change.

### Other changes

- Validate content when preparing file changes

## 38.10.0

This release has 1 other change.

### Other changes

- Add more checks for throwIfAborted

## 38.9.0

This release has 2 other changes.

### Other changes

- Refactor Result
- Handle inner silent errors

## 38.8.1

This release has 1 other change.

### Other changes

- Fix for iOS < 17.2

## 38.8.0

This release has 1 other change.

### Other changes

- Keep names to have better stack traces

## 38.7.0

This release has 1 other change.

### Other changes

- Handle case of file removed during getCacheSafe

## 38.6.1

This release has 1 other change.

### Other changes

- Fix typo

## 38.6.0

This release has 1 other change.

### Other changes

- registerPopupDocumentDomEvent / registerPopupWindowDomEvent

## 38.5.1

- Don't wait for every save
  - fix\[perf\]: <https://github.com/mnaoumov/obsidian-backlink-cache/issues/10>

## 38.5.0

This release has 1 other change.

### Other changes

- Check for extension

## 38.4.3

- Reuse parsed alias
  - fix <https://github.com/mnaoumov/obsidian-better-markdown-links/issues/21#issuecomment-3225879039>

## 38.4.2

This release has 1 other change.

### Other changes

- Stop using ctx.getSectionInfo(el) as it is not reliable with live changes

## 38.4.1

This release has 1 other change.

### Other changes

- Ensure MetadataCache is ready before checking CodeBlockMarkdownInformation

## 38.4.0

This release has 1 other change.

### Other changes

- Don't rename files by default

## 38.3.0

This release has 2 other changes.

### Other changes

- Skip empty error line
- Add shouldSkipDuplicateCheck

## 38.2.0

This release has 1 other change.

### Other changes

- Fix for error links not clickable

## 38.1.0

This release has 1 other change.

### Other changes

- DUMMY_PATH

## 38.0.0

This release has 1 other change.

### Other changes

- Regenerate attachment names on note rename

## 37.3.0

This release has 4 other changes.

### Other changes

- Lock file while looking for CodeBlockMarkdownInfo
- invokeWithFileSystemLock
- Simplify errorToString. Ensure links are clickable
- Configure LinkStyle

## 37.2.0

This release has 1 other change.

### Other changes

- SilentError

## 37.1.2

This release has 1 other change.

### Other changes

- Improve LF handling

## 37.1.1

This release has 1 other change.

### Other changes

- Ignore line endings

## 37.1.0

This release has 1 other change.

### Other changes

- Ensure editor changes are reflected in the view

## 37.0.0

This release has 1 other change.

### Other changes

- Rename shouldKeepGap

## 36.2.0

This release has 3 other changes.

### Other changes

- Change tsdocs for FunctionOptions interfaces
- Remove word Represents
- shouldKeepGapWhenEmpty

## 36.1.0

This release has 2 other changes.

### Other changes

- Ensure note saved
- Reformat. Use a/an article in docs

## 36.0.0

This release has 1 other change.

### Other changes

- Extract CodeBlockMarkdownInformation

## 35.0.1

- Minor changes

## 35.0.0

This release has 6 other changes.

### Other changes

- Don't trim frontmatter
- Calculate offsets properly
- Preserve raw args
- Include more context in CodeBlockMarkdownInformation
- Refactor abortSignalAny
- Optional args whitespace

## 34.0.1

This release has 1 other change.

### Other changes

- Don't throw if no unique code block found

## 34.0.0

This release has 7 other changes.

### Other changes

- printError all in one message
- removeCodeBlock
- replaceCodeBlock
- shouldPreserveLinePrefix
- insert before/after code block
- hasSingleOccurrence
- getCodeBlockSectionInfo

## 33.1.1

This release has 1 other change.

### Other changes

- Fix build

## 33.1.0

This release has 1 other change.

### Other changes

- Improve nameof return type

## 33.0.0

This release has 3 other changes.

### Other changes

- Refactor debug log with stack traces
- Add full caller call stack
- Refactor Async/AbortController

## 32.0.1

This release has 1 other change.

### Other changes

- Remove old fn

## 32.0.0

This release has 2 other changes.

### Other changes

- Rename validation variables
- oneOf regExp

## 31.3.0

This release has 2 other changes.

### Other changes

- Get file name validation reg exps
- Handle delete/rename with abort signal

## 31.2.0

This release has 1 other change.

### Other changes

- Pass custom abortSignal to queue

## 31.1.0

This release has 1 other change.

### Other changes

- Add abortSignal parameter

## 31.0.0

This release has 3 other changes.

### Other changes

- Ensure removeUndefinedProperties forces exclusions
- Assert no duplicate keys
- Unique array

## 30.7.0

This release has 1 other change.

### Other changes

- Interrupt aborted operations

## 30.6.0

This release has 1 other change.

### Other changes

- removeUndefinedProperties

## 30.5.1

- Polyfill `AbortSignal.any()`
  - fix <https://github.com/mnaoumov/obsidian-backlink-cache/issues/9>

## 30.5.0

This release has 1 other change.

### Other changes

- Add revalidate

## 30.4.1

This release has 1 other change.

### Other changes

- Fix scrolling gap

## 30.4.0

This release has 1 other change.

### Other changes

- Ensure replaceAll execution order

## 30.3.0

This release has 1 other change.

### Other changes

- extractDefaultExportInterop

## 30.2.1

This release has 1 other change.

### Other changes

- Improve error message

## 30.2.0

This release has 1 other change.

### Other changes

- assertAllTypeKeys

## 30.1.1

This release has 1 other change.

### Other changes

- Revert "Add fake default property"

## 30.1.0

This release has 1 other change.

### Other changes

- Add fake default property

## 30.0.0

- Rename Object -> ObjectUtils to fix internal conflict of variable Object

## 29.0.2

- Don't treat FrontmatterLinkCacheWithOffsets as duplicate links

## 29.0.1

This release has 1 other change.

### Other changes

- Remove cleanKey

## 29.0.0

This release has 1 other change.

### Other changes

- shouldRetryOnInvalidChanges

## 28.6.0

This release has 1 other change.

### Other changes

- FrontmatterLinkCacheWithOffsets

## 28.5.0

This release has 1 other change.

### Other changes

- parseLinks

## 28.4.0

This release has 1 other change.

### Other changes

- Add INFINITE_TIMEOUT

## 28.3.0

This release has 1 other change.

### Other changes

- Check if load was aborted

## 28.2.2

This release has 1 other change.

### Other changes

- Add more logging

## 28.2.1

- Minor changes

## 28.2.0

This release has 2 other changes.

### Other changes

- Update deprecated eslint rule
- For canvas links rely on backlink-cache plugin or built-in canvas

## 28.1.0

This release has 1 other change.

### Other changes

- registerLegacySettingsConverters

## 28.0.0

This release has 1 other change.

### Other changes

- Rename file name

## 27.7.1

This release has 1 other change.

### Other changes

- Handle sourcePath /

## 27.7.0

This release has 1 other change.

### Other changes

- Add support for non-existing link files

## 27.6.1

This release has 1 other change.

### Other changes

- Switch to window.setTimeout

## 27.6.0

This release has 1 other change.

### Other changes

- Register multiple temp files

## 27.5.4

- Revert useless changes (back to 27.5.1)

## 27.5.3

This release has 1 other change.

### Other changes

- Get updated backlinks map

## 27.5.2

This release has 1 other change.

### Other changes

- Recalculate backlinks for all files

## 27.5.1

This release has 1 other change.

### Other changes

- Keep updating links to ignored files

## 27.5.0

- Don't disable link updates if rename is disabled
  - fix <https://github.com/mnaoumov/obsidian-better-markdown-links/issues/17>

## 27.4.0

- Ensure no `undefined` in replaceAll. Collect missing group indices

## 27.3.1

This release has 1 other change.

### Other changes

- Treat base as note

## 27.3.0

This release has 3 other changes.

### Other changes

- isBaseFile
- Fix exec warning
- Lock version to be patched by obsidian-typings

## 27.2.1

This release has 1 other change.

### Other changes

- Add stricter scheme reg exp

## 27.2.0

- Recognize urls such <mailto:foo@bar.com>
  - fix <https://github.com/mnaoumov/obsidian-frontmatter-markdown-links/issues/9>

## 27.1.0

This release has 2 other changes.

### Other changes

- Don't show notice if not needed
- Ensure title is wrapped in div

## 27.0.2

- Minor changes

## 27.0.1

This release has 1 other change.

### Other changes

- Fix import of process variable

## 27.0.0

This release has 2 other changes.

### Other changes

- Refactor eslint config naming
- More node modules

## 26.29.2

This release has 1 other change.

### Other changes

- Save only changed leaves

## 26.29.1

This release has 1 other change.

### Other changes

- Fix init eslint

## 26.29.0

This release has 1 other change.

### Other changes

- Ensure isTimedOut flag is reset

## 26.28.0

This release has 1 other change.

### Other changes

- Log context fn on timeout

## 26.27.3

This release has 1 other change.

### Other changes

- Parse `<url>`

## 26.27.2

This release has 1 other change.

### Other changes

- Add missing encoding

## 26.27.1

This release has 1 other change.

### Other changes

- Add encodedUrl

## 26.27.0

This release has 1 other change.

### Other changes

- encodeUrl

## 26.26.0

This release has 1 other change.

### Other changes

- Don't report left attachments

## 26.25.0

This release has 1 other change.

### Other changes

- Ensure placeholder shown

## 26.24.0

This release has 1 other change.

### Other changes

- hideAsync

## 26.23.0

- Trigger loadSettings even settings were missing

## 26.22.0

This release has 1 other change.

### Other changes

- cleanupParentFolders on deletion

## 26.21.0

This release has 2 other changes.

### Other changes

- Switch to EmptyAttachmentFolderBehavior
- Combine settings properly

## 26.20.0

This release has 1 other change.

### Other changes

- Add more deep equal checks

## 26.19.0

This release has 1 other change.

### Other changes

- Add hasKey/hasValue

## 26.18.0

This release has 1 other change.

### Other changes

- Add TwoWayMap

## 26.17.0

This release has 1 other change.

### Other changes

- Add Map/Set transformers

## 26.16.0

This release has 1 other change.

### Other changes

- Skip async link updates after rename

## 26.15.2

This release has 1 other change.

### Other changes

- Fix timestamp init logic

## 26.15.1

This release has 1 other change.

### Other changes

- Fix AbortSignal

## 26.15.0

This release has 1 other change.

### Other changes

- requestAnimationFrameAsync only after some threshold

## 26.14.0

This release has 1 other change.

### Other changes

- Ensure loop has animationFrame

## 26.13.0

This release has 1 other change.

### Other changes

- Avoid unnecessary checks

## 26.12.0

This release has 1 other change.

### Other changes

- Refactor getCacheSafe

## 26.11.0

This release has 1 other change.

### Other changes

- Patch fileManager to avoid link updates

## 26.10.0

This release has 1 other change.

### Other changes

- Cache debuggers to keep timestamps

## 26.9.0

This release has 2 other changes.

### Other changes

- Allow modify isNote
- Fix root relative

## 26.8.0

This release has 1 other change.

### Other changes

- Expose main elements

## 26.7.0

This release has 1 other change.

### Other changes

- Style placeholder

## 26.6.0

This release has 2 other changes.

### Other changes

- Rewrite docs
- Add CodeHighlighterComponent

## 26.5.2

This release has 1 other change.

### Other changes

- Fix layout. Static size

## 26.5.1

This release has 1 other change.

### Other changes

- Fix flickering

## 26.5.0

This release has 1 other change.

### Other changes

- Switch to static wrappers

## 26.4.0

This release has 1 fix and 2 other changes.

### Fixed

- #32

### Other changes

- Add TelephoneComponent.
- Add PasswordComponent.

## 26.3.0

This release has 1 fix.

### Fixed

- #1

## 26.2.1

This release has 1 other change.

### Other changes

- Ensure property saved

## 26.2.0

This release has 4 other changes.

### Other changes

- Add validation to all ValueComponents
- Empty in display
- Empty only on blur
- Refactor default settings validation

## 26.1.2

- Don't fail on wrong frontmatter

## 26.1.1

This release has 1 other change.

### Other changes

- Add ERROR_STACK_PREFIX to make links clickable

## 26.1.0

This release has 3 other changes.

### Other changes

- deepEqual settings
- Change default `shouldResetSettingWhenComponentIsEmpty`
- Remove Error stack

## 26.0.0

This release has 1 other change.

### Other changes

- Rename createSettingsManager

## 25.1.0

This release has 1 other change.

### Other changes

- Expose SAVE_TO_FILE_CONTEXT

## 25.0.1

This release has 1 other change.

### Other changes

- Restore transformers on load settings

## 25.0.0

- Release

## 24.2.1-beta.6

This release has 1 other change.

### Other changes

- Update validation on initial bind

## 24.2.1-beta.5

This release has 12 other changes.

### Other changes

- Update exports
- Revalidate UI components after save
- Use promisable events
- Use readonly onChanged
- Refresh settings tab when settings load/save
- Use load/save settings events
- Generic methods in AsyncEvents
- Remove old comment
- AsyncEventsComponent
- Move SettingComponents
- Use readonly property settings
- Add default value to placeholder

## 24.2.1-beta.4

This release has 1 other change.

### Other changes

- Fix saving

## 24.2.1-beta.3

This release has 1 other change.

### Other changes

- Add missing awaits

## 24.2.1-beta.2

This release has 1 other change.

### Other changes

- Use current settings in UI

## 24.2.1-beta.1

This release has 1 other change.

### Other changes

- Refactor settings manager

## 24.2.0

This release has 3 other changes.

### Other changes

- Refactor to GenericObject
- More type helpers
- ensureSafe

## 24.1.1

This release has 2 other changes.

### Other changes

- Switch to debouncing as quit doesn't work well on MacOS
- Update validator and onChanged events even for reset

## 24.1.0

- Release

## 24.0.2-beta.2

This release has 8 other changes.

### Other changes

- Save on quit
- Force tsdocs for protected methods
- Force tsdocs for class methods
- Format
- Pass save context
- Add isInitialLoad
- Set to original object
- Prevent double set

## 24.0.2-beta.1

This release has 1 other change.

### Other changes

- Ensure original setter is called

## 24.0.1

This release has 1 other change.

### Other changes

- Ensure validation updated

## 24.0.0

This release has 4 other changes.

### Other changes

- Add OBSIDIAN_CONFIG_FOLDER warning
- Fix tsdocs
- Rename milliseconds arg
- Replace directory with folder

## 23.0.5

This release has 1 other change.

### Other changes

- Fix padding

## 23.0.4

This release has 3 other changes.

### Other changes

- More detailed warning of possible wrong type. Still continue as it might be an union type
- Reuse MultipleDropdownComponent
- Remove invalid multiple from TypedDropdownComponent

## 23.0.3

This release has 1 other change.

### Other changes

- Make tri-state visual

## 23.0.2

This release has 1 other change.

### Other changes

- Init settings tab

## 23.0.1

- Minor changes

## 23.0.0

This release has 2 other changes.

### Other changes

- Rename registerValidators
- Make all virtual Promisable just Promise

## 22.1.1-beta.29

This release has 2 other changes.

### Other changes

- Don't fail on load if settingsManager is not defined
- Add missing eslint comment

## 22.1.1-beta.28

This release has 5 other changes.

### Other changes

- Show tab
- Expose settingsTab
- Fix warnings
- Fix tsdocs
- Use concrete types

## 22.1.1-beta.27

This release has 4 other changes.

### Other changes

- Rename hook methods
- Super calls
- invokeAsyncSafelyAfterDelay
- Make PluginSettingsManagerBase knowing full Plugin type

## 22.1.1-beta.26

This release has 4 other changes.

### Other changes

- Decode paths with %20 instead of spaces
- Use wrappers
- Add checkbox validation
- Don't show warning Notice

## 22.1.1-beta.25

This release has 11 other changes.

### Other changes

- Unify @packageDocumentation
- Add eslint rules
- Add missing tsdocs
- Fix broken tsdoc
- Add missing empty line
- Remove unused SrcDependenciesTs
- Cleanup path enums
- Lint eslint.config files
- Forbid arrow functions
- Ensure eslint.config compiled
- Add jsdoc rules

## 22.1.1-beta.24

This release has 9 other changes.

### Other changes

- Add missing tsdocs
- TypedMultipleDropdownComponent
- TypedDropdownComponent
- Proper setDisabled
- Rename containerEl
- TriStateCheckboxComponent
- CheckboxComponent
- waitForLifecycleEvent
- Force void callbacks

## 22.1.1-beta.23

This release has 3 other changes.

### Other changes

- Support failing validators
- Remove old code
- Init and validate separately to allow dependent validators

## 22.1.1-beta.22

This release has 5 other changes.

### Other changes

- Subscribe once
- Add once
- Add plugin events
- AsyncEvents
- More tsdocs links

## 22.1.1-beta.21

This release has 8 other changes.

### Other changes

- Revert underscore logic to fix TS6133
- Add links in tsdocs
- Fix CliTaskResult tsdocs
- Improve virtual method arg naming
- onLoadSettings
- Force save after load if transformed
- Fix formatting
- Mark as saved on load

## 22.1.1-beta.20

This release has 5 other changes.

### Other changes

- Reuse getAllKeys when transform
- Format
- getAllEntries
- Reuse getAllKeys
- Skip `__proto__`

## 22.1.1-beta.19

This release has 1 other change.

### Other changes

- Sort keys

## 22.1.1-beta.18

This release has 2 other changes.

### Other changes

- Return full PluginSettings
- Add missing await

## 22.1.1-beta.17

This release has 1 other change.

### Other changes

- getAllKeys

## 22.1.1-beta.16

This release has 1 other change.

### Other changes

- More reliable ExtractPluginSettings

## 22.1.1-beta.15

This release has 7 other changes.

### Other changes

- Use properties
- Use default values by default
- Better set placeholder
- Show better tooltip
- Make optional
- Improve ExtractPluginSettings
- shouldResetSettingWhenComponentIsEmpty

## 22.1.1-beta.14

This release has 1 other change.

### Other changes

- Allow optional functions

## 22.1.1-beta.13

This release has 2 other changes.

### Other changes

- Refactor to use monkey-around internally
- Hook after load and before saving record

## 22.1.1-beta.12

This release has 2 other changes.

### Other changes

- Move helpers to Type
- Add access to plugin and app

## 22.1.1-beta.11

This release has 1 other change.

### Other changes

- TextBasedComponent

## 22.1.1-beta.10

This release has 1 other change.

### Other changes

- Init components without placeholders

## 22.1.1-beta.9

This release has 2 other changes.

### Other changes

- Separate setValueAndValidate and setValidationMessage
- Don't save unmodified

## 22.1.1-beta.8

This release has 2 other changes.

### Other changes

- Save only if there are changes
- Properly check for JSON changes

## 22.1.1-beta.7

This release has 1 other change.

### Other changes

- Detailed Invalid value type warning

## 22.1.1-beta.6

This release has 5 other changes.

### Other changes

- Rename PropertyName
- Show warning for wrong values
- Fix dprint rule
- Add default value placeholder
- Support empty validation messages

## 22.1.1-beta.5

This release has 10 other changes.

### Other changes

- Format
- Save transformed settings
- onSaveSettings hook
- Simplify ExtractPluginSettings
- Pass values to onChanged
- Add setAndValidate
- Remove useless validations
- Rename getSettingsRecord
- Restore getSafe
- Refactor to MaybeReturn

## 22.1.1-beta.4

This release has 2 other changes.

### Other changes

- Switch to promisable
- Remove unused

## 22.1.1-beta.3

This release has 1 other change.

### Other changes

- Add validators

## 22.1.1-beta.2

This release has 3 other changes.

### Other changes

- Fix array props
- Add tsdoc
- Remove abstract

## 22.1.1-beta.1

This release has 1 other change.

### Other changes

- Refactor plugin settings

## 22.1.0

This release has 1 other change.

### Other changes

- Output which item caused error

## 22.0.0

This release has 1 other change.

### Other changes

- customizeEsbuildOptions

## 21.1.0

This release has 2 other changes.

### Other changes

- Add progress bar
- Add script examples

## 21.0.1

This release has 1 other change.

### Other changes

- ignoreError

## 21.0.0

This release has 4 other changes.

### Other changes

- Allow customEsbuildOptions
- ignoreError
- Refactor to Promisable
- throwOnAbort

## 20.3.0

This release has 1 other change.

### Other changes

- Remove unreliable `clearPendingQueueItems`

## 20.2.1

This release has 1 other change.

### Other changes

- Return updated content

## 20.2.0

This release has 1 other change.

### Other changes

- Extract `editLinksInContent`

## 20.1.0

This release has 1 other change.

### Other changes

- tempRegisterFileAndRunAsync

## 20.0.0

This release has 2 other changes.

### Other changes

- Reuse type-fest
- MonkeyAround wrapper

## 19.24.0

This release has 1 other change.

### Other changes

- Allow this: void

## 19.23.0

This release has 1 other change.

### Other changes

- Skip properties that cannot be set

## 19.22.0

This release has 1 other change.

### Other changes

- Support ~ fenced code blocks

## 19.21.1

This release has 1 other change.

### Other changes

- Fix inverted condition

## 19.21.0

This release has 1 other change.

### Other changes

- Allow aliasing `this` to `that`

## 19.20.0

This release has 1 other change.

### Other changes

- Add tmpdir to NodeModules

## 19.19.1

This release has 1 other change.

### Other changes

- Wrap loop error

## 19.19.0

This release has 1 other change.

### Other changes

- Add error async stack trace

## 19.18.0

This release has 1 other change.

### Other changes

- Export Stats

## 19.17.6

This release has 1 other change.

### Other changes

- Fix transformer check for DurationTransformer

## 19.17.5

This release has 2 other changes.

### Other changes

- Ensure backlinks refreshed
- Revert broken logic

## 19.17.4

This release has 1 other change.

### Other changes

- Update backlinks info

## 19.17.3

This release has 1 other change.

### Other changes

- Ensure called with npx

## 19.17.2

This release has 1 other change.

### Other changes

- Fix build

## 19.17.1

This release has 1 other change.

### Other changes

- Fix run for unknown commands

## 19.17.0

This release has 1 other change.

### Other changes

- Escape links in table

## 19.16.2

This release has 1 other change.

### Other changes

- Disable jsx formatting rule

## 19.16.1

This release has 1 other change.

### Other changes

- Fix input time styles

## 19.16.0

This release has 1 other change.

### Other changes

- Expose bind

## 19.15.4

This release has 1 other change.

### Other changes

- Explicit move time icon

## 19.15.3

This release has 1 other change.

### Other changes

- Don't move time icon

## 19.15.2

- Fix deploy

## 19.15.1

This release has 1 other change.

### Other changes

- Fix folder creation

## 19.15.0

This release has 2 other changes.

### Other changes

- Add input styles
- Extract css

## 19.14.0

- Clear pending tasks from queue function #12 (thanks to @shumadrid)

## 19.13.0

This release has 3 other changes.

### Other changes

- Switch to `build:compile:typescript`
- Allow custom commands
- Refactor to `npmRun`

## 19.12.0

This release has 1 other change.

### Other changes

- Use invoke model

## 19.11.0

This release has 6 other changes.

### Other changes

- Hack for sassPlugin
- Allow override
- Fix docs
- Add support for any eslint.config file
- Switch to mts as default
- Refactor eslint.config.mjs

## 19.10.0

This release has 3 other changes.

### Other changes

- Fix d.cts path
- Add exports
- Add AppContext

## 19.9.0

This release has 1 other change.

### Other changes

- Lint tsx

## 19.8.2

- Minor changes

## 19.8.1

This release has 1 other change.

### Other changes

- Pass original reference

## 19.8.0

- Complete canvas link text editing

## 19.7.1-beta.6

This release has 1 other change.

### Other changes

- Apply multiple links

## 19.7.1-beta.5

This release has 1 other change.

### Other changes

- Use proper index

## 19.7.1-beta.4

This release has 1 other change.

### Other changes

- Add missing properties

## 19.7.1-beta.3

This release has 1 other change.

### Other changes

- Refactor Canvas links

## 19.7.1-beta.2

This release has 2 other changes.

### Other changes

- Extract canvas key parsing
- Fix sourcemaps regex

## 19.7.1-beta.1

This release has 1 other change.

### Other changes

- Handle canvas text changes

## 19.7.0

This release has 1 other change.

### Other changes

- fixFrontmatterMarkdownLinks

## 19.6.0

This release has 1 other change.

### Other changes

- Don't fail on invalid json

## 19.5.0

This release has 1 other change.

### Other changes

- parseMetadata

## 19.4.0

This release has 1 other change.

### Other changes

- Ensure isExternal is always set

## 19.3.0

This release has 2 other changes.

### Other changes

- Remove deprecated rules
- Keep wikilinks explicit alias

## 19.2.2

This release has 1 other change.

### Other changes

- Fix audit

## 19.2.1

This release has 1 other change.

### Other changes

- Fix eslint.config path

## 19.2.0

This release has 4 other changes.

### Other changes

- Fix node10 attw
- Simplify replacement
- Replace import/export, don't modify  type
- Change extension to fix imports

## 19.1.2-beta.5

This release has 4 other changes.

### Other changes

- Fix cli
- Fix multiline case
- Extract unused types
- Group by eslint plugins

## 19.1.2-beta.4

This release has 2 other changes.

### Other changes

- Fix extra space
- Switch to import type

## 19.1.2-beta.3

This release has 1 other change.

### Other changes

- Fix types generator

## 19.1.2-beta.2

This release has 1 other change.

### Other changes

- Fix Library paths

## 19.1.2-beta.1

This release has 1 other change.

### Other changes

- Separate esm/cjs folders

## 19.1.1

This release has 1 other change.

### Other changes

- Don't use cached settings

## 19.1.0

- Minor changes

## 19.0.1

This release has 2 other changes.

### Other changes

- Avoid duplication
- Use fixed typings

## 19.0.0

- Make compatible with [Are the types wrong?](https://arethetypeswrong.github.io/)

## 18.4.2

This release has 1 other change.

### Other changes

- Fix setDisabled

## 18.4.1

This release has 1 other change.

### Other changes

- Fix event listener

## 18.4.0

This release has 1 other change.

### Other changes

- Add MultipleTextComponent

## 18.3.0

This release has 1 other change.

### Other changes

- Add validation

## 18.2.1

This release has 1 other change.

### Other changes

- Fix style

## 18.2.0

This release has 2 other changes.

### Other changes

- Fix style
- Refactor to async Prompt

## 18.1.0

This release has 1 other change.

### Other changes

- Refactor modals

## 18.0.5

This release has 1 other change.

### Other changes

- Extract constants

## 18.0.4

This release has 2 other changes.

### Other changes

- Fix ignores
- Ignore js

## 18.0.3

This release has 1 other change.

### Other changes

- Init separately

## 18.0.2

This release has 2 other changes.

### Other changes

- Refactor BrowserProcess
- Refactor require usages

## 18.0.1

This release has 2 other changes.

### Other changes

- Ensure build:static executed before version
- Fix package dir path

## 18.0.0

This release has 3 other changes.

### Other changes

- Add static eslint config
- Fix eslint warning
- Use 1-based month

## 17.10.2-beta.10

This release has 1 other change.

### Other changes

- Try other style

## 17.10.2-beta.9

This release has 1 other change.

### Other changes

- Better css

## 17.10.2-beta.8

This release has 1 other change.

### Other changes

- Fix selected style

## 17.10.2-beta.7

This release has 2 other changes.

### Other changes

- Release styles.css if exists
- Revert "Use the same format for releases"

## 17.10.2-beta.6

This release has 7 other changes.

### Other changes

- Fix cast
- Don't generate export for styles folder
- Fix sass arg
- Generate index.ts only if there are other .ts
- Use the same format for releases
- Switch to compile sass
- Improve style

## 17.10.2-beta.5

This release has 1 other change.

### Other changes

- Fix nested style

## 17.10.2-beta.4

This release has 1 other change.

### Other changes

- Fix styles.css and clean it

## 17.10.2-beta.3

This release has 1 other change.

### Other changes

- Replace libraries in mjs

## 17.10.2-beta.2

This release has 4 other changes.

### Other changes

- Allow override getTransformer
- Add DurationTransformer
- Fix localRequire
- Add trailing semicolon

## 17.10.2-beta.1

This release has 9 other changes.

### Other changes

- Don't replace import.meta.url in esm
- Refactor require usage
- Refactor changeExtension
- Regenerate exports
- Don't generate cjs/mjs exports for @types folder
- Move from @types.ts
- Generate mjs exports
- Refactor to transformer
- Warn unknown properties

## 17.10.1

This release has 1 other change.

### Other changes

- Simplify styles

## 17.10.0

This release has 3 other changes.

### Other changes

- Switch to moment.Duration
- Add comments
- Add all files

## 17.9.1

This release has 1 other change.

### Other changes

- Fix beta check

## 17.9.0

This release has 7 other changes.

### Other changes

- Add plugin beta releases for BRAT
- Add components
- Don't increase patch after beta
- Fix `any`
- Add `SettingEx`
- Switch to plural `Modals`
- Use builtin validation

## 17.8.0

This release has 1 other change.

### Other changes

- Add enum helpers

## 17.7.0

This release has 2 other changes.

### Other changes

- Lint
- Ensure proper debugger in CLI

## 17.6.0

This release has 1 other change.

### Other changes

- Typed deleteProperty/deleteProperties

## 17.5.0

This release has 1 other change.

### Other changes

- Ensure not-empty pluginId

## 17.4.0

This release has 1 other change.

### Other changes

- Add svelte-wrapper

## 17.3.0

This release has 1 other change.

### Other changes

- Add CodeMirror's StateFieldSpec

## 17.2.2

- Disable no-invalid-this as it will always fail for prototype methods

## 17.2.1

- Disable class-methods-use-this as it will always fail for settings classes

## 17.2.0

This release has 1 other change.

### Other changes

- More lint rules

## 17.1.1

This release has 1 other change.

### Other changes

- Extend source maps regex

## 17.1.0

This release has 1 other change.

### Other changes

- Fix source maps for css

## 17.0.2

This release has 1 other change.

### Other changes

- Fix sassPlugin cjs/esm binding

## 17.0.1

This release has 1 other change.

### Other changes

- Allow css imports

## 17.0.0

This release has 4 other changes.

### Other changes

- Remove allowJs setting
- Add support for sass
- Add svelte compile
- Ensure onLayoutReady is called after onload completed

## 16.6.4

This release has 2 other changes.

### Other changes

- Init require for each plugin separately
- Use local require

## 16.6.3

This release has 1 other change.

### Other changes

- Init name first

## 16.6.2

This release has 1 other change.

### Other changes

- Ensure __extractDefault

## 16.6.1

This release has 1 other change.

### Other changes

- Revert to globalThis

## 16.6.0

This release has 1 other change.

### Other changes

- Refactor init

## 16.5.0

This release has 1 other change.

### Other changes

- Mock process

## 16.4.4

This release has 1 other change.

### Other changes

- Disable line break before =

## 16.4.3

This release has 1 other change.

### Other changes

- functionExpression.spaceAfterFunctionKeyword

## 16.4.2

This release has 1 other change.

### Other changes

- Space after new

## 16.4.1

This release has 2 other changes.

### Other changes

- Fix dir path
- resolvePathFromRootSafe

## 16.4.0

This release has 4 other changes.

### Other changes

- Add `eqeqeq` rule
- Add `format:check` command
- Add `format` script
- Add `fullRender`

## 16.3.0

This release has 1 other change.

### Other changes

- Generate exports for moduleResolution=node

## 16.2.0

This release has 1 other change.

### Other changes

- printToPdf

## 16.1.0

This release has 1 other change.

### Other changes

- Use shared debugLib

## 16.0.3

This release has 1 other change.

### Other changes

- Make _shouldSaveAfterLoad protected

## 16.0.2

This release has 1 other change.

### Other changes

- Fix Settings generics

## 16.0.1

This release has 1 other change.

### Other changes

- Fix generics

## 16.0.0

This release has 1 other change.

### Other changes

- Refactor settings

## 15.0.0

This release has 2 other changes.

### Other changes

- Watch css changes
- Refactor bind

## 14.4.0

This release has 1 other change.

### Other changes

- Update NpmShrinkwrapJson

## 14.3.0

This release has 1 other change.

### Other changes

- Add error tooltip

## 14.2.0

This release has 1 other change.

### Other changes

- Validate on bind

## 14.1.0

This release has 1 other change.

### Other changes

- Add shouldShowValidationMessage

## 14.0.0

This release has 9 other changes.

### Other changes

- Inject CSS styles
- Add revalidate
- Extract prepareGitHubRelease
- Init context only if plugin loads
- Migrate getApp() to re-branded plugin
- Show errors for current element only
- Add NPM release to GitHub
- Remove `rule` word from ESLint output
- Use async validation

## 13.15.0

This release has 2 other changes.

### Other changes

- Allow underscored unused-vars
- Add onExternalSettingsChange

## 13.14.1

This release has 1 other change.

### Other changes

- Fix package warning

## 13.14.0

This release has 1 other change.

### Other changes

- Ensure all env variables passed

## 13.13.1

- Missing release

## 13.13.0

This release has 2 other changes.

### Other changes

- Add support for CLI
- Fix formatting

## 13.12.1

This release has 1 other change.

### Other changes

- Fix formatting

## 13.12.0

This release has 2 other changes.

### Other changes

- Improve init message
- Fix broken call

## 13.11.0

This release has 1 other change.

### Other changes

- Improve stack trace printer

## 13.10.1

This release has 1 other change.

### Other changes

- Don't show `consoleDebug()` in call stack

## 13.10.0

This release has 1 other change.

### Other changes

- Refactor and document debugging

## 13.9.0

This release has 1 other change.

### Other changes

- Make printError working in node.js

## 13.8.0

This release has 2 other changes.

### Other changes

- Add shouldHandleErrors
- Pass optional console

## 13.7.3

This release has 1 other change.

### Other changes

- Search key only letters

## 13.7.2

This release has 1 other change.

### Other changes

- Fix index formatting

## 13.7.1

This release has 1 other change.

### Other changes

- Fix pretty format

## 13.7.0

This release has 2 other changes.

### Other changes

- Edit CHANGELOG.md in editor
- Calculate maxDepth properly

## 13.6.1

This release has 2 other changes.

### Other changes

- Check shouldHandleCircularReferences
- Check shouldCatchToJSONErrors

## 13.6.0

This release has 2 other changes.

### Other changes

- Add void replacer
- Refactor toJson

## 13.5.0

This release has 2 other changes.

### Other changes

- Add shouldCatchToJSONErrors
- Make toJson valid JavaScript object

## 13.4.0

This release has 1 other change.

### Other changes

- Add key sorting

## 13.3.2

This release has 1 other change.

### Other changes

- Skip empty messages

## 13.3.1

This release has 3 other changes.

### Other changes

- Include full body
- Add missing NUL separator flag
- Fix non-global regexps

## 13.3.0

This release has 1 other change.

### Other changes

- Support multi-line log commits

## 13.2.1

- Special handle when replacer is the string. Didn't work correctly for string with $1 $2 etc

## 13.2.0

This release has 1 other change.

### Other changes

- Update targets

## 13.1.0

This release has 2 other changes.

### Other changes

- Refactor replaceAll/replaceAllSync
- Use stricter typescript

## 13.0.0

This release has 1 other change.

### Other changes

- Refactor toJson

## 12.2.1

This release has 1 other change.

### Other changes

- Update tsdoc

## 12.2.0

This release has 1 other change.

### Other changes

- Refactor DEBUG

## 12.1.0

This release has 3 other changes.

### Other changes

- Don't fail when no root dir
- Set process.browser
- Switch to debug lib

## 12.0.0

- Refactor appendCodeBlock to DocumentFragment or HTMLElement

## 11.5.0

- Fix double require transform

## 11.4.0

This release has 2 other changes.

### Other changes

- Don't put helper functions to top-level as applying to itself produces invalid code
- Minify prod builds

## 11.3.0

This release has 1 other change.

### Other changes

- Change check for __filename

## 11.2.0

This release has 1 other change.

### Other changes

- Add deleteProperty/ies

## 11.1.0

This release has 3 other changes.

### Other changes

- Preserve link alias case
- Create FUNDING.yml
- Update README examples

## 11.0.0

This release has 1 other change.

### Other changes

- Remove shouldUpdateLinks

## 10.0.0

This release has 1 other change.

### Other changes

- Add shouldHandleRenames/Deletions

## 9.0.2

This release has 1 other change.

### Other changes

- Handle empty files properly

## 9.0.1

This release has 1 other change.

### Other changes

- cspell

## 9.0.0

This release has 27 other changes.

### Other changes

- Support multiple interrupted renames
- Reinitiate rename
- Move check
- Try handle interrupted renames earlier
- Accept non-existing files
- Check both old and new path caches
- Use path instead of file instance for check
- Extract VaultEx to avoid circular ref
- Extract readSafe
- Don't log timeout if already finished
- Use key=value format for npm config set
- Rewrite without queue to avoid deadlocks
- Lint
- Use performance.now() for bigger accuracy
- Disable timeout in DEBUG mode
- Refactor dotenv usages
- Extract Publish command
- Pass NPM_TOKEN
- Add publish
- Log handlers array, because iterator logs as empty
- Handle case where file renamed during running handler
- Make all optional parameters truly optional
- Carefully check for missing file
- Pass oldPathLinks earlier
- Better logging Plugins with registered rename/delete handlers
- Rename variables for clarity
- Extract ...ifEnabled functions

## 8.0.0

This release has 4 other changes.

### Other changes

- Don't update changelog for beta builds
- Add support to ignore path
- Refactor PluginSettings
- isValidRegExp

## 7.0.0

This release has 1 other change.

### Other changes

- Improve FS performance

## 6.2.1

- Republish

## 6.2.0

This release has 1 other change.

### Other changes

- Add sync versions

## 6.1.0

This release has 3 other changes.

### Other changes

- Add more node types
- Allow call Root methods if no roots
- Use full definition for PackageJson

## 6.0.0

This release has 3 other changes.

### Other changes

- Add abortSignal
- Fix for link converters
- Rename many properties (BREAKING CHANGE)

## 5.3.1

This release has 1 other change.

### Other changes

- Properly resolve path on rename

## 5.3.0

This release has 1 other change.

### Other changes

- Make abortSignal public

## 5.2.0

This release has 1 other change.

### Other changes

- Switch to emitAsyncErrorEvent

## 5.1.0

This release has 1 other change.

### Other changes

- Add Loop

## 5.0.1

This release has 1 other change.

### Other changes

- Add support for parsing `[](url)`

## 5.0.0

This release has 1 other change.

### Other changes

- Don't retry on error by default

## 4.21.0

This release has 1 other change.

### Other changes

- Use Frontmatter casing

## 4.20.0

This release has 2 other changes.

### Other changes

- Support string urls
- Don't allow whitespace in url

## 4.19.0

This release has 3 other changes.

### Other changes

- Don't fail if couldn't decode URL
- Support canvas changes
- Update canvas files only if Canvas Plugin enabled

## 4.18.1

This release has 1 other change.

### Other changes

- Handle wikilinks with spaces

## 4.18.0

This release has 1 other change.

### Other changes

- Extract url

## 4.17.0

This release has 1 other change.

### Other changes

- Fix esm defaults

## 4.16.0

This release has 2 other changes.

### Other changes

- Add parseLink
- Distinguish file path and file:// urls

## 4.15.0

This release has 1 other change.

### Other changes

- Add support for indirect paths such as `a/b/../c`

## 4.14.0

This release has 1 other change.

### Other changes

- Load cache from newPath

## 4.13.3

- Repeat

## 4.13.2

This release has 1 other change.

### Other changes

- Move patching require to preprocess

## 4.13.1

This release has 1 other change.

### Other changes

- Add support for missing modules such as electron

## 4.13.0

This release has 1 other change.

### Other changes

- Fix logging

## 4.12.0

This release has 1 other change.

### Other changes

- Don't allow default exports

## 4.11.0

This release has 3 other changes.

### Other changes

- Lint
- Refactor to Queue
- Log timeout

## 4.10.0

This release has 2 other changes.

### Other changes

- ChainedPromise
- editBacklinks

## 4.9.0

This release has 2 other changes.

### Other changes

- Add replaceCodeBlock
- Refactor getCodeBlockArguments

## 4.8.2

This release has 1 other change.

### Other changes

- Disable import rules

## 4.8.1

This release has 1 other change.

### Other changes

- Lint

## 4.8.0

This release has 1 other change.

### Other changes

- Configure retry on error

## 4.7.0

This release has 1 other change.

### Other changes

- Add getFullContentHtml

## 4.6.0

This release has 3 other changes.

### Other changes

- Add more sorting
- Add markdownToHtml
- Add missing docs

## 4.5.0

This release has 1 other change.

### Other changes

- Add insertAt

## 4.4.0

This release has 1 other change.

### Other changes

- Validate initial value

## 4.3.1

This release has 1 other change.

### Other changes

- Fix assignWithNonEnumerableProperties

## 4.3.0

This release has 1 other change.

### Other changes

- Simplify generics

## 4.2.0

This release has 1 other change.

### Other changes

- Refactor

## 4.1.0

This release has 1 other change.

### Other changes

- Add onChanged callback

## 4.0.0

This release has 1 other change.

### Other changes

- Don't lose validation on blur

## 3.44.0

This release has 1 other change.

### Other changes

- Delete only if has own attachment folder

## 3.43.2

This release has 1 other change.

### Other changes

- Fix backlinks API

## 3.43.1

This release has 1 other change.

### Other changes

- Save only non-deferred views

## 3.43.0

This release has 2 other changes.

### Other changes

- Extract Exec
- Don't fail on error in retryWithTimeout

## 3.42.4

This release has 1 other change.

### Other changes

- Remove code after source maps

## 3.42.3

This release has 1 other change.

### Other changes

- Avoid line break

## 3.42.2

This release has 1 other change.

### Other changes

- Refactor newContent

## 3.42.1

This release has 1 other change.

### Other changes

- Handle rename only for files

## 3.42.0

This release has 1 other change.

### Other changes

- Extract link helpers

## 3.41.0

This release has 1 other change.

### Other changes

- Handle broken canvas

## 3.40.0

This release has 2 other changes.

### Other changes

- Add fix for unhandled `sourcemaps`
- Add support for `FrontmatterLinkCache`

## 3.39.0

This release has 2 other changes.

### Other changes

- Avoid unnecessary renames
- Don't store metadata if not set `shouldDeleteOrphanAttachments`

## 3.38.0

- Refactor

## 3.37.0

This release has 1 other change.

### Other changes

- Replace Promise with MaybePromise

## 3.36.4

This release has 1 other change.

### Other changes

- Improve check for CJS

## 3.36.3

This release has 1 other change.

### Other changes

- Check for replacement, not its variable

## 3.36.2

This release has 1 other change.

### Other changes

- Avoid useless replacements

## 3.36.1

This release has 1 other change.

### Other changes

- Prevent replacement

## 3.36.0

This release has 1 other change.

### Other changes

- Make `import.meta.url` more universal

## 3.35.0

This release has 2 other changes.

### Other changes

- Remove unnecessary logging
- Ensure timestamps are up to date

## 3.34.0

This release has 1 other change.

### Other changes

- Ensure MetadataCache update triggered

## 3.33.0

This release has 1 other change.

### Other changes

- Refactor yaml parsing

## 3.32.0

This release has 2 other changes.

### Other changes

- `getNoteFilesSorted`
- Refactor `instanceof` calls

## 3.31.0

This release has 5 other changes.

### Other changes

- Use safe overload of `getBacklinksForFile`
- Refactor `chain` to support sync
- Refactor `RenameHandler`
- Escape markdown alias symbols
- Handle `renameSafe` with change case

## 3.30.0

This release has 4 other changes.

### Other changes

- Increase patch version if `beta` is 0
- Avoid wrong initialization
- Refactor `shouldResetAlias`
- Refactor to `getFile`/`getFolder`

## 3.29.2

This release has 1 other change.

### Other changes

- Create dir recursively

## 3.29.1

- Ensure `obsidianConfigDir` POSIX path

## 3.29.0

This release has 2 other changes.

### Other changes

- Ensure file's folder created
- Add `getOrCreateFile`/`getOrCreateFolder`

## 3.28.2

This release has 1 other change.

### Other changes

- Refactor

## 3.28.1

This release has 1 other change.

### Other changes

- Avoid extra dot

## 3.28.0

This release has 2 other changes.

### Other changes

- Refactor all filesystem methods
- Add copySafe

## 3.27.0

This release has 1 other change.

### Other changes

- Implement `renameSafe`

## 3.26.1

This release has 1 other change.

### Other changes

- Cache only markdown

## 3.26.0

This release has 1 other change.

### Other changes

- Delete attachments after deleting note

## 3.25.1

This release has 1 other change.

### Other changes

- Init fake missing attachments folder

## 3.25.0

This release has 2 other changes.

### Other changes

- Download hot-reload
- Don't accept empty folder

## 3.24.1

- Ensure `OBSIDIAN_CONFIG` from `.env` has higher precedence

## 3.24.0

This release has 3 other changes.

### Other changes

- Add `dotenv`
- Refactor and add more logging
- Simplify `convertSyncToAsync`

## 3.23.0

This release has 1 other change.

### Other changes

- Add `omitReturnType`

## 3.22.0

This release has 2 other changes.

### Other changes

- Refactor `RenameDeleteHandler`
- Add `chainAsyncFn`

## 3.21.0

This release has 1 other change.

### Other changes

- Add `includeAttachmentExtensionToEmbedAlias`

## 3.20.0

This release has 1 other change.

### Other changes

- Add `shouldUpdateFilenameAlias`

## 3.19.0

- Refactor Link functions

## 3.18.0

This release has 1 other change.

### Other changes

- Ensure `RenameDeleteHandler` is executed only once

## 3.17.0

This release has 3 other changes.

### Other changes

- allowEmptyEmbedAlias
- allowNonExistingFile
- Infer settings from the originalLink

## 3.16.0

This release has 2 other changes.

### Other changes

- Rename and refactor `listSafe`
- Check for empty folder including hidden items

## 3.15.0

This release has 2 other changes.

### Other changes

- Prefer to use vault functions over adapter's
- Improve check for Windows POSIX-like paths

## 3.14.1

This release has 1 other change.

### Other changes

- Refactor

## 3.14.0

This release has 2 other changes.

### Other changes

- Rename 'remove' to 'delete'
- Add check for shouldDeleteOrphanAttachments

## 3.13.0

This release has 1 other change.

### Other changes

- Remove to trash

## 3.12.0

This release has 4 other changes.

### Other changes

- Add build:validate command
- Ensure code compiles before running esbuild
- Don't lint during esbuild
- Make updateLink to preserve angle brackets and leading dot

## 3.11.8

This release has 1 other change.

### Other changes

- Switch to cspell binary as the library is not cjs

## 3.11.7

This release has 1 other change.

### Other changes

- Reimplement pkg-dir as it is not cjs module

## 3.11.6

This release has 1 other change.

### Other changes

- Replace builtin-modules with node.js version

## 3.11.5

This release has 2 other changes.

### Other changes

- Switch to function approach
- Preserve __require() name to keep esbuild transforms

## 3.11.4

This release has 1 other change.

### Other changes

- Use `__require()` only for node modules

## 3.11.3

This release has 1 other change.

### Other changes

- Use proper `require()` function

## 3.11.2

This release has 1 other change.

### Other changes

- Handle default requires

## 3.11.1

This release has 2 other changes.

### Other changes

- Handle different quotes
- Fix replacing extension

## 3.11.0

This release has 1 other change.

### Other changes

- Remove bundling dependencies

## 3.10.1

This release has 1 other change.

### Other changes

- Move typescript-eslint dependency

## 3.10.0

This release has 3 other changes.

### Other changes

- Add quotes rule
- Extract registerRenameDeleteHandlers
- Improve console logging details

## 3.9.0

This release has 1 other change.

### Other changes

- Extract RenameDeleteHandler

## 3.8.0

This release has 1 other change.

### Other changes

- Implement getAvailablePathForAttachments without patching mkdir

## 3.7.1

This release has 1 other change.

### Other changes

- Ensure folders are created

## 3.7.0

This release has 1 other change.

### Other changes

- Handle defaultOptionsFn

## 3.6.0

This release has 3 other changes.

### Other changes

- Force tags
- Allow empty commit
- Add placeholder to prompt

## 3.5.0

This release has 2 other changes.

### Other changes

- Don't change aliases for markdown links
- Make generateMarkdownLink work for deleted TFile

## 3.4.1

This release has 1 other change.

### Other changes

- Use cancelButtonText

## 3.4.0

This release has 1 other change.

### Other changes

- Refactor all modals

## 3.3.0

This release has 1 other change.

### Other changes

- Add Confirm modal

## 3.2.0

This release has 1 other change.

### Other changes

- Reload plugin settings before updating

## 3.1.0

This release has 1 other change.

### Other changes

- Proper check to handle mobile

## 3.0.4

This release has 1 other change.

### Other changes

- Proper exclude files prop

## 3.0.3

This release has 3 other changes.

### Other changes

- Don't fail on failed linting
- Skip linting if no files
- Lint only explicit patterns

## 3.0.2

This release has 2 other changes.

### Other changes

- Update package-lock
- Fix localforage dep

## 3.0.1

This release has 1 other change.

### Other changes

- Fix cli path

## 3.0.0

- Refactor ESLint rules
- Avoid using node: modules

## 2.27.0

This release has 1 other change.

### Other changes

- ensureMetadataCacheReady in getBacklinksForFileSafe

## 2.26.3

This release has 1 other change.

### Other changes

- Fix return type for isNote

## 2.26.2

This release has 1 other change.

### Other changes

- Handle removed parent folder case

## 2.26.1

This release has 1 other change.

### Other changes

- Prevent double patching

## 2.26.0

This release has 1 other change.

### Other changes

- Handle fake attachment folder

## 2.25.2

This release has 1 other change.

### Other changes

- Register file in uniqueFileLookup

## 2.25.1

This release has 1 other change.

### Other changes

- Clarify forceRelativePath

## 2.25.0

This release has 1 other change.

### Other changes

- Export all internal types

## 2.24.0

This release has 1 other change.

### Other changes

- Extend generateMarkdownLink

## 2.23.3

This release has 1 other change.

### Other changes

- Fix options merging

## 2.23.2

This release has 1 other change.

### Other changes

- Disable removeFolderSafe notice by default

## 2.23.1

This release has 1 other change.

### Other changes

- Fix removeEmptyFolderHierarchy

## 2.23.0

This release has 1 other change.

### Other changes

- registerFileInVault

## 2.22.1

This release has 1 other change.

### Other changes

- Add missing init

## 2.22.0

This release has 1 other change.

### Other changes

- Create temp file and folders

## 2.21.2

This release has 1 other change.

### Other changes

- Make createFolderSafe boolean

## 2.21.1

This release has 1 other change.

### Other changes

- Fix parameter type

## 2.21.0

This release has 1 other change.

### Other changes

- Handle default setting

## 2.20.0

This release has 1 other change.

### Other changes

- Pass plugin instead of tab

## 2.19.0

This release has 1 other change.

### Other changes

- Refactor UIComponent

## 2.18.0

- Export getAlias

## 2.17.1

This release has 1 other change.

### Other changes

- Make dependency for build purpose

## 2.17.0

This release has 2 other changes.

### Other changes

- Update tsdocs
- Allow custom configs to Linter

## 2.16.0

This release has 1 other change.

### Other changes

- Add FrontMatter types

## 2.15.0

This release has 2 other changes.

### Other changes

- getFrontMatterSafe
- Allow unchanged links

## 2.14.0

This release has 1 other change.

### Other changes

- editLinks

## 2.13.0

This release has 2 other changes.

### Other changes

- Refactor Vault
- Refactor FrontMatter

## 2.12.0

This release has 3 other changes.

### Other changes

- Sort lint results by path
- Switch to PathOrFile
- Missing export

## 2.11.0

- More Dataview functions

## 2.10.0

- Refactor cli

## 2.9.0

- Insert empty token to ensure it doesn't break sourceMappingURL in other plugins

## 2.8.0

This release has 1 other change.

### Other changes

- If .d.ts required, skip it

## 2.7.0

This release has 2 other changes.

### Other changes

- Ensure copyToObsidianPluginFolder is the last step
- insertCodeBlock

## 2.6.1

This release has 1 other change.

### Other changes

- Add missing package

## 2.6.0

- Dataview - update deps

## 2.5.0

This release has 1 other change.

### Other changes

- Add getApp

## 2.4.0

- Move Dataview generics to methods

## 2.3.0

- Add proper dependency to fix import resolution

## 2.2.0

This release has 3 other changes.

### Other changes

- Force brackets in lambdas
- Add DocumentFragment
- Allow passing custom pluginSettings

## 2.1.0

This release has 1 other change.

### Other changes

- Pass customEsbuildPlugins to ObsidianPlugin

## 2.0.0

This release has 2 other changes.

### Other changes

- Proper update in `package-lock.json`
- Inline `obsidian-dataview` types

## 1.8.0

This release has 2 other changes.

### Other changes

- Don't skip ESM modules from bundling
- Report spellcheck error without stack

## 1.7.7

This release has 3 other changes.

### Other changes

- Replace .ts to .cjs
- Remove generation dependencies
- Switch all to dependencies

## 1.7.6

This release has 1 other change.

### Other changes

- Mark esbuild/eslint as externals

## 1.7.5

This release has 2 other changes.

### Other changes

- Don't use getDependenciesToSkip in plugin build
- Remove old path dep

## 1.7.4

- Don't exit on `npm run dev`

## 1.7.3

This release has 1 other change.

### Other changes

- Switch to var as it what esbuild converts const to

## 1.7.2

This release has 3 other changes.

### Other changes

- Avoid second definition of the const
- Allow MaybePromise for overrides
- Move typings to deps

## 1.7.1

- Make proper `bindValueComponent` overloads

## 1.7.0

- Allow convert plugin setting values

## 1.6.0

This release has 5 other changes.

### Other changes

- Serialize JSON with functions
- Add more String functions
- Rename invokeEsbuild
- Switch to path-browserify
- Improve tsdoc

## 1.5.1

- Auto commit package-lock.json

## 1.5.0

This release has 3 other changes.

### Other changes

- Add tsdoc
- Edit package-lock.json
- Fix lint for missing folder

## 1.4.0

This release has 1 other change.

### Other changes

- Switch to lint:fix

## 1.3.2

This release has 1 other change.

### Other changes

- Stop build if exports changed

## 1.3.1

- Spellcheck

## 1.3.0

This release has 1 other change.

### Other changes

- Fix Dataview typings

## 1.2.0

This release has 2 other changes.

### Other changes

- Lint only src and scripts
- Add build:clean, build:static commands

## 1.1.1

This release has 1 other change.

### Other changes

- copyUpdatedManifest only for plugin

## 1.1.0

This release has 2 other changes.

### Other changes

- Simplify generics
- Make version scripts for plugin and not

## 1.0.2

This release has 3 other changes.

### Other changes

- Fix eslint/cspell commands
- Make release files same as npm
- Exclude dist.zip from npm

## 1.0.1

- Add PluginBase
- Fixes

## 1.0.0

- Initial version
