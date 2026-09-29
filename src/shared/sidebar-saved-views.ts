import { DEFAULT_HIDE_SLEEPING_WORKSPACES } from './constants'
import { normalizeExecutionHostScope, normalizeVisibleExecutionHostIds } from './execution-host'
import type { PersistedUIState } from './persisted-ui-state-types'
import { normalizeRepoBadgeColor } from './repo-badge-color'
import type { VisibleWorkspaceHostIds, WorkspaceHostScope } from './ui-chrome-types'

export const MAX_SIDEBAR_SAVED_VIEWS = 50
export const MAX_SIDEBAR_VIEW_NAME_LENGTH = 60

type RequiredViewField =
  | 'filterRepoIds'
  | 'groupBy'
  | 'sortBy'
  | 'projectOrderBy'
  | 'hideDefaultBranchWorkspace'
type OptionalViewField =
  | 'hideSleepingWorkspaces'
  | 'hideAutomationGeneratedWorkspaces'
  | 'hideCliCreatedWorkspaces'
  | 'hideDetachedHeadWorkspaces'
  | 'hideWorkspacesFromOtherDevices'
  | 'alwaysShowDefaultBranchWorkspace'
  | 'workspaceHostScope'
  | 'visibleWorkspaceHostIds'

/** The workspace-sidebar settings a saved view restores, in their persisted form. */
export type SidebarViewSettings = Pick<PersistedUIState, RequiredViewField> &
  Partial<Pick<PersistedUIState, OptionalViewField>>

export type SidebarViewCapturedField = RequiredViewField | OptionalViewField

export type SidebarSavedView = {
  id: string
  name: string
  color?: string
  settings: SidebarViewSettings
}

// Why a record: adding a field to SidebarViewSettings without listing it here fails to compile.
const CAPTURED_FIELD_SET = {
  filterRepoIds: true,
  groupBy: true,
  sortBy: true,
  projectOrderBy: true,
  hideDefaultBranchWorkspace: true,
  hideSleepingWorkspaces: true,
  hideAutomationGeneratedWorkspaces: true,
  hideCliCreatedWorkspaces: true,
  hideDetachedHeadWorkspaces: true,
  hideWorkspacesFromOtherDevices: true,
  alwaysShowDefaultBranchWorkspace: true,
  workspaceHostScope: true,
  visibleWorkspaceHostIds: true
} satisfies Record<SidebarViewCapturedField, true>

// oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: keys of a literal typed by `satisfies Record<SidebarViewCapturedField, true>`.
export const SIDEBAR_VIEW_CAPTURED_FIELDS = Object.keys(
  CAPTURED_FIELD_SET
) as readonly SidebarViewCapturedField[]

/** The same settings as the renderer store holds them (sleeping visibility in positive form). */
export type SidebarViewLiveSettings = Pick<
  PersistedUIState,
  'groupBy' | 'sortBy' | 'projectOrderBy' | 'hideDefaultBranchWorkspace'
> & {
  filterRepoIds: readonly string[]
  showSleepingWorkspaces: boolean
  hideAutomationGeneratedWorkspaces: boolean
  hideCliCreatedWorkspaces: boolean
  hideDetachedHeadWorkspaces: boolean
  hideWorkspacesFromOtherDevices: boolean
  alwaysShowDefaultBranchWorkspace: boolean
  workspaceHostScope: WorkspaceHostScope
  visibleWorkspaceHostIds: VisibleWorkspaceHostIds
}

const GROUP_BY_VALUES = [
  'none',
  'workspace-status',
  'repo',
  'pr-status'
] as const satisfies readonly PersistedUIState['groupBy'][]
const SORT_BY_VALUES = [
  'name',
  'smart',
  'recent',
  'repo',
  'manual'
] as const satisfies readonly PersistedUIState['sortBy'][]
const PROJECT_ORDER_BY_VALUES = [
  'manual',
  'recent'
] as const satisfies readonly PersistedUIState['projectOrderBy'][]

const OPTIONAL_BOOLEAN_FIELDS = [
  'hideSleepingWorkspaces',
  'hideAutomationGeneratedWorkspaces',
  'hideCliCreatedWorkspaces',
  'hideDetachedHeadWorkspaces',
  'hideWorkspacesFromOtherDevices',
  'alwaysShowDefaultBranchWorkspace'
] as const satisfies readonly OptionalViewField[]

