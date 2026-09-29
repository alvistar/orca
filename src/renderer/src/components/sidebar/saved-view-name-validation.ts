import {
  findSidebarViewNameConflict,
  normalizeSidebarViewName,
  type SidebarSavedView
} from '../../../../shared/sidebar-saved-views'
import { translate } from '@/i18n/i18n'
import type { SidebarViewNameError } from '@/store/slices/ui/ui-slice-contract-saved-views'

export function savedViewNameErrorMessage(error: SidebarViewNameError): string {
  switch (error.kind) {
    case 'empty':
      return translate('sidebar.savedViews.nameRequired', 'Name is required.')
    case 'duplicate':
      return translate('sidebar.savedViews.nameTaken', 'A view named "{{name}}" already exists.', {
        name: error.existingName
      })
    case 'limit':
      return translate('sidebar.savedViews.limitReached', 'You have reached the saved view limit.')
  }
}

/** Live validation while typing, matching what the store would reject on submit. */
export function validateSavedViewName(
  views: readonly SidebarSavedView[],
  rawName: string,
  ignoreId?: string
): SidebarViewNameError | null {
  const name = normalizeSidebarViewName(rawName)
  if (!name) {
    return { kind: 'empty' }
  }
  const conflict = findSidebarViewNameConflict(views, name, ignoreId)
  return conflict ? { kind: 'duplicate', existingName: conflict.name } : null
}
