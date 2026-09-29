import type { ExecutionHostId } from './execution-host'
import type { PersistedUIState } from './persisted-ui-state-types'
import {
  resolveSidebarSettings,
  snapshotSidebarViewSettings,
  type SidebarViewLiveSettings,
  type SidebarViewSettings
} from './sidebar-saved-views'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function remapHostIds(
  settings: SidebarViewSettings,
  oldHostId: ExecutionHostId,
  newHostId: ExecutionHostId
): boolean {
  let changed = false
  if (settings.workspaceHostScope === oldHostId) {
    settings.workspaceHostScope = newHostId
    changed = true
  }
  if (settings.visibleWorkspaceHostIds?.includes(oldHostId)) {
    settings.visibleWorkspaceHostIds = [
      ...new Set(settings.visibleWorkspaceHostIds.map((id) => (id === oldHostId ? newHostId : id)))
    ]
    changed = true
  }
  return changed
}

/** SSH target re-adoption: re-point one host id inside saved views and the pre-view snapshot. */
export function migrateSidebarSavedViewsHostId(
  ui: Pick<PersistedUIState, 'sidebarSavedViews' | 'sidebarSettingsBeforeView'>,
  oldHostId: ExecutionHostId,
  newHostId: ExecutionHostId
): boolean {
  let changed = false
  const settingsList = [
    ...(Array.isArray(ui.sidebarSavedViews)
      ? ui.sidebarSavedViews.map((view) => view?.settings)
      : []),
    ui.sidebarSettingsBeforeView
  ]
  for (const settings of settingsList) {
    // Hand-edited files may hold junk; hydration drops it later.
    if (isRecord(settings)) {
      changed = remapHostIds(settings, oldHostId, newHostId) || changed
    }
  }
  return changed
}

/**
 * A synced write can change captured settings under the active view (another paired client
 * applied its own view); the marker and snapshot are dropped once the sidebar no longer matches.
 */
export function reconcileSyncedSidebarView(
  state: SidebarViewLiveSettings &
    Pick<PersistedUIState, 'sidebarSavedViews'> & { activeSidebarViewId: string | null },
  knownRepoIds: ReadonlySet<string>
): { activeSidebarViewId: null; sidebarSettingsBeforeView: null } | null {
  // Why the catalog guard: before repos load, every saved project resolves as missing.
  if (state.activeSidebarViewId === null || knownRepoIds.size === 0) {
    return null
  }
  const view = state.sidebarSavedViews?.find(({ id }) => id === state.activeSidebarViewId)
  if (!view) {
    return null
  }
  const expected = snapshotSidebarViewSettings(resolveSidebarSettings(view.settings, knownRepoIds))
  return JSON.stringify(snapshotSidebarViewSettings(state)) === JSON.stringify(expected)
    ? null
    : { activeSidebarViewId: null, sidebarSettingsBeforeView: null }
}
