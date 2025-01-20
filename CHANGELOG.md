# CHANGELOG

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

- Update libs
- Don't show `consoleDebug()` in call stack

## 13.10.0

- Refactor and document debugging

## 13.9.0

- Update libs
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

- Update libs
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

- Update libs
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

- Update libs
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

- Update libs
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

- Update libs
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

- Update libs
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
- Update libs
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
- Update libs

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
