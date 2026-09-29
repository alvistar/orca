import React, { useId, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
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
import { Label } from '@/components/ui/label'
import { translate } from '@/i18n/i18n'
import type { SidebarViewLiveSettings } from '../../../../shared/sidebar-saved-views'
import type { SidebarViewNameError } from '@/store/slices/ui/ui-slice-contract-saved-views'
import { SavedViewColorField } from './SavedViewColorControls'
import { buildSavedViewSummary, suggestSavedViewName } from './sidebar-saved-view-summary'
import { savedViewNameErrorMessage, validateSavedViewName } from './saved-view-name-validation'
import { returnFocusOnClose } from './saved-view-focus-return'
import { getSidebarHostVisibilityLabel, shouldShowHostScopeControls } from './sidebar-host-options'
import { useSidebarHostScopeOptions } from './use-sidebar-host-scope-options'

function useLiveViewSettings(): SidebarViewLiveSettings {
  return useAppStore(
    useShallow((s) => ({
      filterRepoIds: s.filterRepoIds,
      groupBy: s.groupBy,
      sortBy: s.sortBy,
      projectOrderBy: s.projectOrderBy,
      showSleepingWorkspaces: s.showSleepingWorkspaces,
      hideDefaultBranchWorkspace: s.hideDefaultBranchWorkspace,
      hideAutomationGeneratedWorkspaces: s.hideAutomationGeneratedWorkspaces,
      hideCliCreatedWorkspaces: s.hideCliCreatedWorkspaces,
      hideDetachedHeadWorkspaces: s.hideDetachedHeadWorkspaces,
      hideWorkspacesFromOtherDevices: s.hideWorkspacesFromOtherDevices,
      alwaysShowDefaultBranchWorkspace: s.alwaysShowDefaultBranchWorkspace,
      workspaceHostScope: s.workspaceHostScope,
      visibleWorkspaceHostIds: s.visibleWorkspaceHostIds
    }))
  )
}

export function SaveSidebarViewDialog({
  returnFocusTo,
  onClose
}: {
  returnFocusTo: HTMLElement | null
  onClose: () => void
}): React.JSX.Element {
  const live = useLiveViewSettings()
  const repos = useAppStore((s) => s.repos)
  const views = useAppStore((s) => s.sidebarSavedViews)
  const saveSidebarView = useAppStore((s) => s.saveSidebarView)
  const { hostOptions } = useSidebarHostScopeOptions()
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()
  const errorId = useId()
  const colorLabelId = useId()
  // Why lazy: the suggestion is frozen when the dialog opens, not re-derived while typing.
  const [name, setName] = useState(() => suggestSavedViewName({ live, repos, views }))
  const [color, setColor] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<SidebarViewNameError | null>(null)
  const nameError = validateSavedViewName(views, name) ?? submitError

  const summary = useMemo(
    () =>
      buildSavedViewSummary({
        live,
        repos,
        hostsLabel: shouldShowHostScopeControls(hostOptions)
          ? getSidebarHostVisibilityLabel(live.visibleWorkspaceHostIds, hostOptions)
          : null
      }),
    [hostOptions, live, repos]
  )

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    if (nameError) {
      return
    }
    const result = saveSidebarView({ name, color })
    if (result.ok) {
      onClose()
    } else {
      setSubmitError(result.error)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-sm sm:max-w-sm"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          inputRef.current?.focus()
          inputRef.current?.select()
        }}
        onCloseAutoFocus={returnFocusOnClose(returnFocusTo)}
      >
        <DialogHeader>
          <DialogTitle>
            {translate('sidebar.savedViews.saveTitle', 'Save current view')}
          </DialogTitle>
          <DialogDescription>
            {translate(
              'sidebar.savedViews.saveDescription',
              "Saves the sidebar's projects, grouping, sort and filters."
            )}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <Label htmlFor={inputId}>{translate('sidebar.savedViews.nameLabel', 'Name')}</Label>
            <Input
              id={inputId}
              ref={inputRef}
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                setSubmitError(null)
              }}
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? errorId : undefined}
            />
            {nameError ? (
              <p id={errorId} className="text-xs text-destructive">
                {savedViewNameErrorMessage(nameError)}
              </p>
            ) : null}
          </div>
          <div className="space-y-1">
            <Label id={colorLabelId}>{translate('sidebar.savedViews.colorLabel', 'Color')}</Label>
            <SavedViewColorField value={color} onChange={setColor} labelledBy={colorLabelId} />
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-md bg-muted px-3 py-2 text-xs">
            {summary.map((row) => (
              <React.Fragment key={row.label}>
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className="min-w-0 truncate">{row.value}</dd>
              </React.Fragment>
            ))}
          </dl>
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              {translate('sidebar.savedViews.cancel', 'Cancel')}
            </Button>
            <Button type="submit" size="sm" disabled={nameError !== null}>
              {translate('sidebar.savedViews.saveConfirm', 'Save view')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
