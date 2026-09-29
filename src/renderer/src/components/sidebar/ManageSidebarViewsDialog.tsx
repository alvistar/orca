import React, { useId, useRef, useState } from 'react'
import { Palette, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import {
  SIDEBAR_VIEW_SHORTCUT_COUNT,
  type SidebarSavedView
} from '../../../../shared/sidebar-saved-views'
import type { SidebarViewNameError } from '@/store/slices/ui/ui-slice-contract-saved-views'
import { SavedViewColorDot, SavedViewColorField } from './SavedViewColorControls'
import { savedViewNameErrorMessage, validateSavedViewName } from './saved-view-name-validation'
import { returnFocusOnClose } from './saved-view-focus-return'

const UNDO_DURATION_MS = 5000

function RowAction({
  label,
  onClick,
  children
}: {
  label: string
  onClick?: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label} onClick={onClick}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

function RenameField({
  view,
  views,
  onDone
}: {
  view: SidebarSavedView
  views: readonly SidebarSavedView[]
  onDone: () => void
}): React.JSX.Element {
  const renameSidebarView = useAppStore((s) => s.renameSidebarView)
  const [name, setName] = useState(view.name)
  const [submitError, setSubmitError] = useState<SidebarViewNameError | null>(null)
  const error = validateSavedViewName(views, name, view.id) ?? submitError
  const errorId = useId()
  // Why: Esc reverts through the dialog's escape handler, and the unmount must not then commit.
  const cancelledRef = useRef(false)

  const commit = (): void => {
    if (error) {
      return
    }
    const result = renameSidebarView(view.id, name)
    if (result.ok) {
      onDone()
    } else {
      setSubmitError(result.error)
    }
  }

  return (
    <div className="min-w-0 flex-1 space-y-1">
      <Input
        autoFocus
        value={name}
        aria-label={translate('sidebar.savedViews.renameInput', 'View name')}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => {
          setName(event.target.value)
          setSubmitError(null)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            commit()
          } else if (event.key === 'Escape') {
            cancelledRef.current = true
          }
        }}
        onBlur={() => {
          if (cancelledRef.current || error) {
            onDone()
          } else {
            commit()
          }
        }}
      />
      {error ? (
        <p id={errorId} className="text-xs text-destructive">
          {savedViewNameErrorMessage(error)}
        </p>
      ) : null}
    </div>
  )
}

function ViewRow({
  view,
  index,
  views,
  renaming,
  onStartRename,
  onStopRename
}: {
  view: SidebarSavedView
  index: number
  views: readonly SidebarSavedView[]
  renaming: boolean
  onStartRename: () => void
  onStopRename: () => void
}): React.JSX.Element {
  const setSidebarViewColor = useAppStore((s) => s.setSidebarViewColor)
  const deleteSidebarView = useAppStore((s) => s.deleteSidebarView)
  const restoreSidebarView = useAppStore((s) => s.restoreSidebarView)

  const handleDelete = (): void => {
    const deletion = deleteSidebarView(view.id)
    if (!deletion) {
      return
    }
    toast(translate('sidebar.savedViews.deleted', 'Deleted view "{{name}}"', { name: view.name }), {
      duration: UNDO_DURATION_MS,
      action: {
        label: translate('sidebar.savedViews.undo', 'Undo'),
        onClick: () => restoreSidebarView(deletion)
      }
    })
  }

  return (
    <li className="flex min-h-9 items-center gap-2 px-1">
      <span className="w-3 shrink-0 text-right text-[11px] text-muted-foreground tabular-nums">
        {index < SIDEBAR_VIEW_SHORTCUT_COUNT ? index + 1 : ''}
      </span>
      <SavedViewColorDot color={view.color} />
      {renaming ? (
        <RenameField view={view} views={views} onDone={onStopRename} />
      ) : (
        <span className="min-w-0 flex-1 truncate text-xs">{view.name}</span>
      )}
      <RowAction
        label={translate('sidebar.savedViews.renameAction', 'Rename {{name}}', { name: view.name })}
        onClick={onStartRename}
      >
        <Pencil className="size-3.5" />
      </RowAction>
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={translate(
                  'sidebar.savedViews.colorAction',
                  'Change color of {{name}}',
                  {
                    name: view.name
                  }
                )}
              >
                <Palette className="size-3.5" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={4}>
            {translate('sidebar.savedViews.colorAction', 'Change color of {{name}}', {
              name: view.name
            })}
          </TooltipContent>
        </Tooltip>
        <PopoverContent className="w-auto" align="end">
          <SavedViewColorField
            value={view.color ?? null}
            onChange={(color) => setSidebarViewColor(view.id, color)}
          />
        </PopoverContent>
      </Popover>
      <RowAction
        label={translate('sidebar.savedViews.deleteAction', 'Delete {{name}}', { name: view.name })}
        onClick={handleDelete}
      >
        <Trash2 className="size-3.5" />
      </RowAction>
    </li>
  )
}

export function ManageSidebarViewsDialog({
  returnFocusTo,
  onClose
}: {
  returnFocusTo: HTMLElement | null
  onClose: () => void
}): React.JSX.Element {
  const views = useAppStore((s) => s.sidebarSavedViews)
  const openSavedViewDialog = useAppStore((s) => s.openSavedViewDialog)
  const [renamingId, setRenamingId] = useState<string | null>(null)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-md sm:max-w-md"
        onCloseAutoFocus={returnFocusOnClose(returnFocusTo)}
        onEscapeKeyDown={(event) => {
          // Why: Esc while renaming reverts the row instead of closing the dialog.
          if (renamingId) {
            event.preventDefault()
            setRenamingId(null)
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{translate('sidebar.savedViews.manageTitle', 'Saved views')}</DialogTitle>
          <DialogDescription>
            {translate(
              'sidebar.savedViews.manageDescription',
              'Views 1–9 can be switched with the "Select Saved View 1–9" shortcut.'
            )}
          </DialogDescription>
        </DialogHeader>
        {views.length === 0 ? (
          <div className="flex items-center justify-between gap-3 rounded-md bg-muted px-3 py-2 text-xs">
            <span className="text-muted-foreground">
              {translate('sidebar.savedViews.manageEmpty', 'No saved views.')}
            </span>
            <Button
              variant="outline"
              size="xs"
              onClick={() => openSavedViewDialog('save', returnFocusTo)}
            >
              {translate('sidebar.savedViews.saveCurrentShort', 'Save current view')}
            </Button>
          </div>
        ) : (
          <ul className="scrollbar-sleek max-h-80 overflow-y-auto">
            {views.map((view, index) => (
              <ViewRow
                key={view.id}
                view={view}
                index={index}
                views={views}
                renaming={renamingId === view.id}
                onStartRename={() => setRenamingId(view.id)}
                onStopRename={() => setRenamingId(null)}
              />
            ))}
          </ul>
        )}
        <DialogFooter>
          <Button size="sm" onClick={onClose}>
            {translate('sidebar.savedViews.done', 'Done')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
