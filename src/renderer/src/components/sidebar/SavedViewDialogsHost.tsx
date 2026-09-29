import type React from 'react'
import { useAppStore } from '@/store'
import { ManageSidebarViewsDialog } from './ManageSidebarViewsDialog'
import { SaveSidebarViewDialog } from './SaveSidebarViewDialog'

/** Single owner of the saved-view dialogs, so the menu, header chip and Cmd+J can all open them. */
export function SavedViewDialogsHost(): React.JSX.Element | null {
  const dialog = useAppStore((s) => s.savedViewDialog)
  const closeSavedViewDialog = useAppStore((s) => s.closeSavedViewDialog)
  if (!dialog) {
    return null
  }
  return dialog.kind === 'save' ? (
    <SaveSidebarViewDialog returnFocusTo={dialog.returnFocusTo} onClose={closeSavedViewDialog} />
  ) : (
    <ManageSidebarViewsDialog returnFocusTo={dialog.returnFocusTo} onClose={closeSavedViewDialog} />
  )
}
