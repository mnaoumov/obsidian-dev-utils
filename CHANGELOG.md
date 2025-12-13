# CHANGELOG

## 45.3.1

- fix: addComponentSafe re https://github.com/RainCat1998/obsidian-custom-attachment-location/issues/254
- chore: update libs

## 45.3.0

- feat: add array-delegating command invocations
- feat: don't execute when files are not selected

## 45.2.0

- feat: use SequentialAbstractFilesCommandInvocationBase

## 45.1.0

- chore: update libs
- feat: add SequentialAbstractFilesCommandInvocationBase

## 45.0.4

- fix: unescape interpolations

## 45.0.3

- fix: constant initialization

## 45.0.2

- chore: update libs

## 45.0.1

- feat: extract i18n
- feat: round timestamps
- feat: show total time

## 45.0.0

- feat: don't break on timeout, just show notice

## 44.3.0

- feat: refactor commands

## 44.2.4

- chore: fix eslint jsdoc
- chore: update libs

## 44.2.3

- chore: republish npm

## 44.2.2

- fix: escape alias from filename
- chore: update libs

## 44.2.1

- chore: update libs

## 44.2.0

- fix: handle attachments of md-attachments
  - re <https://github.com/RainCat1998/obsidian-custom-attachment-location/issues/245>
  - re <https://github.com/dy-sh/obsidian-consistent-attachments-and-links/issues/145>

## 44.1.0

- fix: more support for overlapping changes re <https://github.com/mnaoumov/obsidian-better-markdown-links/issues/28>

## 44.0.0

- chore: lint
- fix: handle nested links re <https://github.com/mnaoumov/obsidian-better-markdown-links/issues/28>
- docs: add examples
- feat: add unescaped alias
- feat: disable escaping aliases by default

## 43.10.4

- chore: export obsidianmd plugin

## 43.10.3

- fix: temporarily add globals until <https://github.com/obsidianmd/eslint-plugin/pull/73> is released
- chore: fix package-lock

## 43.10.2

- fix: move eslint-plugin-obsidianmd to runtime dependency

## 43.10.1

- chore: move fully to obsidian moment

## 43.10.0

- fix: determine obsidian-dev-utils
- chore: add obsidianmd lint
- fix: handle nested links re <https://github.com/mnaoumov/obsidian-better-markdown-links/issues/28>

## 43.9.0

- feat: add links update notice

## 43.8.0

- feat: expose handleSilentError

## 43.7.1

- fix: force alias only for markdown files
  - re <https://github.com/mnaoumov/obsidian-better-markdown-links/issues/27>
- chore: update libs

## 43.7.0

- chore: fix url
- fix: unescape alias
- chore: update libs

## 43.6.1

- fix: compilation after moving loadPrism
- fix: add check for old/new keys
  - re <https://github.com/dy-sh/obsidian-consistent-attachments-and-links/issues/143>
- chore: update libs

## 43.6.0

- chore: sort package.json
- feat: add lock editor and notice
- chore: install codemirror
- chore: update libs

## 43.5.0

- chore: update libs
- feat: select default value in prompt

## 43.4.0

- feat: generateRawMarkdownLink

## 43.3.0

- feat: escapeAlias

## 43.2.7

- fix: call mobile require only when it makes sense

## 43.2.6

- fix: better fix for missing window

## 43.2.5

- fix: window can be optional

## 43.2.4

- fix: don't even try to call original require on mobile

## 43.2.3

- feat: hack for app.emulateMobile()
- feat: don't show non-critical error by default
- chore: update libs

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

- feat: highlight focused links

## 43.1.3

- fix: fix tabIndex

## 43.1.2

- fix: tabIndex of code highlighter

## 43.1.1

- fix: css query
- chore: update libs

## 43.1.0

- feat: add oldAttachmentPathOrFile
- Revert "refactor: getAttachmentFilePath" This reverts commit 55bfdb908f64801b8f5d663dcddd86bc0b4d850a.
- chore: lint

## 43.0.0

- chore: update libs
- refactor: getAttachmentFilePath

## 42.8.1

- chore: lint configs
- feat: include MarkdownlintCli2Config files for linting
- docs: switch from tsx to jiti

## 42.8.0

- feat: switch from tsx to jiti

## 42.7.0

- feat: add ctrl+tab/ctrl+shift+tab for CodeHighlighterComponent
- feat: strongly-typed settings
- chore: update libs
- feat: better error handling
- feat: enable markdown lint
- feat: allow node-js libs from scripts folder

## 42.6.5

- chore: lint
- chore: update libs
- chore: eslint comment
- fix: don't add ! for non-md files links starting from 1.10.0

## 42.6.4

- chore: update libs

## 42.6.3

- chore: update libs
- fix: file changes for frontmatterLinkCacheWithOffsets

## 42.6.2

- chore: reorder scripts

## 42.6.1

- chore: clean empty hook

## 42.6.0

- feat: allow menu-only commands

## 42.5.0

- refactor: forbid non-null assertion
- feat: rename menu section fields

## 42.4.1

- fix: init folder command current folder

## 42.4.0

- docs: force tsdocs for non-private properties
- feat: preserve original name
- feat: add separate filesMenuItemName

## 42.3.0

- feat: add AbstractFileCommandBase, support multiple files menu
- feat: add FolderCommandBase
- feat: switch to async commands

