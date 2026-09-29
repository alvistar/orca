import React, { useState } from 'react'
import { X } from 'lucide-react'
import { useAppStore } from '@/store'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { SidebarSavedView } from '../../../../shared/sidebar-saved-views'
import { SavedViewColorDot } from './SavedViewColorControls'
import { SidebarSavedViewsMenuItems } from './SidebarSavedViewsMenu'

// Why transitions only toward the no-view state: a clear fades over 150ms, an apply swaps instantly.
const FADE =
  'motion-safe:transition-[opacity,visibility] motion-safe:duration-150 motion-safe:ease-out'
const CHIP_SHOWN = 'visible opacity-100'
const CHIP_FADED = `invisible opacity-0 ${FADE}`
const TITLE_HIDDEN = 'invisible opacity-0'
const TITLE_SHOWN = `visible opacity-100 ${FADE}`

export function useActiveSidebarView(): SidebarSavedView | null {
  return useAppStore(
    (s) => s.sidebarSavedViews.find((view) => view.id === s.activeSidebarViewId) ?? null
  )
}

function SavedViewChip({ view }: { view: SidebarSavedView }): React.JSX.Element {
  const clearActiveSidebarView = useAppStore((s) => s.clearActiveSidebarView)

  return (
    <span className="flex h-[22px] max-w-[146px] min-w-0 items-center rounded-full bg-muted pr-0.5 text-xs font-medium text-foreground">
      <DropdownMenu modal={false}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-full min-w-0 items-center gap-1.5 rounded-full pl-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                aria-label={translate(
                  'sidebar.savedViews.chipLabel',
                  'Saved view: {{name}}. Switch view',
                  {
                    name: view.name
                  }
                )}
              >
                {view.color ? <SavedViewColorDot color={view.color} /> : null}
                <span className="min-w-0 truncate">{view.name}</span>
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            {view.name}
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="start" className="w-56">
          <SidebarSavedViewsMenuItems />
        </DropdownMenuContent>
      </DropdownMenu>
      <button
        type="button"
        className="ml-0.5 flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        aria-label={translate('sidebar.savedViews.clear', 'Clear saved view')}
        onClick={clearActiveSidebarView}
      >
        <X className="size-3" />
      </button>
    </span>
  )
}

/**
 * The sidebar header title slot: while a saved view is active its chip replaces the title.
 * Hidden in the Activity body, which the chip does not describe.
 */
export function SidebarSavedViewTitleSlot({
  agentsViewActive,
  children
}: {
  agentsViewActive: boolean
  children: React.ReactNode
}): React.JSX.Element {
  const activeView = useActiveSidebarView()
  const activeId = activeView?.id ?? null
  // Why: the chip keeps the last view's content while it fades out after a clear.
  const [lastView, setLastView] = useState(activeView)
  const [previousActiveId, setPreviousActiveId] = useState(activeId)
  const [announcement, setAnnouncement] = useState('')
  if (activeId !== previousActiveId) {
    setPreviousActiveId(activeId)
    setAnnouncement(
      activeView
        ? translate('sidebar.savedViews.appliedAnnouncement', 'Saved view {{name}} applied', {
            name: activeView.name
          })
        : translate('sidebar.savedViews.clearedAnnouncement', 'Saved view cleared')
    )
  }
  if (activeView && activeView !== lastView) {
    setLastView(activeView)
  }
  const chipView = activeView ?? lastView
  const showChip = activeView !== null && !agentsViewActive

  return (
    <div className="grid min-w-0 items-center">
      <div className={cn('col-start-1 row-start-1 min-w-0', showChip ? TITLE_HIDDEN : TITLE_SHOWN)}>
        {children}
      </div>
      {chipView && !agentsViewActive ? (
        <div
          className={cn('col-start-1 row-start-1 min-w-0 pl-1', showChip ? CHIP_SHOWN : CHIP_FADED)}
        >
          <SavedViewChip view={chipView} />
        </div>
      ) : null}
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
    </div>
  )
}
