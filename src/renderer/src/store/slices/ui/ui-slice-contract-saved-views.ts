import type { SidebarSavedView } from '../../../../../shared/sidebar-saved-views'

export type SidebarViewNameError =
  | { kind: 'empty' }
  | { kind: 'duplicate'; existingName: string }
  | { kind: 'limit' }

export type SidebarViewNameResult =
  | { ok: true; id: string }
  | { ok: false; error: SidebarViewNameError }

/** Everything needed to undo a delete: where the view sat and whether the sidebar still matched it. */
export type SidebarViewDeletion = {
  view: SidebarSavedView
  index: number
  wasActive: boolean
  liveSettingsKey: string
}

export type SavedViewDialogKind = 'save' | 'manage'

export type SavedViewDialogState = {
  kind: SavedViewDialogKind
  /** Where focus returns on close; null lets the dialog pick its default. */
  returnFocusTo: HTMLElement | null
}

export type UISliceSavedViews = {
  sidebarSavedViews: SidebarSavedView[]
  activeSidebarViewId: string | null
  saveSidebarView: (input: { name: string; color?: string | null }) => SidebarViewNameResult
  applySidebarView: (id: string) => void
  /** Applies the view at a 0-based position; a position past the end is a no-op. */
  applySidebarViewAtIndex: (index: number) => void
  renameSidebarView: (id: string, name: string) => SidebarViewNameResult
  setSidebarViewColor: (id: string, color: string | null) => void
  deleteSidebarView: (id: string) => SidebarViewDeletion | null
  restoreSidebarView: (deletion: SidebarViewDeletion) => void
  /** Drops the active marker and keeps the current sidebar settings. */
  clearActiveSidebarView: () => void
  savedViewDialog: SavedViewDialogState | null
  openSavedViewDialog: (kind: SavedViewDialogKind, returnFocusTo?: HTMLElement | null) => void
  closeSavedViewDialog: () => void
}
