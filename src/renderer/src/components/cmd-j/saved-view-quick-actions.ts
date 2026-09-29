import { Bookmark, BookmarkPlus, Settings2 } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import type { SidebarSavedView } from '../../../../shared/sidebar-saved-views'
import type { SavedViewDialogKind } from '@/store/slices/ui/ui-slice-contract-saved-views'
import type { CmdJQuickAction } from './quick-actions'

const ALWAYS_AVAILABLE = { available: true } as const

export function buildSavedViewQuickActions(args: {
  views: readonly SidebarSavedView[]
  activeId: string | null
  shortcutLabel: (index: number) => string | null
  applyView: (id: string) => void
  openDialog: (kind: SavedViewDialogKind) => void
}): CmdJQuickAction[] {
  const { views, activeId, shortcutLabel, applyView, openDialog } = args
  const viewKeyword = translate('sidebar.savedViews.paletteKeyword', 'view')
  const viewActions = views.map((view, index): CmdJQuickAction => {
    const chord = shortcutLabel(index)
    const status =
      view.id === activeId
        ? translate('sidebar.savedViews.paletteCurrent', 'Current')
        : translate('sidebar.savedViews.paletteDescription', 'Saved sidebar view')
    return {
      id: `sidebar-view:${view.id}`,
      kind: 'action',
      title: translate('sidebar.savedViews.paletteTitle', 'View: {{name}}', { name: view.name }),
      description: chord ? `${status} · ${chord}` : status,
      icon: Bookmark,
      verbKeywords: [viewKeyword, view.name],
      isAvailable: () => ALWAYS_AVAILABLE,
      run: async () => {
        applyView(view.id)
        return { status: 'ok' }
      }
    }
  })
  return [
    ...viewActions,
    {
      id: 'sidebar-view-save',
      kind: 'action',
      title: translate('sidebar.savedViews.saveCurrent', 'Save current view…'),
      description: translate(
        'sidebar.savedViews.saveDescription',
        "Saves the sidebar's projects, grouping, sort and filters."
      ),
      icon: BookmarkPlus,
      verbKeywords: [viewKeyword, translate('sidebar.savedViews.paletteSaveKeyword', 'save')],
      isAvailable: () => ALWAYS_AVAILABLE,
      run: async () => {
        openDialog('save')
        return { status: 'ok' }
      }
    },
    {
      id: 'sidebar-view-manage',
      kind: 'action',
      title: translate('sidebar.savedViews.paletteManage', 'Manage saved views…'),
      description: translate(
        'sidebar.savedViews.paletteManageDescription',
        'Rename, recolor or delete saved views'
      ),
      icon: Settings2,
      verbKeywords: [viewKeyword, translate('sidebar.savedViews.paletteManageKeyword', 'manage')],
      isAvailable: () => ALWAYS_AVAILABLE,
      run: async () => {
        openDialog('manage')
        return { status: 'ok' }
      }
    }
  ]
}