## 42.2.0

- feat: add multiple default options

## 42.1.1

- docs: add missing tsdocs
- chore: add Commands to package.json
- fix: move Commands to source

## 42.1.0

- fix: jsdoc require-throws-type
- docs: add lint comments
- feat: enable comments eslint rules
- chore: update libs

## 42.0.0

- docs: unify examples form
- feat: rename RelativePathToTheSource BREAKING CHANGE: previous name RelativePathToTheNote was inconsistent

## 41.0.0

- refactor: remove `GenerateMarkdownLinkDefaultOptionsWrapper`

BREAKING CHANGE: `generateMarkdownLink()` now doesn't support default options embedded. You should pass options explicitly

## 40.17.0

- feat: add commands
- chore: use chore: release prefix
- chore: add `npm run commit`

## 40.16.0

- fix: syntax
- feat: enable commitizen
- feat: move to next element on Esc
- feat: add LinkPathStyle
- feat: ensure loop progress bar is visible
- chore: lint
- chore: switch to conventional commits
- chore: update libs
- chore: extract commitizen config

## 40.15.0

- Ensure I18N initialized fully synchronously
- Ensure file saved before reading
- Update libs

## 40.14.0

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

- Improve performance of getting global App

## 40.11.0

- shouldRevertToDefaultValueOnBlur

## 40.10.0

- Refactor into classes
- Register old cache
- Allow cache of non-existing files

## 40.9.1

- Wait for layout ready

## 40.9.0

- getAllDomWindows

## 40.8.0

- Ensure fileMap instance
- Unregister files

## 40.7.0

- Move warnings to debug

## 40.6.0

- Pass oldNotePathOrFile

## 40.5.2

- Switch to enum

## 40.5.1

- Switch to enum

## 40.5.0

- Pass context

## 40.4.0

- Add isSingleSubpathAllowed

## 40.3.1

- Add TranslationKeyMap

## 40.3.0

- Add i18n

## 40.2.0

- Extract handleAsyncError

## 40.1.3

- Handle frontmatter changes properly
  - fix <https://github.com/RainCat1998/obsidian-custom-attachment-location/issues/206>

## 40.1.2

- Prevent timeout warning if run completed with an error

## 40.1.1

- Parse alias

## 40.1.0

- shouldEscapeAlias
  - fix <https://github.com/mnaoumov/obsidian-better-markdown-links/issues/22>

## 40.0.2

- Refactor GetAvailablePathForAttachmentsFnExtended

## 40.0.1

- Refactor GetAvailablePathForAttachmentsFnExtendedWrapper

## 40.0.0

- Refactor GetAvailablePathForAttachments

## 39.0.1

- Upgrade linter config
- Fix runWithTimeout flow
- Update libs

## 39.0.0

- Validate content when preparing file changes

## 38.10.0

- Add more checks for throwIfAborted

## 38.9.0

- Refactor Result
- Handle inner silent errors

## 38.8.1

- Fix for iOS < 17.2

## 38.8.0

- Keep names to have better stack traces

## 38.7.0

- Handle case of file removed during getCacheSafe

## 38.6.1

- Fix typo

## 38.6.0

- registerPopupDocumentDomEvent / registerPopupWindowDomEvent

## 38.5.1

- Don't wait for every save
  - fix\[perf\]: <https://github.com/mnaoumov/obsidian-backlink-cache/issues/10>

## 38.5.0

- Check for extension

## 38.4.3

- Reuse parsed alias
  - fix <https://github.com/mnaoumov/obsidian-better-markdown-links/issues/21#issuecomment-3225879039>

## 38.4.2

- Stop using ctx.getSectionInfo(el) as it is not reliable with live changes

## 38.4.1

- Ensure MetadataCache is ready before checking CodeBlockMarkdownInformation

## 38.4.0

- Don't rename files by default

## 38.3.0

- Skip empty error line
- Add shouldSkipDuplicateCheck

## 38.2.0

- Fix for error links not clickable

## 38.1.0

- DUMMY_PATH

## 38.0.0

- Regenerate attachment names on note rename

## 37.3.0

- Lock file while looking for CodeBlockMarkdownInfo
- invokeWithFileSystemLock
- Simplify errorToString. Ensure links are clickable
- Configure LinkStyle

## 37.2.0

- SilentError

## 37.1.2

- Improve LF handling

## 37.1.1

- Ignore line endings

## 37.1.0

- Ensure editor changes are reflected in the view

## 37.0.0

- Rename shouldKeepGap

## 36.2.0

- Change tsdocs for FunctionOptions interfaces
- Remove word Represents
- shouldKeepGapWhenEmpty

## 36.1.0

- Ensure note saved
- Reformat. Use a/an article in docs

## 36.0.0

- Extract CodeBlockMarkdownInformation

## 35.0.1

- Minor changes

## 35.0.0

- Don't trim frontmatter
- Calculate offsets properly
- Preserve raw args
- Include more context in CodeBlockMarkdownInformation
- Refactor abortSignalAny
- Optional args whitespace

## 34.0.1

- Don't throw if no unique code block found

## 34.0.0

- printError all in one message
- removeCodeBlock
- replaceCodeBlock
- shouldPreserveLinePrefix
- insert before/after code block
- hasSingleOccurrence
- getCodeBlockSectionInfo

## 33.1.1

- Fix build

## 33.1.0

