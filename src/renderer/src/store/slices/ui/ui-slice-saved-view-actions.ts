import type { UISlice, UISliceGet, UISliceSet } from './ui-slice-contract'
import type { AppState } from '../../types'
import { createBrowserUuid } from '@/lib/browser-uuid'
import { normalizeRepoBadgeColor } from '../../../../../shared/repo-badge-color'
import {
  MAX_SIDEBAR_SAVED_VIEWS,
  findSidebarViewNameConflict,
  resolveSidebarSettings,
  snapshotSidebarViewSettings,
  validateSidebarViewName,
  type SidebarSavedView,
  type SidebarViewCapturedField,
  type SidebarViewSettings
} from '../../../../../shared/sidebar-saved-views'

/** User-facing setters that clear the active view, keyed to the captured field each one writes. */
export const SAVED_VIEW_DEACTIVATING_SETTERS = {
  setFilterRepoIds: 'filterRepoIds',
  setGroupBy: 'groupBy',
  setSortBy: 'sortBy',
  setProjectOrderBy: 'projectOrderBy',
  setShowSleepingWorkspaces: 'hideSleepingWorkspaces',
  setHideDefaultBranchWorkspace: 'hideDefaultBranchWorkspace',
  setHideAutomationGeneratedWorkspaces: 'hideAutomationGeneratedWorkspaces',
  setHideCliCreatedWorkspaces: 'hideCliCreatedWorkspaces',
  setHideDetachedHeadWorkspaces: 'hideDetachedHeadWorkspaces',
  setHideWorkspacesFromOtherDevices: 'hideWorkspacesFromOtherDevices',
  setAlwaysShowDefaultBranchWorkspace: 'alwaysShowDefaultBranchWorkspace',
  setWorkspaceHostScope: 'workspaceHostScope',
  setVisibleWorkspaceHostIds: 'visibleWorkspaceHostIds'
} as const satisfies Partial<Record<keyof UISlice, SidebarViewCapturedField>>

type DeactivatingSetter = keyof typeof SAVED_VIEW_DEACTIVATING_SETTERS

function liveSettingsKey(state: AppState): string {
  return JSON.stringify(snapshotSidebarViewSettings(state))
}

// Why this key order: it matches the hydration normalizer, so the writer's JSON equality sees an echo as unchanged.
function withColor(view: SidebarSavedView, color: string | null | undefined): SidebarSavedView {
  const { id, name, settings } = view
  const normalized = normalizeRepoBadgeColor(color)
  return normalized ? { id, name, color: normalized, settings } : { id, name, settings }
}

/**
 * Wraps the user-facing setters so a manual change to a captured setting drops the active view.
 * Raw writes (catalog pruning, remote hydration) bypass these setters and leave the view active.
 */
export function withSavedViewDeactivation(
  actions: Partial<UISlice>,
  set: UISliceSet,
  get: UISliceGet
): Partial<UISlice> {
  const wrapped: Partial<UISlice> = { ...actions }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: keys of the `satisfies`-checked setter record above.
  for (const name of Object.keys(SAVED_VIEW_DEACTIVATING_SETTERS) as DeactivatingSetter[]) {
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: every listed member is a setter; the wrapper forwards its arguments untouched.
    const original = actions[name] as ((...args: unknown[]) => void) | undefined
    if (!original) {
      continue
    }
    const setter = (...args: unknown[]): void => {
      const before = get().activeSidebarViewId === null ? null : liveSettingsKey(get())
      original(...args)
      if (before !== null && liveSettingsKey(get()) !== before) {
        set({ activeSidebarViewId: null, sidebarSettingsBeforeView: null })
      }
    }
    Object.assign(wrapped, { [name]: setter })
  }
  return wrapped
}

/** The pre-view snapshot survives view-to-view switches; only the first apply takes it. */
function settingsBeforeView(state: AppState): SidebarViewSettings | null {
  return state.activeSidebarViewId === null
    ? snapshotSidebarViewSettings(state)
    : state.sidebarSettingsBeforeView
}

/** One store update for every captured field, plus the host-scope writes the debounced writer skips. */
function applySidebarSettings(
  set: UISliceSet,
  get: UISliceGet,
  settings: SidebarViewSettings,
  marker: Pick<AppState, 'activeSidebarViewId' | 'sidebarSettingsBeforeView'>
): void {
  const s = get()
  const live = resolveSidebarSettings(settings, new Set(s.repos.map((repo) => repo.id)))
  // Same rule as setGroupBy: collapsed keys are per grouping mode.
  const groupByChanged = live.groupBy !== s.groupBy
  set({
    ...live,
    ...marker,
    ...(groupByChanged ? { collapsedGroups: new Set<string>() } : {})
  })
  // Why direct: the debounced writer does not own these, matching their own setters.
  window.api.ui
    .set({
      workspaceHostScope: live.workspaceHostScope,
      visibleWorkspaceHostIds: live.visibleWorkspaceHostIds,
      ...(groupByChanged ? { collapsedGroups: [] } : {})
    })
    .catch(console.error)
}