export function snapshotSidebarViewSettings(live: SidebarViewLiveSettings): SidebarViewSettings {
  return {
    filterRepoIds: [...live.filterRepoIds],
    groupBy: live.groupBy,
    sortBy: live.sortBy,
    projectOrderBy: live.projectOrderBy,
    hideDefaultBranchWorkspace: live.hideDefaultBranchWorkspace,
    hideSleepingWorkspaces: !live.showSleepingWorkspaces,
    hideAutomationGeneratedWorkspaces: live.hideAutomationGeneratedWorkspaces,
    hideCliCreatedWorkspaces: live.hideCliCreatedWorkspaces,
    hideDetachedHeadWorkspaces: live.hideDetachedHeadWorkspaces,
    hideWorkspacesFromOtherDevices: live.hideWorkspacesFromOtherDevices,
    alwaysShowDefaultBranchWorkspace: live.alwaysShowDefaultBranchWorkspace,
    workspaceHostScope: live.workspaceHostScope,
    visibleWorkspaceHostIds: live.visibleWorkspaceHostIds ? [...live.visibleWorkspaceHostIds] : null
  }
}

/** Live settings a view applies; saved projects missing from `knownRepoIds` are skipped, never pruned from the view. */
export function resolveSidebarViewSettings(
  view: SidebarSavedView,
  knownRepoIds: ReadonlySet<string>
): SidebarViewLiveSettings {
  const { settings } = view
  const savedScope = normalizeExecutionHostScope(settings.workspaceHostScope)
  // Same fallback as hydration: a legacy single-scope view with no visibility list focuses that host.
  const visibleWorkspaceHostIds =
    normalizeVisibleExecutionHostIds(settings.visibleWorkspaceHostIds) ??
    (savedScope === 'all' ? null : [savedScope])
  let workspaceHostScope: WorkspaceHostScope = savedScope
  if (visibleWorkspaceHostIds === null) {
    workspaceHostScope = 'all'
  } else if (visibleWorkspaceHostIds.length === 1) {
    workspaceHostScope = visibleWorkspaceHostIds[0]
  }
  return {
    filterRepoIds: settings.filterRepoIds.filter((repoId) => knownRepoIds.has(repoId)),
    groupBy: settings.groupBy,
    sortBy: settings.sortBy,
    projectOrderBy: settings.projectOrderBy,
    showSleepingWorkspaces: !(settings.hideSleepingWorkspaces ?? DEFAULT_HIDE_SLEEPING_WORKSPACES),
    hideDefaultBranchWorkspace: settings.hideDefaultBranchWorkspace,
    hideAutomationGeneratedWorkspaces: settings.hideAutomationGeneratedWorkspaces === true,
    hideCliCreatedWorkspaces: settings.hideCliCreatedWorkspaces === true,
    hideDetachedHeadWorkspaces: settings.hideDetachedHeadWorkspaces === true,
    hideWorkspacesFromOtherDevices: settings.hideWorkspacesFromOtherDevices === true,
    alwaysShowDefaultBranchWorkspace: settings.alwaysShowDefaultBranchWorkspace !== false,
    workspaceHostScope,
    visibleWorkspaceHostIds
  }
}

export function normalizeSidebarViewName(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim().slice(0, MAX_SIDEBAR_VIEW_NAME_LENGTH).trim()
  return trimmed.length > 0 ? trimmed : null
}

export type SidebarViewNameError =
  | { kind: 'empty' }
  | { kind: 'duplicate'; existingName: string }
  | { kind: 'limit' }

/** Only views 1-9 answer to the digit shortcut. */
export const SIDEBAR_VIEW_SHORTCUT_COUNT = 9

/** Trimmed name, or why it can't be used; `ignoreId` lets a view keep its own name on rename. */
export function validateSidebarViewName(
  views: readonly SidebarSavedView[],
  rawName: string,
  ignoreId?: string
): { ok: true; name: string } | { ok: false; error: SidebarViewNameError } {
  const name = normalizeSidebarViewName(rawName)
  if (!name) {
    return { ok: false, error: { kind: 'empty' } }
  }
  const conflict = findSidebarViewNameConflict(views, name, ignoreId)
  return conflict
    ? { ok: false, error: { kind: 'duplicate', existingName: conflict.name } }
    : { ok: true, name }
}