- Improve nameof return type

## 33.0.0

- Refactor debug log with stack traces
- Add full caller call stack
- Refactor Async/AbortController

## 32.0.1

- Remove old fn

## 32.0.0

- Rename validation variables
- oneOf regExp

## 31.3.0

- Get file name validation reg exps
- Handle delete/rename with abort signal

## 31.2.0

- Pass custom abortSignal to queue

## 31.1.0

- Add abortSignal parameter

## 31.0.0

- Ensure removeUndefinedProperties forces exclusions
- Assert no duplicate keys
- Unique array

## 30.7.0

- Interrupt aborted operations

## 30.6.0

- removeUndefinedProperties

## 30.5.1

- Polyfill `AbortSignal.any()`
  - fix <https://github.com/mnaoumov/obsidian-backlink-cache/issues/9>

## 30.5.0

- Add revalidate

## 30.4.1

- Fix scrolling gap

## 30.4.0

- Ensure replaceAll execution order

## 30.3.0

- extractDefaultExportInterop

## 30.2.1

- Improve error message

## 30.2.0

- assertAllTypeKeys

## 30.1.1

- Revert "Add fake default property"

## 30.1.0

- Add fake default property

## 30.0.0

- Rename Object -> ObjectUtils to fix internal conflict of variable Object

## 29.0.2

- Don't treat FrontmatterLinkCacheWithOffsets as duplicate links

## 29.0.1

- Remove cleanKey

## 29.0.0

- shouldRetryOnInvalidChanges

## 28.6.0

- FrontmatterLinkCacheWithOffsets

## 28.5.0

- parseLinks

## 28.4.0

- Add INFINITE_TIMEOUT

## 28.3.0

- Check if load was aborted

## 28.2.2

- Add more logging

## 28.2.1

- Minor changes

## 28.2.0

- Update deprecated eslint rule
- For canvas links rely on backlink-cache plugin or built-in canvas

## 28.1.0

- registerLegacySettingsConverters

## 28.0.0

- Rename file name

## 27.7.1

- Handle sourcePath /

## 27.7.0

- Add support for non-existing link files

## 27.6.1

- Switch to window.setTimeout

## 27.6.0

- Register multiple temp files

## 27.5.4

- Revert useless changes (back to 27.5.1)

## 27.5.3

- Get updated backlinks map

## 27.5.2

- Recalculate backlinks for all files

## 27.5.1

- Keep updating links to ignored files

## 27.5.0

- Don't disable link updates if rename is disabled
  - fix <https://github.com/mnaoumov/obsidian-better-markdown-links/issues/17>

## 27.4.0

- Ensure no `undefined` in replaceAll. Collect missing group indices

## 27.3.1

- Treat base as note

## 27.3.0

- isBaseFile
- Fix exec warning
- Lock version to be patched by obsidian-typings

## 27.2.1

- Add stricter scheme reg exp

## 27.2.0

- Recognize urls such mailto:foo@bar.com
  - fix <https://github.com/mnaoumov/obsidian-frontmatter-markdown-links/issues/9>

## 27.1.0

- Don't show notice if not needed
- Ensure title is wrapped in div

## 27.0.2

- Minor changes

## 27.0.1

- Fix import of process variable

## 27.0.0

- Refactor eslint config naming
- More node modules

## 26.29.2

- Save only changed leaves

## 26.29.1

- Fix init eslint

## 26.29.0

- Ensure isTimedOut flag is reset

## 26.28.0

- Log context fn on timeout

## 26.27.3

- Parse \<url\>

## 26.27.2

- Add missing encoding

## 26.27.1

- Add encodedUrl

## 26.27.0

- encodeUrl

## 26.26.0

- Don't report left attachments

## 26.25.0

- Ensure placeholder shown

## 26.24.0

- hideAsync

## 26.23.0

- Trigger loadSettings even settings were missing

## 26.22.0

- cleanupParentFolders on deletion

## 26.21.0

- Switch to EmptyAttachmentFolderBehavior
- Combine settings properly

## 26.20.0

- Add more deep equal checks

## 26.19.0

- Add hasKey/hasValue

## 26.18.0

- Add TwoWayMap

## 26.17.0

- Add Map/Set transformers

## 26.16.0

- Skip async link updates after rename

## 26.15.2

- Fix timestamp init logic

## 26.15.1

- Fix AbortSignal

## 26.15.0

- requestAnimationFrameAsync only after some threshold

## 26.14.0

- Ensure loop has animationFrame

## 26.13.0

- Avoid unnecessary checks

## 26.12.0

- Refactor getCacheSafe

## 26.11.0

- Patch fileManager to avoid link updates

## 26.10.0

- Cache debuggers to keep timestamps

## 26.9.0

- Allow modify isNote
- Fix root relative

## 26.8.0

- Expose main elements

## 26.7.0

- Style placeholder

## 26.6.0

- Rewrite docs
- Add CodeHighlighterComponent

## 26.5.2

- Fix layout. Static size

## 26.5.1

- Fix flickering

## 26.5.0

- Switch to static wrappers

## 26.4.0

- Add TelephoneComponent.
- Add PasswordComponent.
- fix: #32

## 26.3.0

- fix: #1

## 26.2.1

- Ensure property saved

## 26.2.0

- Add validation to all ValueComponents
- Empty in display
- Empty only on blur
- Refactor default settings validation

