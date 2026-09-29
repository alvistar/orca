import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SidebarSavedView } from '../../../../shared/sidebar-saved-views'
import type { Repo } from '../../../../shared/repo-types'
import { createUIStore, makePersistedUI } from './ui-slice-test-harness'

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
