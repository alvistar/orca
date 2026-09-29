import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Repo } from '../../../../shared/repo-types'
import {
  MAX_SIDEBAR_SAVED_VIEWS,
  type SidebarSavedView
} from '../../../../shared/sidebar-saved-views'
import {
  capturePersistedUIWriteBaseline,
  diffPersistedUIWriteFields
} from './persisted-ui-write-baseline'
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

function seededStore() {
  const store = createUIStore()
  store.setState({ repos: [repo('repo-a'), repo('repo-b')] })
  store.getState().hydratePersistedUI(makePersistedUI())
  setUI.mockClear()
  return store
}

function saveOrThrow(store: ReturnType<typeof createUIStore>, name: string, color?: string) {
  const result = store.getState().saveSidebarView({ name, color })
  if (!result.ok) {
    throw new Error(`save failed: ${result.error.kind}`)
  }
  return result.id
}

describe('saved sidebar views: guard branches', () => {
  it('deleting an unknown view is a no-op', () => {
    const store = seededStore()
    saveOrThrow(store, 'Only')

    expect(store.getState().deleteSidebarView('missing')).toBeNull()
    expect(store.getState().sidebarSavedViews).toHaveLength(1)
  })

  it('deleting an inactive view keeps the active one and its snapshot', () => {
    const store = seededStore()
    const inactive = saveOrThrow(store, 'First')
    const active = saveOrThrow(store, 'Second')
    const snapshot = store.getState().sidebarSettingsBeforeView

    const deletion = store.getState().deleteSidebarView(inactive)

    expect(deletion).toMatchObject({ wasActive: false, settingsBeforeView: null })
    expect(store.getState().activeSidebarViewId).toBe(active)
    expect(store.getState().sidebarSettingsBeforeView).toEqual(snapshot)
  })

  it('undo reports failure when the view already exists, its name is taken, or the list is full', () => {
    const store = seededStore()
    const id = saveOrThrow(store, 'Work')
    const deletion = store.getState().deleteSidebarView(id)!

    saveOrThrow(store, 'WORK')
    expect(store.getState().restoreSidebarView(deletion)).toBe(false)

    const other = seededStore()
    const otherId = saveOrThrow(other, 'Work')
    const otherDeletion = other.getState().deleteSidebarView(otherId)!
    expect(other.getState().restoreSidebarView(otherDeletion)).toBe(true)
    expect(other.getState().restoreSidebarView(otherDeletion)).toBe(false)

    const full = seededStore()
    const fullId = saveOrThrow(full, 'Doomed')
    const fullDeletion = full.getState().deleteSidebarView(fullId)!
    for (let i = 0; i < MAX_SIDEBAR_SAVED_VIEWS; i++) {
      saveOrThrow(full, `View ${i}`)
    }
    expect(full.getState().restoreSidebarView(fullDeletion)).toBe(false)
  })

  it('clearing with no active view does nothing', () => {
    const store = seededStore()
    const listener = vi.fn()
    store.subscribe(listener)

    store.getState().clearActiveSidebarView()

    expect(listener).not.toHaveBeenCalled()
    expect(setUI).not.toHaveBeenCalled()
  })

  it('clearing an active view with no snapshot keeps the current settings', () => {
    const store = seededStore()
    store.getState().setGroupBy('none')
    const id = saveOrThrow(store, 'Flat')
    store.setState({ activeSidebarViewId: id, sidebarSettingsBeforeView: null })
    setUI.mockClear()

    store.getState().clearActiveSidebarView()

    expect(store.getState().activeSidebarViewId).toBeNull()
    expect(store.getState().groupBy).toBe('none')
    expect(setUI).not.toHaveBeenCalled()
  })

  it('logs a failed host-scope write instead of throwing', async () => {
    const store = seededStore()
    const id = saveOrThrow(store, 'Default')
    const error = new Error('host offline')
    setUI.mockImplementationOnce(() => Promise.reject(error))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    store.getState().applySidebarView(id)
    await Promise.resolve()
    await Promise.resolve()

    expect(consoleError).toHaveBeenCalledWith(error)
    expect(store.getState().activeSidebarViewId).toBe(id)
    consoleError.mockRestore()
  })

  it('a colored view echoed back by sync hydration leaves no pending write', () => {
    const store = seededStore()
    saveOrThrow(store, 'Colored', '#22c55e')
    const views: SidebarSavedView[] = store.getState().sidebarSavedViews

    store.getState().hydratePersistedUI(
      makePersistedUI({
        sidebarSavedViews: views,
        activeSidebarViewId: store.getState().activeSidebarViewId,
        sidebarSettingsBeforeView: store.getState().sidebarSettingsBeforeView
      })
    )

    const state = store.getState()
    expect(
      diffPersistedUIWriteFields(
        capturePersistedUIWriteBaseline(state),
        state.persistedUIWriteBaseline!
      )
    ).toEqual({})
    expect(Object.keys(views[0])).toEqual(['id', 'name', 'color', 'settings'])
  })
})
