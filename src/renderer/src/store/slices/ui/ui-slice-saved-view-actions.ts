import type { UISlice } from './ui-slice-contract'

export function createUiSavedViewActions(): Partial<UISlice> {
  return {
    sidebarSavedViews: [],
    activeSidebarViewId: null
  }
}
