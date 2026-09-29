import type React from 'react'
import { useAppStore } from '@/store'
import type { SavedViewDialogKind } from '@/store/slices/ui/ui-slice-contract-saved-views'
import {
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { SavedViewColorDot } from './SavedViewColorControls'
import { findMenuRootTrigger } from './saved-view-focus-return'
import { savedViewShortcutLabel } from './saved-view-shortcut-labels'
import { getShortcutPlatform } from '@/hooks/useShortcutLabel'
import { useActiveSidebarView } from './SidebarSavedViewChip'

/** The switcher list plus Save / Manage; rendered inside any menu content (options submenu, header chip). */
export function SidebarSavedViewsMenuItems(): React.JSX.Element {
  const views = useAppStore((s) => s.sidebarSavedViews)
  const activeId = useAppStore((s) => s.activeSidebarViewId)
  const applySidebarView = useAppStore((s) => s.applySidebarView)
  const openSavedViewDialog = useAppStore((s) => s.openSavedViewDialog)
  const keybindings = useAppStore((s) => s.keybindings)
  const platform = getShortcutPlatform()

  const openDialog = (kind: SavedViewDialogKind) => (event: Event) => {
    // Why: the item unmounts with the menu; focus goes back to the menu's own trigger.
    openSavedViewDialog(
      kind,
      event.currentTarget instanceof Element ? findMenuRootTrigger(event.currentTarget) : null
    )
  }

  return (
    <>
      {views.length === 0 ? (
        <p className="max-w-52 px-2 py-1.5 text-xs text-muted-foreground">
          {translate(
            'sidebar.savedViews.emptyHint',
            'Save this filter, grouping and sort to switch back in one step.'
          )}
        </p>
      ) : (
        <div className="scrollbar-sleek max-h-72 overflow-y-auto">
          {views.map((view, index) => {
            const shortcut = savedViewShortcutLabel(index, keybindings, platform)
            return (
              <Tooltip key={view.id}>
                <TooltipTrigger asChild>
                  <DropdownMenuCheckboxItem
                    checked={view.id === activeId}
                    onSelect={() => applySidebarView(view.id)}
                  >
                    <SavedViewColorDot color={view.color} />
                    <span className="min-w-0 flex-1 truncate">{view.name}</span>
                    {shortcut ? <DropdownMenuShortcut>{shortcut}</DropdownMenuShortcut> : null}
                  </DropdownMenuCheckboxItem>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={6}>
                  {view.name}
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      )}
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={openDialog('save')}>
        {translate('sidebar.savedViews.saveCurrent', 'Save current view…')}
      </DropdownMenuItem>
      {views.length > 0 ? (
        <DropdownMenuItem onSelect={openDialog('manage')}>
          {translate('sidebar.savedViews.manage', 'Manage views…')}
        </DropdownMenuItem>
      ) : null}
    </>
  )
}

/** "Saved view" row for the Workspace options menu, in the same shell as Sort by. */
export function SidebarSavedViewsMenuRow({
  preserveWorkspaceBoardOpen = false
}: {
  preserveWorkspaceBoardOpen?: boolean
}): React.JSX.Element {
  const activeName = useActiveSidebarView()?.name

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
          <span>{translate('sidebar.savedViews.menuLabel', 'Saved view')}</span>
          <span className="min-w-0 truncate text-[11px] font-medium text-muted-foreground">
            {activeName ?? translate('sidebar.savedViews.none', 'None')}
          </span>
        </span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent
        className="w-56"
        data-workspace-board-preserve-open={preserveWorkspaceBoardOpen ? '' : undefined}
      >
        <SidebarSavedViewsMenuItems />
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}
