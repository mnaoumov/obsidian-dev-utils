/**
 * @packageDocumentation
 *
 * This file defines the English translations for the `i18n` module.
 */

/**
 * The English translations.
 */
export const en = {
  notices: {
    attachmentIsStillUsed: 'Attachment {{attachmentPath}} is still used by other notes. It will not be deleted.',
    unhandledError: 'An unhandled error occurred. Please check the console for more information.'
  },
  buttons: {
    cancel: 'Cancel',
    ok: 'OK'
  },
  dataview: {
    itemsPerPage: 'Items per page:',
    jumpToPage: 'Jump to page:'
  }
} as const;