## 26.1.2

- Don't fail on wrong frontmatter

## 26.1.1

- Add ERROR_STACK_PREFIX to make links clickable

## 26.1.0

- deepEqual settings
- Change default `shouldResetSettingWhenComponentIsEmpty`
- Remove Error stack

## 26.0.0

- Rename createSettingsManager

## 25.1.0

- Expose SAVE_TO_FILE_CONTEXT

## 25.0.1

- Restore transformers on load settings

## 25.0.0

- Release

## 24.2.1-beta.6

- Update validation on initial bind

## 24.2.1-beta.5

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

- Fix saving

## 24.2.1-beta.3

- Add missing awaits

## 24.2.1-beta.2

- Use current settings in UI

## 24.2.1-beta.1

- Refactor settings manager

## 24.2.0

- Refactor to GenericObject
- More type helpers
- ensureSafe

## 24.1.1

- Switch to debouncing as quit doesn't work well on MacOS
- Update validator and onChanged events even for reset

## 24.1.0

- Release

## 24.0.2-beta.2

- Save on quit
- Force tsdocs for protected methods
- Force tsdocs for class methods
- Format
- Pass save context
- Add isInitialLoad
- Set to original object
- Prevent double set

## 24.0.2-beta.1

- Ensure original setter is called

## 24.0.1

- Ensure validation updated

## 24.0.0

- Add OBSIDIAN_CONFIG_FOLDER warning
- Fix tsdocs
- Rename milliseconds arg
- Replace directory with folder

## 23.0.5

- Fix padding

## 23.0.4

- More detailed warning of possible wrong type. Still continue as it might be an union type
- Reuse MultipleDropdownComponent
- Remove invalid multiple from TypedDropdownComponent

## 23.0.3

- Make tri-state visual

## 23.0.2

- Init settings tab

## 23.0.1

- Minor changes

## 23.0.0

- Rename registerValidators
- Make all virtual Promisable just Promise

## 22.1.1-beta.29

- Don't fail on load if settingsManager is not defined
- Add missing eslint comment

## 22.1.1-beta.28

- Show tab
- Expose settingsTab
- Fix warnings
- Fix tsdocs
- Use concrete types

## 22.1.1-beta.27

- Rename hook methods
- Super calls
- invokeAsyncSafelyAfterDelay
- Make PluginSettingsManagerBase knowing full Plugin type

## 22.1.1-beta.26

- Decode paths with %20 instead of spaces
- Use wrappers
- Add checkbox validation
- Don't show warning Notice

## 22.1.1-beta.25

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

- Support failing validators
- Remove old code
- Init and validate separately to allow dependent validators

## 22.1.1-beta.22

- Subscribe once
- Add once
- Add plugin events
- AsyncEvents
- More tsdocs links

## 22.1.1-beta.21

- Revert underscore logic to fix TS6133
- Add links in tsdocs
- Fix CliTaskResult tsdocs
- Improve virtual method arg naming
- onLoadSettings
- Force save after load if transformed
- Fix formatting
- Mark as saved on load

## 22.1.1-beta.20

- Reuse getAllKeys when transform
- Format
- getAllEntries
- Reuse getAllKeys
- Skip `__proto__`

## 22.1.1-beta.19

- Sort keys

## 22.1.1-beta.18

- Return full PluginSettings
- Add missing await

## 22.1.1-beta.17

- getAllKeys

## 22.1.1-beta.16

- More reliable ExtractPluginSettings

## 22.1.1-beta.15

- Use properties
- Use default values by default
- Better set placeholder
- Show better tooltip
- Make optional
- Improve ExtractPluginSettings
- shouldResetSettingWhenComponentIsEmpty

## 22.1.1-beta.14

- Allow optional functions

## 22.1.1-beta.13

- Refactor to use monkey-around internally
- Hook after load and before saving record

## 22.1.1-beta.12

- Move helpers to Type
- Add access to plugin and app

## 22.1.1-beta.11

- TextBasedComponent

## 22.1.1-beta.10

- Init components without placeholders

## 22.1.1-beta.9

- Separate setValueAndValidate and setValidationMessage
- Don't save unmodified

## 22.1.1-beta.8

- Save only if there are changes
- Properly check for JSON changes

## 22.1.1-beta.7

- Detailed Invalid value type warning

## 22.1.1-beta.6

- Rename PropertyName
- Show warning for wrong values
- Fix dprint rule
- Add default value placeholder
- Support empty validation messages

## 22.1.1-beta.5

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

- Switch to promisable
- Remove unused

## 22.1.1-beta.3

- Add validators

## 22.1.1-beta.2

- Fix array props
- Add tsdoc
- Remove abstract

## 22.1.1-beta.1

- Refactor plugin settings

## 22.1.0

- Output which item caused error

## 22.0.0

- customizeEsbuildOptions

## 21.1.0

- Add progress bar
- Add script examples

## 21.0.1

- ignoreError

## 21.0.0

- Allow customEsbuildOptions
- ignoreError
- Refactor to Promisable
- throwOnAbort

## 20.3.0

- Remove unreliable `clearPendingQueueItems`

## 20.2.1

- Return updated content

## 20.2.0

- Extract `editLinksInContent`

## 20.1.0

- tempRegisterFileAndRunAsync

## 20.0.0

- Reuse type-fest
- MonkeyAround wrapper