export function findSidebarViewNameConflict(
  views: readonly SidebarSavedView[],
  name: string,
  ignoreId?: string
): SidebarSavedView | undefined {
  const key = name.trim().toLocaleLowerCase()
  return views.find((view) => view.id !== ignoreId && view.name.toLocaleLowerCase() === key)
}

function isOneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return values.some((candidate) => candidate === value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeViewSettings(input: unknown): SidebarViewSettings | null {
  if (
    !isRecord(input) ||
    !Array.isArray(input.filterRepoIds) ||
    !isOneOf(GROUP_BY_VALUES, input.groupBy) ||
    !isOneOf(SORT_BY_VALUES, input.sortBy) ||
    !isOneOf(PROJECT_ORDER_BY_VALUES, input.projectOrderBy) ||
    typeof input.hideDefaultBranchWorkspace !== 'boolean'
  ) {
    return null
  }
  const settings: SidebarViewSettings = {
    filterRepoIds: input.filterRepoIds.filter((id): id is string => typeof id === 'string'),
    groupBy: input.groupBy,
    sortBy: input.sortBy,
    projectOrderBy: input.projectOrderBy,
    hideDefaultBranchWorkspace: input.hideDefaultBranchWorkspace
  }
  for (const field of OPTIONAL_BOOLEAN_FIELDS) {
    const flag = input[field]
    if (typeof flag === 'boolean') {
      settings[field] = flag
    }
  }
  // Format-only normalization: ids of hosts that are offline today stay in the view.
  if (typeof input.workspaceHostScope === 'string') {
    settings.workspaceHostScope = normalizeExecutionHostScope(input.workspaceHostScope)
  }
  if (input.visibleWorkspaceHostIds === null) {
    settings.visibleWorkspaceHostIds = null
  } else if (
    Array.isArray(input.visibleWorkspaceHostIds) &&
    input.visibleWorkspaceHostIds.every((id) => typeof id === 'string')
  ) {
    settings.visibleWorkspaceHostIds = normalizeVisibleExecutionHostIds(
      input.visibleWorkspaceHostIds
    )
  }
  return settings
}

/** Hydration guard for a hand-editable list: drops invalid entries instead of failing the sidebar. */
export function normalizeSidebarSavedViews(value: unknown): SidebarSavedView[] {
  if (!Array.isArray(value)) {
    return []
  }
  const views: SidebarSavedView[] = []
  const seenIds = new Set<string>()
  for (const input of value) {
    if (views.length >= MAX_SIDEBAR_SAVED_VIEWS) {
      break
    }
    if (!isRecord(input)) {
      continue
    }
    const name = normalizeSidebarViewName(input.name)
    const settings = normalizeViewSettings(input.settings)
    if (
      typeof input.id !== 'string' ||
      input.id.length === 0 ||
      seenIds.has(input.id) ||
      !name ||
      !settings ||
      findSidebarViewNameConflict(views, name)
    ) {
      continue
    }
    seenIds.add(input.id)
    const color = normalizeRepoBadgeColor(input.color)
    views.push(color ? { id: input.id, name, color, settings } : { id: input.id, name, settings })
  }
  return views
}

export function normalizeActiveSidebarViewId(
  value: unknown,
  views: readonly SidebarSavedView[]
): string | null {
  return typeof value === 'string' && views.some((view) => view.id === value) ? value : null
}

export function hydrateSidebarSavedViews(
  ui: Pick<PersistedUIState, 'sidebarSavedViews' | 'activeSidebarViewId'>
): { sidebarSavedViews: SidebarSavedView[]; activeSidebarViewId: string | null } {
  const sidebarSavedViews = normalizeSidebarSavedViews(ui.sidebarSavedViews)
  return {
    sidebarSavedViews,
    activeSidebarViewId: normalizeActiveSidebarViewId(ui.activeSidebarViewId, sidebarSavedViews)
  }
}
