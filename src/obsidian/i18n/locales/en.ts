/**
 * @packageDocumentation
 *
 * This file defines the English translations for the `i18n` module.
 */

/**
 * The English translations.
 */
export const en = {
  obsidianDevUtils: {
    asyncWithNotice: {
      milliseconds: 'milliseconds...',
      operation: 'Operation',
      runningFor: 'Running for',
      terminateOperation: 'You can terminate the operation by clicking the button below, but be aware it might leave the vault in an inconsistent state.',
      timedOut: 'The operation timed out after {{duration}} milliseconds.'
    },
    buttons: {
      cancel: 'Cancel',
      ok: 'OK'
    },
    callout: {
      loadContent: 'Load content for callout'
    },
    dataview: {
      itemsPerPage: 'Items per page:',
      jumpToPage: 'Jump to page:',
      pageHeader: 'Page {{pageNumber}} of {{totalPages}}, Total items: {{totalItems}}'
    },
    metadataCache: {
      getBacklinksForFilePath: 'Get backlinks for {{filePath}}'
    },
    notices: {
      attachmentIsStillUsed: 'Attachment {{attachmentPath}} is still used by other notes. It will not be deleted.',
      unhandledError: 'An unhandled error occurred. Please check the console for more information.'
    },
    queue: {
      flushQueue: 'Flush queue'
    },
    renameDeleteHandler: {
      handleDelete: 'Handle delete: {{filePath}}',
      handleOrphanedRenames: 'Handle orphaned renames',
      handleRename: 'Handle rename: {{oldPath}} -> {{newPath}}',
      updatedLinks: 'Updated {{linksCount}} links in {{filesCount}} files.'
    },
    vault: {
      processFile: 'Process file {{filePath}}'
    }
  }
} as const;
