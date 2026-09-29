import React, { useLayoutEffect, useRef, useState } from 'react'
import { ChevronDown, X } from 'lucide-react'
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
import { focusSavedViewSwitcher, isHiddenFocusTarget } from './saved-view-focus-return'

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

function SavedViewChip({
  view,
  shown
}: {
  view: SidebarSavedView
  shown: boolean
}): React.JSX.Element {
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
                data-saved-view-switcher={shown ? '' : undefined}
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
/** With views saved and none active, the title opens the switcher from the pill's slot. */
function SavedViewTitleTrigger({
  title,
  shown,
  children
}: {
  title: string
  shown: boolean
  children: React.ReactNode
}): React.JSX.Element {
  const triggerRef = useRef<HTMLButtonElement>(null)

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          className="flex min-w-0 items-center rounded-md outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
          data-saved-view-switcher={shown ? '' : undefined}
          aria-label={translate(
            'sidebar.savedViews.titleTriggerLabel',
            '{{title}}, switch saved view',
            { title }
          )}
        >
          {children}
          <ChevronDown className="mr-1 size-3 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-56"
        onCloseAutoFocus={(event) => {
          // Why: only an apply hides the title; other closes keep Radix's default focus.
          if (isHiddenFocusTarget(triggerRef.current)) {
            event.preventDefault()
            requestAnimationFrame(() => focusSavedViewSwitcher())
          }
        }}
      >
        <SidebarSavedViewsMenuItems />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function SidebarSavedViewTitleSlot({
  agentsViewActive,
  title,
  children
}: {
  agentsViewActive: boolean
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  const hasViews = useAppStore((s) => s.sidebarSavedViews.length > 0)
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
  const slotRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    // Why layout: runs before the browser drops focus out of the newly inert layer, so a switch
    // that hid the focused switcher (e.g. a shortcut) can still be detected and handed over.
    const focused = document.activeElement
    if (focused && slotRef.current?.contains(focused) && isHiddenFocusTarget(focused)) {
      requestAnimationFrame(() => focusSavedViewSwitcher({ force: true }))
    }
  }, [showChip])

  return (
    <div ref={slotRef} className="grid min-w-0 items-center">
      {/* Why inert on the hidden layer: fading layers stay mounted and must not take focus. */}
      <div
        className={cn('col-start-1 row-start-1 min-w-0', showChip ? TITLE_HIDDEN : TITLE_SHOWN)}
        inert={showChip}
      >
        {hasViews && !agentsViewActive ? (
          <SavedViewTitleTrigger title={title} shown={!showChip}>
            {children}
          </SavedViewTitleTrigger>
        ) : (
          children
        )}
      </div>
      {chipView && !agentsViewActive ? (
        <div
          className={cn('col-start-1 row-start-1 min-w-0 pl-1', showChip ? CHIP_SHOWN : CHIP_FADED)}
          inert={!showChip}
        >
          <SavedViewChip view={chipView} shown={showChip} />
        </div>
      ) : null}
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
    </div>
  )
}