## 19.24.0

- Allow this: void

## 19.23.0

- Skip properties that cannot be set

## 19.22.0

- Support ~ fenced code blocks

## 19.21.1

- Fix inverted condition

## 19.21.0

- Allow aliasing `this` to `that`

## 19.20.0

- Add tmpdir to NodeModules

## 19.19.1

- Wrap loop error

## 19.19.0

- Add error async stack trace

## 19.18.0

- Export Stats

## 19.17.6

- Fix transformer check for DurationTransformer

## 19.17.5

- Ensure backlinks refreshed
- Revert broken logic

## 19.17.4

- Update backlinks info

## 19.17.3

- Ensure called with npx

## 19.17.2

- Fix build

## 19.17.1

- Fix run for unknown commands

## 19.17.0

- Escape links in table

## 19.16.2

- Disable jsx formatting rule

## 19.16.1

- Fix input time styles

## 19.16.0

- Expose bind

## 19.15.4

- Explicit move time icon

## 19.15.3

- Don't move time icon

## 19.15.2

- Fix deploy

## 19.15.1

- Fix folder creation

## 19.15.0

- Add input styles
- Extract css

## 19.14.0

- Clear pending tasks from queue function #12 (thanks to @shumadrid)

## 19.13.0

- Switch to `build:compile:typescript`
- Allow custom commands
- Refactor to `npmRun`

## 19.12.0

- Use invoke model

## 19.11.0

- Hack for sassPlugin
- Allow override
- Fix docs
- Add support for any eslint.config file
- Switch to mts as default
- Refactor eslint.config.mjs

## 19.10.0

- Fix d.cts path
- Add exports
- Add AppContext

## 19.9.0

- Lint tsx

## 19.8.2

- Minor changes

## 19.8.1

- Pass original reference

## 19.8.0

- Complete canvas link text editing

## 19.7.1-beta.6

- Apply multiple links

## 19.7.1-beta.5

- Use proper index

## 19.7.1-beta.4

- Add missing properties

## 19.7.1-beta.3

- Refactor Canvas links

## 19.7.1-beta.2

- Extract canvas key parsing
- Fix sourcemaps regex

## 19.7.1-beta.1

- Handle canvas text changes

## 19.7.0

- fixFrontmatterMarkdownLinks

## 19.6.0

- Don't fail on invalid json

## 19.5.0

- parseMetadata

## 19.4.0

- Ensure isExternal is always set

## 19.3.0

- Remove deprecated rules
- Keep wikilinks explicit alias

## 19.2.2

- Fix audit

## 19.2.1

- Fix eslint.config path

## 19.2.0

- Fix node10 attw
- Simplify replacement
- Replace import/export, don't modify type
- Change extension to fix imports

## 19.1.2-beta.5

- Fix cli
- Fix multiline case
- Extract unused types
- Group by eslint plugins

## 19.1.2-beta.4

- Fix extra space
- Switch to import type

## 19.1.2-beta.3

- Fix types generator

## 19.1.2-beta.2

- Fix Library paths

## 19.1.2-beta.1

- Separate esm/cjs folders

## 19.1.1

- Don't use cached settings

## 19.1.0

- Minor changes

## 19.0.1

- Avoid duplication
- Use fixed typings

## 19.0.0

