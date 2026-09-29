import { describe, expect, it } from 'vitest'
import {
  MAX_SIDEBAR_SAVED_VIEWS,
  SIDEBAR_VIEW_CAPTURED_FIELDS,
  findSidebarViewNameConflict,
  normalizeActiveSidebarViewId,
  normalizeSidebarSavedViews,
  normalizeSidebarViewName,
  resolveSidebarViewSettings,
  snapshotSidebarViewSettings,
  type SidebarSavedView,
  validateSidebarViewName,
  type SidebarViewLiveSettings
} from './sidebar-saved-views'
import {
  migrateSidebarSavedViewsHostId,
  reconcileSyncedSidebarView
} from './sidebar-saved-views-host-sync'

const live: SidebarViewLiveSettings = {
  filterRepoIds: ['repo-a', 'repo-b'],
  groupBy: 'workspace-status',
  sortBy: 'name',
  projectOrderBy: 'recent',
  showSleepingWorkspaces: false,
  hideDefaultBranchWorkspace: true,
  hideAutomationGeneratedWorkspaces: true,
  hideCliCreatedWorkspaces: false,
  hideDetachedHeadWorkspaces: true,
  hideWorkspacesFromOtherDevices: true,
  alwaysShowDefaultBranchWorkspace: false,
  workspaceHostScope: 'ssh:box',
  visibleWorkspaceHostIds: ['ssh:box']
}

function view(overrides: Partial<SidebarSavedView> = {}): SidebarSavedView {
  return {
    id: 'v1',
    name: 'Homelab',
    settings: snapshotSidebarViewSettings(live),
    ...overrides
  }
}

describe('snapshotSidebarViewSettings', () => {
  it('captures every captured field in its persisted form', () => {
    const settings = snapshotSidebarViewSettings(live)

    expect(Object.keys(settings).sort()).toEqual([...SIDEBAR_VIEW_CAPTURED_FIELDS].sort())
    expect(settings.hideSleepingWorkspaces).toBe(true)
    expect(settings.filterRepoIds).toEqual(['repo-a', 'repo-b'])
    expect(settings.visibleWorkspaceHostIds).toEqual(['ssh:box'])
  })

  it('copies arrays so later live edits cannot mutate the saved view', () => {
    const filterRepoIds = ['repo-a']
    const settings = snapshotSidebarViewSettings({ ...live, filterRepoIds })
    filterRepoIds.push('repo-z')

    expect(settings.filterRepoIds).toEqual(['repo-a'])
  })
})

