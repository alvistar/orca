import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SIDEBAR_VIEW_CAPTURED_FIELDS,
  type SidebarSavedView
} from '../../../../shared/sidebar-saved-views'
import type { Repo } from '../../../../shared/repo-types'
import type { AppState } from '../types'
import {
  capturePersistedUIWriteBaseline,
  diffPersistedUIWriteFields
} from './persisted-ui-write-baseline'
import { SAVED_VIEW_DEACTIVATING_SETTERS } from './ui/ui-slice-saved-view-actions'
import { createUIStore, makePersistedUI } from './ui-slice-test-harness'
import { revealRepoInProjectFilter } from '@/components/sidebar/project-filter-reveal'

const setUI = vi.fn(() => Promise.resolve())

beforeEach(() => {
  setUI.mockClear()
  vi.stubGlobal('window', { api: { ui: { set: setUI } } })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function repo(id: string): Repo {
  return { id, path: `/tmp/${id}`, displayName: id, badgeColor: 'gray', addedAt: 1, kind: 'git' }
}

function savedView(overrides: Partial<SidebarSavedView> = {}): SidebarSavedView {
  return {
    id: 'view-1',
    name: 'Homelab',
    color: '#22c55e',
    settings: {
      filterRepoIds: ['repo-a'],
      groupBy: 'workspace-status',
      sortBy: 'name',
      projectOrderBy: 'manual',
      hideDefaultBranchWorkspace: true
    },
    ...overrides
  }
}

describe('saved sidebar views: hydration', () => {
  it('starts with no views and no active view', () => {
    const store = createUIStore()

    expect(store.getState().sidebarSavedViews).toEqual([])
    expect(store.getState().activeSidebarViewId).toBeNull()
  })

  it('restores saved views and the active view', () => {
    const store = createUIStore()

    store
      .getState()
      .hydratePersistedUI(
        makePersistedUI({ sidebarSavedViews: [savedView()], activeSidebarViewId: 'view-1' })
      )

    expect(store.getState().sidebarSavedViews).toEqual([savedView()])
    expect(store.getState().activeSidebarViewId).toBe('view-1')
  })

  it('drops invalid entries and nulls an active id that no longer matches', () => {
    const store = createUIStore()
    const hydrate = makePersistedUI({
      activeSidebarViewId: 'view-bad'
    })
    // Hand-edited file: shapes the type system would never produce.
    Object.assign(hydrate, {
      sidebarSavedViews: [
        savedView(),
        { ...savedView({ id: 'view-bad', name: 'Bad' }), settings: { groupBy: 'nope' } },
        savedView({ name: 'Duplicate id' }),
        'junk'
      ]
    })

    store.getState().hydratePersistedUI(hydrate)

    expect(store.getState().sidebarSavedViews.map((v) => v.id)).toEqual(['view-1'])
    expect(store.getState().activeSidebarViewId).toBeNull()
  })

  it('keeps saved project ids that are not in the current catalog', () => {
    const store = createUIStore()
    store.setState({ repos: [repo('repo-z')] })

    store.getState().hydratePersistedUI(makePersistedUI({ sidebarSavedViews: [savedView()] }))

    expect(store.getState().sidebarSavedViews[0].settings.filterRepoIds).toEqual(['repo-a'])
  })
})

function seededStore() {
  const store = createUIStore()
  store.setState({ repos: [repo('repo-a'), repo('repo-b')] })
  store.getState().hydratePersistedUI(makePersistedUI())
  setUI.mockClear()
  return store
}

function liveSettings(store: ReturnType<typeof createUIStore>) {
  const s = store.getState()
  return {
    filterRepoIds: [...s.filterRepoIds],
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
  }
}

function pendingWrites(store: ReturnType<typeof createUIStore>) {
  const state = store.getState()
  const baseline = state.persistedUIWriteBaseline
  if (!baseline) {
    throw new Error('store was never hydrated')
  }
  return diffPersistedUIWriteFields(capturePersistedUIWriteBaseline(state), baseline)
}

function saveOrThrow(
  store: ReturnType<typeof createUIStore>,
  name: string,
  color?: string
): string {
  const result = store.getState().saveSidebarView({ name, color })
  if (!result.ok) {
    throw new Error(`save failed: ${result.error.kind}`)
  }
  return result.id
}

describe('saved sidebar views: save', () => {
  it('snapshots the live settings, appends the view, makes it active and persists both fields', () => {
    const store = seededStore()
    store.getState().setGroupBy('pr-status')
    store.getState().setFilterRepoIds(['repo-b'])
    setUI.mockClear()

    const id = saveOrThrow(store, '  Review  ', '#EF4444')

    const [view] = store.getState().sidebarSavedViews
    expect(view).toMatchObject({ id, name: 'Review', color: '#ef4444' })
    expect(view.settings).toMatchObject({ groupBy: 'pr-status', filterRepoIds: ['repo-b'] })
    expect(store.getState().activeSidebarViewId).toBe(id)
    expect(pendingWrites(store)).toMatchObject({
      sidebarSavedViews: store.getState().sidebarSavedViews,
      activeSidebarViewId: id
    })
  })

  it('stores no color when none or an invalid one is given', () => {
    const store = seededStore()

    saveOrThrow(store, 'Plain')
    saveOrThrow(store, 'Junk color', 'nope')

    expect(store.getState().sidebarSavedViews.map((v) => v.color)).toEqual([undefined, undefined])
  })

  it('rejects an empty name', () => {
    const store = seededStore()

    expect(store.getState().saveSidebarView({ name: '   ' })).toEqual({
      ok: false,
      error: { kind: 'empty' }
    })
    expect(store.getState().sidebarSavedViews).toEqual([])
    expect(pendingWrites(store)).toEqual({})
  })

  it('rejects a case-insensitive duplicate name and names the existing view', () => {
    const store = seededStore()
    saveOrThrow(store, 'Homelab')

    expect(store.getState().saveSidebarView({ name: 'HOMELAB' })).toEqual({
      ok: false,
      error: { kind: 'duplicate', existingName: 'Homelab' }
    })
    expect(store.getState().sidebarSavedViews).toHaveLength(1)
  })

  it('rejects a save past the view limit', () => {
    const store = seededStore()
    for (let i = 0; i < 50; i++) {
      saveOrThrow(store, `View ${i}`)
    }

    expect(store.getState().saveSidebarView({ name: 'One more' })).toEqual({
      ok: false,
      error: { kind: 'limit' }
    })
  })
})

describe('saved sidebar views: apply', () => {
  function storeWithSavedView() {
    const store = seededStore()
    const s = store.getState()
    s.setFilterRepoIds(['repo-a', 'repo-b'])
    s.setGroupBy('workspace-status')
    s.setSortBy('name')
    s.setProjectOrderBy('recent')
    s.setShowSleepingWorkspaces(false)
    s.setHideDefaultBranchWorkspace(true)
    s.setHideAutomationGeneratedWorkspaces(true)
    s.setHideCliCreatedWorkspaces(true)
    s.setHideDetachedHeadWorkspaces(true)
    s.setHideWorkspacesFromOtherDevices(true)
    s.setAlwaysShowDefaultBranchWorkspace(false)
    s.setVisibleWorkspaceHostIds(['local', 'ssh:box'])
    const saved = liveSettings(store)
    const id = saveOrThrow(store, 'Everything')
    // Raw write back to defaults: hydration would keep these unflushed local edits.
    store.setState({
      activeSidebarViewId: null,
      filterRepoIds: [],
      groupBy: 'repo',
      sortBy: 'recent',
      projectOrderBy: 'manual',
      showSleepingWorkspaces: true,
      hideDefaultBranchWorkspace: false,
      hideAutomationGeneratedWorkspaces: false,
      hideCliCreatedWorkspaces: false,
      hideDetachedHeadWorkspaces: false,
      hideWorkspacesFromOtherDevices: false,
      alwaysShowDefaultBranchWorkspace: true,
      workspaceHostScope: 'all',
      visibleWorkspaceHostIds: null
    })
    setUI.mockClear()
    return { store, id, saved }
  }

  it('restores every captured field in a single store update and becomes active', () => {
    const { store, id, saved } = storeWithSavedView()
    expect(liveSettings(store)).not.toEqual(saved)
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)

    store.getState().applySidebarView(id)
    unsubscribe()

    expect(listener).toHaveBeenCalledTimes(1)
    expect(liveSettings(store)).toEqual(saved)
    expect(store.getState().activeSidebarViewId).toBe(id)
  })

  it('persists host scope directly and the rest through the debounced writer', () => {
    const { store, id } = storeWithSavedView()

    store.getState().applySidebarView(id)

    expect(setUI).toHaveBeenCalledTimes(1)
    expect(setUI).toHaveBeenCalledWith({
      workspaceHostScope: 'all',
      visibleWorkspaceHostIds: ['local', 'ssh:box'],
      collapsedGroups: []
    })
    expect(Object.keys(pendingWrites(store))).toEqual(
      expect.arrayContaining([
        'activeSidebarViewId',
        'groupBy',
        'sortBy',
        'filterRepoIds',
        'showSleepingWorkspaces'
      ])
    )
  })

  it('clears collapsed groups only when the grouping changes', () => {
    const { store, id } = storeWithSavedView()
    store.setState({ collapsedGroups: new Set(['repo:repo-a']) })
    store.getState().applySidebarView(id)
    expect(store.getState().collapsedGroups.size).toBe(0)

    store.setState({ collapsedGroups: new Set(['workspace-status:done']) })
    setUI.mockClear()
    store.getState().applySidebarView(id)

    expect(store.getState().collapsedGroups).toEqual(new Set(['workspace-status:done']))
    expect(setUI).toHaveBeenCalledWith(
      expect.not.objectContaining({ collapsedGroups: expect.anything() })
    )
  })

  it('skips projects that were removed since the view was saved', () => {
    const { store, id } = storeWithSavedView()
    store.setState({ repos: [repo('repo-b')] })

    store.getState().applySidebarView(id)

    expect(store.getState().filterRepoIds).toEqual(['repo-b'])
    expect(store.getState().sidebarSavedViews[0].settings.filterRepoIds).toEqual([
      'repo-a',
      'repo-b'
    ])
  })

  it('applies no project filter when every saved project is gone', () => {
    const { store, id } = storeWithSavedView()
    store.setState({ repos: [repo('repo-z')] })

    store.getState().applySidebarView(id)

    expect(store.getState().filterRepoIds).toEqual([])
  })

  it('applies by 0-based position and ignores a position past the end', () => {
    const { store, id } = storeWithSavedView()

    store.getState().applySidebarViewAtIndex(3)
    expect(store.getState().activeSidebarViewId).toBeNull()

    store.getState().applySidebarViewAtIndex(0)
    expect(store.getState().activeSidebarViewId).toBe(id)
  })

  it('ignores an unknown id', () => {
    const { store } = storeWithSavedView()
    const before = store.getState()

    store.getState().applySidebarView('missing')

    expect(store.getState()).toBe(before)
  })
})

type SetterCase = [string, (s: AppState) => void]

const DEACTIVATING_SETTER_CASES: SetterCase[] = [
  ['setFilterRepoIds', (s) => s.setFilterRepoIds(['repo-a'])],
  ['setGroupBy', (s) => s.setGroupBy('none')],
  ['setSortBy', (s) => s.setSortBy('manual')],
  ['setProjectOrderBy', (s) => s.setProjectOrderBy('recent')],
  ['setShowSleepingWorkspaces', (s) => s.setShowSleepingWorkspaces(false)],
  ['setHideDefaultBranchWorkspace', (s) => s.setHideDefaultBranchWorkspace(true)],
  ['setHideAutomationGeneratedWorkspaces', (s) => s.setHideAutomationGeneratedWorkspaces(true)],
  ['setHideCliCreatedWorkspaces', (s) => s.setHideCliCreatedWorkspaces(true)],
  ['setHideDetachedHeadWorkspaces', (s) => s.setHideDetachedHeadWorkspaces(true)],
  ['setHideWorkspacesFromOtherDevices', (s) => s.setHideWorkspacesFromOtherDevices(true)],
  ['setAlwaysShowDefaultBranchWorkspace', (s) => s.setAlwaysShowDefaultBranchWorkspace(false)],
  ['setWorkspaceHostScope', (s) => s.setWorkspaceHostScope('local')],
  ['setVisibleWorkspaceHostIds', (s) => s.setVisibleWorkspaceHostIds(['local', 'ssh:box'])]
]

describe('saved sidebar views: deactivation', () => {
  it('wraps a setter for every captured field', () => {
    expect(Object.keys(SAVED_VIEW_DEACTIVATING_SETTERS).sort()).toEqual(
      DEACTIVATING_SETTER_CASES.map(([name]) => name).sort()
    )
    expect(new Set(Object.values(SAVED_VIEW_DEACTIVATING_SETTERS))).toEqual(
      new Set(SIDEBAR_VIEW_CAPTURED_FIELDS)
    )
  })

  it.each(DEACTIVATING_SETTER_CASES)(
    '%s changes its setting and clears the active view',
    (_name, change) => {
      const store = seededStore()
      saveOrThrow(store, 'Default')
      const before = liveSettings(store)

      change(store.getState())

      expect(liveSettings(store)).not.toEqual(before)
      expect(store.getState().activeSidebarViewId).toBeNull()
      expect(store.getState().sidebarSavedViews).toHaveLength(1)
    }
  )

  it('keeps the view active when a setter re-selects the current value', () => {
    const store = seededStore()
    const id = saveOrThrow(store, 'Default')

    store.getState().setGroupBy(store.getState().groupBy)
    store.getState().setFilterRepoIds([])

    expect(store.getState().activeSidebarViewId).toBe(id)
  })

  it('keeps the view active on catalog pruning and a matching sync broadcast', () => {
    const store = seededStore()
    store.getState().setFilterRepoIds(['repo-a', 'repo-b'])
    const id = saveOrThrow(store, 'Both')

    // Catalog refresh removes repo-b and prunes it through a raw write.
    store.setState({ repos: [repo('repo-a')], filterRepoIds: ['repo-a'] })
    store.getState().hydratePersistedUI(
      makePersistedUI({
        filterRepoIds: ['repo-a'],
        sidebarSavedViews: store.getState().sidebarSavedViews,
        activeSidebarViewId: id
      })
    )

    expect(store.getState().activeSidebarViewId).toBe(id)
  })

  it('deactivates when a paired client syncs settings that no longer match the view', () => {
    const store = seededStore()
    const id = saveOrThrow(store, 'Default')

    store.getState().hydratePersistedUI(
      makePersistedUI({
        groupBy: 'none',
        sidebarSavedViews: store.getState().sidebarSavedViews,
        activeSidebarViewId: id
      })
    )

    expect(store.getState().groupBy).toBe('none')
    expect(store.getState().activeSidebarViewId).toBeNull()
    expect(store.getState().sidebarSettingsBeforeView).toBeNull()
  })

  it('keeps the view on startup hydration before the repo catalog loads', () => {
    const store = seededStore()
    store.getState().setFilterRepoIds(['repo-a'])
    const id = saveOrThrow(store, 'Only A')
    const restarted = createUIStore()

    restarted.getState().hydratePersistedUI(
      makePersistedUI({
        filterRepoIds: ['repo-a'],
        sidebarSavedViews: store.getState().sidebarSavedViews,
        activeSidebarViewId: id
      })
    )

    expect(restarted.getState().activeSidebarViewId).toBe(id)
  })

  it('deactivates when opening a workspace reveals its project in the filter', () => {
    const store = seededStore()
    store.getState().setFilterRepoIds(['repo-a'])
    saveOrThrow(store, 'Only A')

    revealRepoInProjectFilter(store.getState(), 'repo-b')

    expect(store.getState().filterRepoIds).toEqual(['repo-a', 'repo-b'])
    expect(store.getState().activeSidebarViewId).toBeNull()
  })

  it('does not touch non-captured settings or their persistence', () => {
    const store = seededStore()
    const id = saveOrThrow(store, 'Default')

    store.getState().toggleCollapsedGroup('repo:repo-a')

    expect(store.getState().activeSidebarViewId).toBe(id)
  })

  it('drops the pre-view settings when a manual change deactivates the view', () => {
    const store = seededStore()
    const id = saveOrThrow(store, 'Default')
    store.getState().setGroupBy('none')
    store.getState().applySidebarView(id)

    store.getState().setSortBy('name')

    expect(store.getState().sidebarSettingsBeforeView).toBeNull()
  })
})

describe('saved sidebar views: clear', () => {
  function storeWithFlatView() {
    const store = seededStore()
    store.getState().setGroupBy('none')
    store.getState().setVisibleWorkspaceHostIds(['ssh:box'])
    const id = saveOrThrow(store, 'Flat')
    store.getState().clearActiveSidebarView()
    store.setState({ groupBy: 'repo', visibleWorkspaceHostIds: null, workspaceHostScope: 'all' })
    store.getState().setFilterRepoIds(['repo-b'])
    const before = liveSettings(store)
    setUI.mockClear()
    return { store, id, before }
  }

  it('restores the settings from before the view was applied', () => {
    const { store, id, before } = storeWithFlatView()
    store.getState().applySidebarView(id)
    expect(store.getState().groupBy).toBe('none')

    store.getState().clearActiveSidebarView()

    expect(liveSettings(store)).toEqual(before)
    expect(store.getState().activeSidebarViewId).toBeNull()
    expect(store.getState().sidebarSettingsBeforeView).toBeNull()
    expect(setUI).toHaveBeenLastCalledWith(
      expect.objectContaining({ workspaceHostScope: 'all', visibleWorkspaceHostIds: null })
    )
  })

  it('keeps the first snapshot across view-to-view switches', () => {
    const { store, id, before } = storeWithFlatView()
    store.getState().applySidebarView(id)
    const otherId = saveOrThrow(store, 'Other')
    store.getState().applySidebarView(id)
    store.getState().applySidebarView(otherId)

    store.getState().clearActiveSidebarView()

    expect(liveSettings(store)).toEqual(before)
  })

  it('persists the snapshot so a restart can still restore it', () => {
    const { store, id } = storeWithFlatView()

    store.getState().applySidebarView(id)

    expect(pendingWrites(store)).toHaveProperty('sidebarSettingsBeforeView')
    const restarted = createUIStore()
    restarted.getState().hydratePersistedUI(
      makePersistedUI({
        sidebarSavedViews: store.getState().sidebarSavedViews,
        activeSidebarViewId: id,
        sidebarSettingsBeforeView: store.getState().sidebarSettingsBeforeView
      })
    )
    expect(restarted.getState().sidebarSettingsBeforeView).toEqual(
      store.getState().sidebarSettingsBeforeView
    )
  })

  it('ignores a persisted snapshot when no view is active', () => {
    const { store, id } = storeWithFlatView()
    store.getState().applySidebarView(id)
    const restarted = createUIStore()

    restarted.getState().hydratePersistedUI(
      makePersistedUI({
        sidebarSavedViews: store.getState().sidebarSavedViews,
        activeSidebarViewId: null,
        sidebarSettingsBeforeView: store.getState().sidebarSettingsBeforeView
      })
    )

    expect(restarted.getState().sidebarSettingsBeforeView).toBeNull()
  })

  it('undoing the delete of the active view brings its snapshot back', () => {
    const { store, id, before } = storeWithFlatView()
    store.getState().applySidebarView(id)

    const deletion = store.getState().deleteSidebarView(id)!
    expect(store.getState().sidebarSettingsBeforeView).toBeNull()
    store.getState().restoreSidebarView(deletion)
    store.getState().clearActiveSidebarView()

    expect(liveSettings(store)).toEqual(before)
  })
})

describe('saved sidebar views: manage', () => {
  it('renames a view, allowing a case change of its own name', () => {
    const store = seededStore()
    const id = saveOrThrow(store, 'homelab')
    saveOrThrow(store, 'Work')

    expect(store.getState().renameSidebarView(id, ' Homelab ')).toEqual({ ok: true, id })
    expect(store.getState().sidebarSavedViews[0].name).toBe('Homelab')
    expect(store.getState().renameSidebarView(id, 'work')).toEqual({
      ok: false,
      error: { kind: 'duplicate', existingName: 'Work' }
    })
    expect(store.getState().renameSidebarView(id, '')).toEqual({
      ok: false,
      error: { kind: 'empty' }
    })
  })

  it('sets and clears a color without changing the active view', () => {
    const store = seededStore()
    const id = saveOrThrow(store, 'Homelab')

    store.getState().setSidebarViewColor(id, 'abc')
    expect(store.getState().sidebarSavedViews[0].color).toBe('#aabbcc')

    store.getState().setSidebarViewColor(id, null)
    expect(store.getState().sidebarSavedViews[0]).not.toHaveProperty('color')
    expect(store.getState().activeSidebarViewId).toBe(id)
  })

  it('deletes the active view, leaving the live settings untouched', () => {
    const store = seededStore()
    store.getState().setGroupBy('none')
    const id = saveOrThrow(store, 'Flat')
    setUI.mockClear()

    const deletion = store.getState().deleteSidebarView(id)

    expect(deletion).toMatchObject({ index: 0, wasActive: true })
    expect(store.getState().sidebarSavedViews).toEqual([])
    expect(store.getState().activeSidebarViewId).toBeNull()
    expect(store.getState().groupBy).toBe('none')
  })

  it('undo restores the view at its index and as active', () => {
    const store = seededStore()
    saveOrThrow(store, 'First')
    const id = saveOrThrow(store, 'Second')
    saveOrThrow(store, 'Third')
    store.getState().applySidebarView(id)

    const deletion = store.getState().deleteSidebarView(id)!
    store.getState().restoreSidebarView(deletion)

    expect(store.getState().sidebarSavedViews.map((v) => v.name)).toEqual([
      'First',
      'Second',
      'Third'
    ])
    expect(store.getState().activeSidebarViewId).toBe(id)
  })

  it('undo after a settings change restores the view but not as active', () => {
    const store = seededStore()
    const id = saveOrThrow(store, 'Only')

    const deletion = store.getState().deleteSidebarView(id)!
    store.getState().setGroupBy('none')
    store.getState().restoreSidebarView(deletion)

    expect(store.getState().sidebarSavedViews.map((v) => v.id)).toEqual([id])
    expect(store.getState().activeSidebarViewId).toBeNull()
  })

  it('opens and closes the saved-view dialogs', () => {
    const store = seededStore()

    store.getState().openSavedViewDialog('manage')
    expect(store.getState().savedViewDialog).toEqual({ kind: 'manage', returnFocusTo: null })

    store.getState().closeSavedViewDialog()
    expect(store.getState().savedViewDialog).toBeNull()
  })
})