- Make compatible with [Are the types wrong?](https://arethetypeswrong.github.io/)

## 18.4.2

- Fix setDisabled

## 18.4.1

- Fix event listener

## 18.4.0

- Add MultipleTextComponent

## 18.3.0

- Add validation

## 18.2.1

- Fix style

## 18.2.0

- Fix style
- Refactor to async Prompt

## 18.1.0

- Refactor modals

## 18.0.5

- Extract constants

## 18.0.4

- Fix ignores
- Ignore js

## 18.0.3

- Init separately

## 18.0.2

- Refactor BrowserProcess
- Refactor require usages

## 18.0.1

- Ensure build:static executed before version
- Fix package dir path

## 18.0.0

- Add static eslint config
- Fix eslint warning
- Use 1-based month

## 17.10.2-beta.10

- Try other style

## 17.10.2-beta.9

- Better css

## 17.10.2-beta.8

- Fix selected style

## 17.10.2-beta.7

- Release styles.css if exists
- Revert "Use the same format for releases"

## 17.10.2-beta.6

- Fix cast
- Don't generate export for styles folder
- Fix sass arg
- Generate index.ts only if there are other .ts
- Use the same format for releases
- Switch to compile sass
- Improve style

## 17.10.2-beta.5

- Fix nested style

## 17.10.2-beta.4

- Fix styles.css and clean it

## 17.10.2-beta.3

- Replace libraries in mjs

## 17.10.2-beta.2

- Allow override getTransformer
- Add DurationTransformer
- Fix localRequire
- Add trailing semicolon

## 17.10.2-beta.1

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

- Simplify styles

## 17.10.0

- Switch to moment.Duration
- Add comments
- Add all files

## 17.9.1

- Fix beta check

## 17.9.0

- Add plugin beta releases for BRAT
- Add components
- Don't increase patch after beta
- Fix `any`
- Add `SettingEx`
- Switch to plural `Modals`
- Use builtin validation

## 17.8.0

- Add enum helpers

## 17.7.0

- Lint
- Ensure proper debugger in CLI

## 17.6.0

- Typed deleteProperty/deleteProperties

## 17.5.0

- Ensure not-empty pluginId

## 17.4.0

- Add svelte-wrapper

## 17.3.0

- Add CodeMirror's StateFieldSpec

## 17.2.2

- Disable no-invalid-this as it will always fail for prototype methods

## 17.2.1

- Disable class-methods-use-this as it will always fail for settings classes

## 17.2.0

- More lint rules

## 17.1.1

- Extend source maps regex

## 17.1.0

- Fix source maps for css

## 17.0.2

- Fix sassPlugin cjs/esm binding

## 17.0.1

- Allow css imports

## 17.0.0

- Remove allowJs setting
- Add support for sass
- Add svelte compile
- Ensure onLayoutReady is called after onload completed

## 16.6.4

- Init require for each plugin separately
- Use local require

## 16.6.3

- Init name first

## 16.6.2

- Ensure __extractDefault

## 16.6.1

- Revert to globalThis

## 16.6.0

- Refactor init

## 16.5.0

- Mock process

## 16.4.4

- Disable line break before =

## 16.4.3

- functionExpression.spaceAfterFunctionKeyword

## 16.4.2

- Space after new

## 16.4.1

- Fix dir path
- resolvePathFromRootSafe

## 16.4.0

- Add `eqeqeq` rule
- Add `format:check` command
- Add `format` script
- Add `fullRender`

## 16.3.0

- Generate exports for moduleResolution=node

## 16.2.0

- printToPdf

## 16.1.0

- Use shared debugLib

## 16.0.3

- Make _shouldSaveAfterLoad protected

## 16.0.2

- Fix Settings generics

## 16.0.1

- Fix generics

## 16.0.0

- Refactor settings

## 15.0.0

- Watch css changes
- Refactor bind

## 14.4.0

- Update NpmShrinkwrapJson

## 14.3.0

- Add error tooltip

## 14.2.0

- Validate on bind

## 14.1.0

- Add shouldShowValidationMessage

## 14.0.0

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

- Allow underscored unused-vars
- Add onExternalSettingsChange

## 13.14.1

- Fix package warning

## 13.14.0

- Ensure all env variables passed

## 13.13.1

- Missing release

## 13.13.0

- Add support for CLI
- Fix formatting

## 13.12.1

- Fix formatting

## 13.12.0

- Improve init message
- Fix broken call

## 13.11.0

- Improve stack trace printer

## 13.10.1

- Don't show `consoleDebug()` in call stack

## 13.10.0

- Refactor and document debugging

## 13.9.0

- Make printError working in node.js

## 13.8.0

- Add shouldHandleErrors
- Pass optional console

## 13.7.3

- Search key only letters

## 13.7.2

- Fix index formatting

## 13.7.1

- Fix pretty format

## 13.7.0

- Edit CHANGELOG.md in editor
- Calculate maxDepth properly

## 13.6.1

- Check shouldHandleCircularReferences
- Check shouldCatchToJSONErrors

## 13.6.0

- Add void replacer
- Refactor toJson

## 13.5.0

- Add shouldCatchToJSONErrors
- Make toJson valid JavaScript object

## 13.4.0

- Add key sorting

## 13.3.2

- Skip empty messages

## 13.3.1

- Include full body
- Add missing NUL separator flag
- Fix non-global regexps

## 13.3.0

- Support multi-line log commits

## 13.2.1

- Special handle when replacer is the string. Didn't work correctly for string with $1 $2 etc

## 13.2.0

- Update targets

## 13.1.0

- Refactor replaceAll/replaceAllSync
- Use stricter typescript

## 13.0.0

- Refactor toJson

## 12.2.1

- Update tsdoc

## 12.2.0

- Refactor DEBUG

## 12.1.0

- Don't fail when no root dir
- Set process.browser
- Switch to debug lib

## 12.0.0

- Refactor appendCodeBlock to DocumentFragment or HTMLElement

## 11.5.0

- Fix double require transform

## 11.4.0

- Don't put helper functions to top-level as applying to itself produces invalid code
- Minify prod builds

## 11.3.0

- Change check for __filename

## 11.2.0

- Add deleteProperty/ies

## 11.1.0

- Preserve link alias case
- Create FUNDING.yml
- Update README examples

## 11.0.0

- Remove shouldUpdateLinks

## 10.0.0

- Add shouldHandleRenames/Deletions

## 9.0.2

- Handle empty files properly

## 9.0.1

- cspell

## 9.0.0

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

- Don't update changelog for beta builds
- Add support to ignore path
- Refactor PluginSettings
- isValidRegExp

## 7.0.0

- Improve FS performance

## 6.2.1

- Republish

## 6.2.0

- Add sync versions

## 6.1.0

- Add more node types
- Allow call Root methods if no roots
- Use full definition for PackageJson

## 6.0.0

- Add abortSignal
- Fix for link converters
- Rename many properties (BREAKING CHANGE)

## 5.3.1

- Properly resolve path on rename

## 5.3.0

- Make abortSignal public

## 5.2.0

- Switch to emitAsyncErrorEvent

## 5.1.0

- Add Loop

## 5.0.1

- Add support for parsing `[](url)`

## 5.0.0

- Don't retry on error by default

## 4.21.0

- Use Frontmatter casing

## 4.20.0

- Support string urls
- Don't allow whitespace in url

## 4.19.0

- Don't fail if couldn't decode URL
- Support canvas changes
- Update canvas files only if Canvas Plugin enabled

## 4.18.1

- Handle wikilinks with spaces

## 4.18.0

- Extract url

## 4.17.0

- Fix esm defaults

## 4.16.0

- Add parseLink
- Distinguish file path and file:// urls

## 4.15.0

- Add support for indirect paths such as `a/b/../c`

## 4.14.0

- Load cache from newPath

## 4.13.3

- Repeat

## 4.13.2

- Move patching require to preprocess

## 4.13.1

- Add support for missing modules such as electron

## 4.13.0

- Fix logging

## 4.12.0

- Don't allow default exports

## 4.11.0

- Lint
- Refactor to Queue
- Log timeout

## 4.10.0

- ChainedPromise
- editBacklinks

## 4.9.0

- Add replaceCodeBlock
- Refactor getCodeBlockArguments

## 4.8.2

- Disable import rules

## 4.8.1

- Lint

## 4.8.0

- Configure retry on error

## 4.7.0

- Add getFullContentHtml

## 4.6.0

- Add more sorting
- Add markdownToHtml
- Add missing docs

## 4.5.0

- Add insertAt

## 4.4.0

- Validate initial value

## 4.3.1

- Fix assignWithNonEnumerableProperties

## 4.3.0

- Simplify generics

## 4.2.0

- Refactor

## 4.1.0

- Add onChanged callback

## 4.0.0

- Don't lose validation on blur

## 3.44.0

- Delete only if has own attachment folder

## 3.43.2

- Fix backlinks API

## 3.43.1

- Save only non-deferred views

## 3.43.0

- Extract Exec
- Don't fail on error in retryWithTimeout

## 3.42.4

- Remove code after source maps

## 3.42.3

- Avoid line break

## 3.42.2

- Refactor newContent

## 3.42.1

- Handle rename only for files

## 3.42.0

- Extract link helpers

## 3.41.0

- Handle broken canvas

## 3.40.0

- Add fix for unhandled `sourcemaps`
- Add support for `FrontmatterLinkCache`

## 3.39.0

- Avoid unnecessary renames
- Don't store metadata if not set `shouldDeleteOrphanAttachments`

## 3.38.0

- Refactor

## 3.37.0

- Replace Promise with MaybePromise

## 3.36.4

- Improve check for CJS

## 3.36.3

- Check for replacement, not its variable

## 3.36.2

- Avoid useless replacements

## 3.36.1

- Prevent replacement

## 3.36.0

- Make `import.meta.url` more universal

## 3.35.0

- Remove unnecessary logging
- Ensure timestamps are up to date

## 3.34.0

- Ensure MetadataCache update triggered

## 3.33.0

- Refactor yaml parsing

## 3.32.0

- `getNoteFilesSorted`
- Refactor `instanceof` calls

## 3.31.0

- Use safe overload of `getBacklinksForFile`
- Refactor `chain` to support sync
- Refactor `RenameHandler`
- Escape markdown alias symbols
- Handle `renameSafe` with change case

## 3.30.0

- Increase patch version if `beta` is 0
- Avoid wrong initialization
- Refactor `shouldResetAlias`
- Refactor to `getFile`/`getFolder`

## 3.29.2

- Create dir recursively

## 3.29.1

- Ensure `obsidianConfigDir` POSIX path

## 3.29.0

- Ensure file's folder created
- Add `getOrCreateFile`/`getOrCreateFolder`

## 3.28.2

- Refactor

## 3.28.1

- Avoid extra dot

## 3.28.0

- Refactor all filesystem methods
- Add copySafe

## 3.27.0

- Implement `renameSafe`

## 3.26.1

- Cache only markdown

## 3.26.0

- Delete attachments after deleting note

## 3.25.1

- Init fake missing attachments folder

## 3.25.0

- Download hot-reload
- Don't accept empty folder

## 3.24.1

- Ensure `OBSIDIAN_CONFIG` from `.env` has higher precedence

## 3.24.0

- Add `dotenv`
- Refactor and add more logging
- Simplify `convertSyncToAsync`

## 3.23.0

- Add `omitReturnType`

## 3.22.0

- Refactor `RenameDeleteHandler`
- Add `chainAsyncFn`

## 3.21.0

- Add `includeAttachmentExtensionToEmbedAlias`

## 3.20.0

- Add `shouldUpdateFilenameAlias`

## 3.19.0

- Refactor Link functions

## 3.18.0

- Ensure `RenameDeleteHandler` is executed only once

## 3.17.0

- allowEmptyEmbedAlias
- allowNonExistingFile
- Infer settings from the originalLink

## 3.16.0

- Rename and refactor `listSafe`
- Check for empty folder including hidden items

## 3.15.0

- Prefer to use vault functions over adapter's
- Improve check for Windows POSIX-like paths

## 3.14.1

- Refactor

## 3.14.0

- Rename 'remove' to 'delete'
- Add check for shouldDeleteOrphanAttachments

## 3.13.0

- Remove to trash

## 3.12.0

- Add build:validate command
- Ensure code compiles before running esbuild
- Don't lint during esbuild
- Make updateLink to preserve angle brackets and leading dot

## 3.11.8

- Switch to cspell binary as the library is not cjs

## 3.11.7

- Reimplement pkg-dir as it is not cjs module

## 3.11.6

- Replace builtin-modules with node.js version

## 3.11.5

- Switch to function approach
- Preserve __require() name to keep esbuild transforms

## 3.11.4

- Use `__require()` only for node modules

## 3.11.3

- Use proper `require()` function

## 3.11.2

- Handle default requires

## 3.11.1

- Handle different quotes
- Fix replacing extension

## 3.11.0

- Remove bundling dependencies

## 3.10.1

- Move typescript-eslint dependency

## 3.10.0

- Add quotes rule
- Extract registerRenameDeleteHandlers
- Improve console logging details

## 3.9.0

- Extract RenameDeleteHandler

## 3.8.0

- Implement getAvailablePathForAttachments without patching mkdir

## 3.7.1

- Ensure folders are created

## 3.7.0

- Handle defaultOptionsFn

## 3.6.0

- Force tags
- Allow empty commit
- Add placeholder to prompt

## 3.5.0

- Don't change aliases for markdown links
- Make generateMarkdownLink work for deleted TFile

## 3.4.1

- Use cancelButtonText

## 3.4.0

- Refactor all modals

## 3.3.0

- Add Confirm modal

## 3.2.0

- Reload plugin settings before updating

## 3.1.0

- Proper check to handle mobile

## 3.0.4

- Proper exclude files prop

## 3.0.3

- Don't fail on failed linting
- Skip linting if no files
- Lint only explicit patterns

## 3.0.2

- Update package-lock
- Fix localforage dep

## 3.0.1

- Fix cli path

## 3.0.0

- Refactor ESLint rules
- Avoid using node: modules

## 2.27.0

- ensureMetadataCacheReady in getBacklinksForFileSafe

## 2.26.3

- Fix return type for isNote

## 2.26.2

- Handle removed parent folder case

## 2.26.1

- Prevent double patching

## 2.26.0

- Handle fake attachment folder

## 2.25.2

- Register file in uniqueFileLookup

## 2.25.1

- Clarify forceRelativePath

## 2.25.0

- Export all internal types

## 2.24.0

- Extend generateMarkdownLink

## 2.23.3

- Fix options merging

## 2.23.2

- Disable removeFolderSafe notice by default

## 2.23.1

- Fix removeEmptyFolderHierarchy

## 2.23.0

- registerFileInVault

## 2.22.1

- Add missing init

## 2.22.0

- Create temp file and folders

## 2.21.2

- Make createFolderSafe boolean

## 2.21.1

- Fix parameter type

## 2.21.0

- Handle default setting

## 2.20.0

- Pass plugin instead of tab

## 2.19.0

- Refactor UIComponent

## 2.18.0

- Export getAlias

## 2.17.1

- Make dependency for build purpose

## 2.17.0

- Update tsdocs
- Allow custom configs to Linter

## 2.16.0

- Add FrontMatter types

## 2.15.0

- getFrontMatterSafe
- Allow unchanged links

## 2.14.0

- editLinks

## 2.13.0

- Refactor Vault
- Refactor FrontMatter

## 2.12.0

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

- If .d.ts required, skip it

## 2.7.0

- Ensure copyToObsidianPluginFolder is the last step
- insertCodeBlock

## 2.6.1

- Add missing package

## 2.6.0

- Dataview - update deps

## 2.5.0

- Add getApp

## 2.4.0

- Move Dataview generics to methods

## 2.3.0

- Add proper dependency to fix import resolution

## 2.2.0

- Force brackets in lambdas
- Add DocumentFragment
- Allow passing custom pluginSettings

## 2.1.0

- Pass customEsbuildPlugins to ObsidianPlugin

## 2.0.0

- Proper update in `package-lock.json`
- Inline `obsidian-dataview` types

## 1.8.0

- Don't skip ESM modules from bundling
- Report spellcheck error without stack

## 1.7.7

- Replace .ts to .cjs
- Remove generation dependencies
- Switch all to dependencies

## 1.7.6

- Mark esbuild/eslint as externals

## 1.7.5

- Don't use getDependenciesToSkip in plugin build
- Remove old path dep

## 1.7.4

- Don't exit on `npm run dev`

## 1.7.3

- Switch to var as it what esbuild converts const to

## 1.7.2

- Avoid second definition of the const
- Allow MaybePromise for overrides
- Move typings to deps

## 1.7.1

- Make proper `bindValueComponent` overloads

## 1.7.0

- Allow convert plugin setting values

## 1.6.0

- Serialize JSON with functions
- Add more String functions
- Rename invokeEsbuild
- Switch to path-browserify
- Improve tsdoc

## 1.5.1

- Auto commit package-lock.json

## 1.5.0

- Add tsdoc
- Edit package-lock.json
- Fix lint for missing folder

## 1.4.0

- Switch to lint:fix

## 1.3.2

- Stop build if exports changed

## 1.3.1

- Spellcheck

## 1.3.0

- Fix Dataview typings

## 1.2.0

- Lint only src and scripts
- Add build:clean, build:static commands

## 1.1.1

- copyUpdatedManifest only for plugin

## 1.1.0

- Simplify generics
- Make version scripts for plugin and not

## 1.0.2

- Fix eslint/cspell commands
- Make release files same as npm
- Exclude dist.zip from npm

## 1.0.1

- Add PluginBase
- Fixes

## 1.0.0

- Initial version