describe('resolveSidebarViewSettings', () => {
  it('round-trips a snapshot back to the live settings', () => {
    expect(resolveSidebarViewSettings(view(), new Set(['repo-a', 'repo-b']))).toEqual(live)
  })

  it('skips projects that are no longer known', () => {
    const resolved = resolveSidebarViewSettings(view(), new Set(['repo-b']))

    expect(resolved.filterRepoIds).toEqual(['repo-b'])
  })

  it('applies no project filter when every saved project is gone', () => {
    expect(resolveSidebarViewSettings(view(), new Set(['other'])).filterRepoIds).toEqual([])
  })

  it('fills defaults for optional fields a minimal view omits', () => {
    const minimal: SidebarSavedView = {
      id: 'v1',
      name: 'Minimal',
      settings: {
        filterRepoIds: [],
        groupBy: 'repo',
        sortBy: 'recent',
        projectOrderBy: 'manual',
        hideDefaultBranchWorkspace: false
      }
    }

    expect(resolveSidebarViewSettings(minimal, new Set())).toEqual({
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
  })

  it('focuses a legacy single-scope view that saved no visibility list', () => {
    const legacy = view({
      settings: { ...view().settings, workspaceHostScope: 'ssh:box', visibleWorkspaceHostIds: null }
    })
    delete legacy.settings.visibleWorkspaceHostIds

    const resolved = resolveSidebarViewSettings(legacy, new Set())

    expect(resolved.visibleWorkspaceHostIds).toEqual(['ssh:box'])
    expect(resolved.workspaceHostScope).toBe('ssh:box')
  })

  it('derives the host scope from a multi-host visibility list', () => {
    const multi = view({
      settings: {
        ...view().settings,
        workspaceHostScope: 'local',
        visibleWorkspaceHostIds: ['local', 'ssh:box']
      }
    })

    const resolved = resolveSidebarViewSettings(multi, new Set())

    expect(resolved.visibleWorkspaceHostIds).toEqual(['local', 'ssh:box'])
    expect(resolved.workspaceHostScope).toBe('local')
  })
})

describe('normalizeSidebarSavedViews', () => {
  it('returns an empty list for non-array input', () => {
    expect(normalizeSidebarSavedViews(undefined)).toEqual([])
    expect(normalizeSidebarSavedViews({ id: 'v1' })).toEqual([])
  })

  it('keeps valid views and normalizes name and color', () => {
    const [normalized] = normalizeSidebarSavedViews([
      { ...view(), name: '  Homelab  ', color: 'ABC' }
    ])

    expect(normalized.name).toBe('Homelab')
    expect(normalized.color).toBe('#aabbcc')
  })

  it('drops an invalid color rather than the view', () => {
    const [normalized] = normalizeSidebarSavedViews([{ ...view(), color: 'not-a-color' }])

    expect(normalized).toBeDefined()
    expect(normalized.color).toBeUndefined()
  })

  it('drops entries with a missing id, empty name, or missing settings', () => {
    expect(
      normalizeSidebarSavedViews([
        { ...view(), id: '' },
        { ...view({ id: 'v2' }), name: '   ' },
        { id: 'v3', name: 'No settings' },
        null,
        'junk'
      ])
    ).toEqual([])
  })

  it('drops entries whose required enum fields hold unknown values', () => {
    const bad = view({ id: 'v2', name: 'Bad group' })
    expect(
      normalizeSidebarSavedViews([
        { ...bad, settings: { ...bad.settings, groupBy: 'parent-of-parent' } },
        { ...bad, id: 'v3', name: 'Bad sort', settings: { ...bad.settings, sortBy: 'size' } }
      ])
    ).toEqual([])
  })

  it('drops invalid optional fields but keeps the view', () => {
    const [normalized] = normalizeSidebarSavedViews([
      {
        ...view(),
        settings: {
          ...view().settings,
          hideCliCreatedWorkspaces: 'yes',
          visibleWorkspaceHostIds: 'local'
        }
      }
    ])

    expect(normalized.settings).not.toHaveProperty('hideCliCreatedWorkspaces')
    expect(normalized.settings).not.toHaveProperty('visibleWorkspaceHostIds')
    expect(normalized.settings.hideDetachedHeadWorkspaces).toBe(true)
  })

  it('never prunes stored project ids', () => {
    const [normalized] = normalizeSidebarSavedViews([view()])

    expect(normalized.settings.filterRepoIds).toEqual(['repo-a', 'repo-b'])
  })

  it('drops duplicate ids and case-insensitive duplicate names, keeping the first', () => {
    const normalized = normalizeSidebarSavedViews([
      view({ id: 'v1', name: 'Homelab' }),
      view({ id: 'v1', name: 'Other' }),
      view({ id: 'v2', name: 'HOMELAB' }),
      view({ id: 'v3', name: 'Work' })
    ])

    expect(normalized.map((v) => v.id)).toEqual(['v1', 'v3'])
  })

  it('caps the list', () => {
    const many = Array.from({ length: MAX_SIDEBAR_SAVED_VIEWS + 5 }, (_, i) =>
      view({ id: `v${i}`, name: `View ${i}` })
    )

    expect(normalizeSidebarSavedViews(many)).toHaveLength(MAX_SIDEBAR_SAVED_VIEWS)
  })

  it('truncates overlong names', () => {
    const [normalized] = normalizeSidebarSavedViews([view({ name: 'x'.repeat(200) })])

    expect(normalized.name).toHaveLength(60)
  })
})

describe('normalizeActiveSidebarViewId', () => {
  it('keeps an id that matches a view and nulls anything else', () => {
    const views = [view()]

    expect(normalizeActiveSidebarViewId('v1', views)).toBe('v1')
    expect(normalizeActiveSidebarViewId('gone', views)).toBeNull()
    expect(normalizeActiveSidebarViewId(42, views)).toBeNull()
    expect(normalizeActiveSidebarViewId(undefined, views)).toBeNull()
  })
})

describe('validateSidebarViewName', () => {
  it('returns the trimmed name or the reason it cannot be used', () => {
    const views = [view({ id: 'v1', name: 'Homelab' })]

    expect(validateSidebarViewName(views, '  Work ')).toEqual({ ok: true, name: 'Work' })
    expect(validateSidebarViewName(views, ' ')).toEqual({ ok: false, error: { kind: 'empty' } })
    expect(validateSidebarViewName(views, 'HOMELAB')).toEqual({
      ok: false,
      error: { kind: 'duplicate', existingName: 'Homelab' }
    })
    expect(validateSidebarViewName(views, 'homelab', 'v1')).toEqual({ ok: true, name: 'homelab' })
  })
})

describe('view names', () => {
  it('trims names and rejects empty ones', () => {
    expect(normalizeSidebarViewName('  Work  ')).toBe('Work')
    expect(normalizeSidebarViewName('   ')).toBeNull()
  })

  it('finds a case-insensitive conflict, ignoring the view being renamed', () => {
    const views = [view({ id: 'v1', name: 'Homelab' }), view({ id: 'v2', name: 'Work' })]

    expect(findSidebarViewNameConflict(views, 'homelab')?.id).toBe('v1')
    expect(findSidebarViewNameConflict(views, 'homelab', 'v1')).toBeUndefined()
    expect(findSidebarViewNameConflict(views, 'Other')).toBeUndefined()
  })
})

describe('migrateSidebarSavedViewsHostId', () => {
  it('re-points the host id in every saved view and in the pre-view snapshot', () => {
    const ui = {
      sidebarSavedViews: [
        view(),
        view({
          id: 'v2',
          name: 'Both',
          settings: {
            ...view().settings,
            workspaceHostScope: 'local',
            visibleWorkspaceHostIds: ['local', 'ssh:box', 'ssh:new']
          }
        })
      ],
      sidebarSettingsBeforeView: { ...view().settings }
    }

    expect(migrateSidebarSavedViewsHostId(ui, 'ssh:box', 'ssh:new')).toBe(true)

    expect(ui.sidebarSavedViews[0].settings.workspaceHostScope).toBe('ssh:new')
    expect(ui.sidebarSavedViews[0].settings.visibleWorkspaceHostIds).toEqual(['ssh:new'])
    expect(ui.sidebarSavedViews[1].settings.visibleWorkspaceHostIds).toEqual(['local', 'ssh:new'])
    expect(ui.sidebarSettingsBeforeView.workspaceHostScope).toBe('ssh:new')
  })

  it('reports no change for other hosts and tolerates missing or junk entries', () => {
    const ui = { sidebarSavedViews: [view()], sidebarSettingsBeforeView: null }
    Object.assign(ui.sidebarSavedViews, { 1: null })

    expect(migrateSidebarSavedViewsHostId(ui, 'ssh:other', 'ssh:new')).toBe(false)
    expect(migrateSidebarSavedViewsHostId({}, 'ssh:box', 'ssh:new')).toBe(false)
  })
})

describe('reconcileSyncedSidebarView', () => {
  const known = new Set(['repo-a', 'repo-b'])

  it('keeps a view whose settings still match, and ignores an inactive store', () => {
    const state = { ...live, sidebarSavedViews: [view()], activeSidebarViewId: 'v1' }

    expect(reconcileSyncedSidebarView(state, known)).toBeNull()
    expect(reconcileSyncedSidebarView({ ...state, activeSidebarViewId: null }, known)).toBeNull()
  })

  it('drops the marker and snapshot once synced settings diverge', () => {
    const state = {
      ...live,
      groupBy: 'none' as const,
      sidebarSavedViews: [view()],
      activeSidebarViewId: 'v1'
    }

    expect(reconcileSyncedSidebarView(state, known)).toEqual({
      activeSidebarViewId: null,
      sidebarSettingsBeforeView: null
    })
  })

  it('waits for the repo catalog before comparing project filters', () => {
    const state = { ...live, sidebarSavedViews: [view()], activeSidebarViewId: 'v1' }

    expect(reconcileSyncedSidebarView(state, new Set())).toBeNull()
  })
})
