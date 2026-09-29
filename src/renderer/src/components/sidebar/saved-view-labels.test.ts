import { describe, expect, it, vi } from 'vitest'
import type { Repo } from '../../../../shared/repo-types'
import {
  snapshotSidebarViewSettings,
  type SidebarSavedView,
  type SidebarViewLiveSettings
} from '../../../../shared/sidebar-saved-views'
import { savedViewShortcutLabel } from './saved-view-shortcut-labels'
import { buildSavedViewSummary, suggestSavedViewName } from './sidebar-saved-view-summary'

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string) => fallback
}))

const ACTION = 'sidebar.view.selectByIndex'

const live: SidebarViewLiveSettings = {
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
}

function repo(id: string, displayName: string): Repo {
  return { id, path: `/tmp/${id}`, displayName, badgeColor: 'gray', addedAt: 1, kind: 'git' }
}

function namedView(name: string): SidebarSavedView {
  return { id: name, name, settings: snapshotSidebarViewSettings(live) }
}

describe('savedViewShortcutLabel', () => {
  it('labels the digit each of the first nine views answers to', () => {
    const overrides = { [ACTION]: ['Mod+Alt+1'] }

    expect(savedViewShortcutLabel(0, overrides, 'darwin')).toBe('⌘⌥1')
    expect(savedViewShortcutLabel(8, overrides, 'darwin')).toBe('⌘⌥9')
    expect(savedViewShortcutLabel(2, overrides, 'linux')).toBe('Ctrl+Alt+3')
  })

  it('has no label past nine, when unbound, or for a non-digit binding', () => {
    expect(savedViewShortcutLabel(9, { [ACTION]: ['Mod+Alt+1'] }, 'darwin')).toBeNull()
    expect(savedViewShortcutLabel(0, undefined, 'darwin')).toBeNull()
    expect(savedViewShortcutLabel(0, { [ACTION]: ['Mod+Alt+K'] }, 'darwin')).toBeNull()
  })
})

describe('buildSavedViewSummary', () => {
  const repos = [repo('repo-a', 'homelab'), repo('repo-b', 'work')]

  it('shows project order only when grouped by project', () => {
    const labels = (groupBy: SidebarViewLiveSettings['groupBy']) =>
      buildSavedViewSummary({ live: { ...live, groupBy }, repos, hostsLabel: null }).map(
        (row) => row.label
      )

    expect(labels('repo')).toContain('Project order')
    expect(labels('none')).not.toContain('Project order')
  })

  it('names the filtered projects, the hidden kinds and the hosts when present', () => {
    const rows = buildSavedViewSummary({
      live: {
        ...live,
        filterRepoIds: ['repo-b'],
        showSleepingWorkspaces: false,
        hideDetachedHeadWorkspaces: true
      },
      repos,
      hostsLabel: 'box'
    })

    expect(rows).toContainEqual({ label: 'Projects', value: 'work' })
    expect(rows).toContainEqual({
      label: 'Hidden',
      value: 'Hide sleeping, Hide detached HEAD'
    })
    expect(rows).toContainEqual({ label: 'Hosts', value: 'box' })
  })

  it('reads All projects and omits empty optional rows', () => {
    const rows = buildSavedViewSummary({
      live: { ...live, groupBy: 'none' },
      repos,
      hostsLabel: null
    })

    expect(rows[0]).toEqual({ label: 'Projects', value: 'All projects' })
    expect(rows.map((row) => row.label)).toEqual(['Projects', 'Group by', 'Sort by'])
  })
})

describe('suggestSavedViewName', () => {
  const repos = [repo('repo-a', 'homelab')]

  it('combines the first filtered project with the grouping', () => {
    const name = suggestSavedViewName({
      live: { ...live, filterRepoIds: ['repo-a'] },
      repos,
      views: []
    })

    expect(name.startsWith('homelab · ')).toBe(true)
  })

  it('adds a numeric suffix until the name is free', () => {
    const first = suggestSavedViewName({ live, repos, views: [] })
    const views = [namedView(first), namedView(`${first} 2`)]

    expect(suggestSavedViewName({ live, repos, views })).toBe(`${first} 3`)
  })

  it('leaves room for a suffix within the name limit', () => {
    const longRepos = [repo('repo-a', 'x'.repeat(80))]

    const name = suggestSavedViewName({
      live: { ...live, filterRepoIds: ['repo-a'] },
      repos: longRepos,
      views: []
    })

    expect(name.length).toBeLessThanOrEqual(57)
  })
})