export function createUiSavedViewActions(set: UISliceSet, get: UISliceGet): Partial<UISlice> {
  return {
    sidebarSavedViews: [],
    activeSidebarViewId: null,
    sidebarSettingsBeforeView: null,

    saveSidebarView: ({ name: rawName, color }) => {
      const s = get()
      if (s.sidebarSavedViews.length >= MAX_SIDEBAR_SAVED_VIEWS) {
        return { ok: false, error: { kind: 'limit' } }
      }
      const validated = validateSidebarViewName(s.sidebarSavedViews, rawName)
      if (!validated.ok) {
        return validated
      }
      const { name } = validated
      const view = withColor(
        { id: createBrowserUuid(), name, settings: snapshotSidebarViewSettings(s) },
        color
      )
      const sidebarSavedViews = [...s.sidebarSavedViews, view]
      set({
        sidebarSavedViews,
        activeSidebarViewId: view.id,
        sidebarSettingsBeforeView: settingsBeforeView(s)
      })
      return { ok: true, id: view.id }
    },

    applySidebarView: (id) => {
      const s = get()
      const view = s.sidebarSavedViews.find((candidate) => candidate.id === id)
      if (!view) {
        return
      }
      applySidebarSettings(set, get, view.settings, {
        activeSidebarViewId: id,
        sidebarSettingsBeforeView: settingsBeforeView(s)
      })
    },

    applySidebarViewAtIndex: (index) => {
      const view = get().sidebarSavedViews[index]
      if (view) {
        get().applySidebarView(view.id)
      }
    },

    renameSidebarView: (id, rawName) => {
      const s = get()
      const validated = validateSidebarViewName(s.sidebarSavedViews, rawName, id)
      if (!validated.ok) {
        return validated
      }
      const { name } = validated
      const sidebarSavedViews = s.sidebarSavedViews.map((view) =>
        view.id === id ? { ...view, name } : view
      )
      set({ sidebarSavedViews })
      return { ok: true, id }
    },

    setSidebarViewColor: (id, color) => {
      const sidebarSavedViews = get().sidebarSavedViews.map((view) =>
        view.id === id ? withColor(view, color) : view
      )
      set({ sidebarSavedViews })
    },

    deleteSidebarView: (id) => {
      const s = get()
      const index = s.sidebarSavedViews.findIndex((view) => view.id === id)
      if (index === -1) {
        return null
      }
      const wasActive = s.activeSidebarViewId === id
      const sidebarSavedViews = s.sidebarSavedViews.filter((view) => view.id !== id)
      set(
        wasActive
          ? { sidebarSavedViews, activeSidebarViewId: null, sidebarSettingsBeforeView: null }
          : { sidebarSavedViews }
      )
      return {
        view: s.sidebarSavedViews[index],
        index,
        wasActive,
        liveSettingsKey: liveSettingsKey(s),
        settingsBeforeView: wasActive ? s.sidebarSettingsBeforeView : null
      }
    },

    restoreSidebarView: ({
      view,
      index,
      wasActive,
      liveSettingsKey: keyAtDelete,
      settingsBeforeView: snapshotAtDelete
    }) => {
      const s = get()
      if (
        s.sidebarSavedViews.some((existing) => existing.id === view.id) ||
        findSidebarViewNameConflict(s.sidebarSavedViews, view.name) ||
        s.sidebarSavedViews.length >= MAX_SIDEBAR_SAVED_VIEWS
      ) {
        return false
      }
      const sidebarSavedViews = [...s.sidebarSavedViews]
      sidebarSavedViews.splice(Math.min(index, sidebarSavedViews.length), 0, view)
      // Only reclaim "active" if the sidebar still shows what it showed at delete time.
      const reactivate =
        wasActive && s.activeSidebarViewId === null && liveSettingsKey(s) === keyAtDelete
      set(
        reactivate
          ? {
              sidebarSavedViews,
              activeSidebarViewId: view.id,
              sidebarSettingsBeforeView: snapshotAtDelete
            }
          : { sidebarSavedViews }
      )
      return true
    },

    clearActiveSidebarView: () => {
      const s = get()
      if (s.activeSidebarViewId === null) {
        return
      }
      const cleared = { activeSidebarViewId: null, sidebarSettingsBeforeView: null }
      if (s.sidebarSettingsBeforeView) {
        applySidebarSettings(set, get, s.sidebarSettingsBeforeView, cleared)
      } else {
        set(cleared)
      }
    },

    savedViewDialog: null,
    openSavedViewDialog: (kind, returnFocusTo = null) =>
      set({ savedViewDialog: { kind, returnFocusTo } }),
    closeSavedViewDialog: () => set({ savedViewDialog: null })
  }
}
