import { translate } from '@/i18n/i18n'
import type { Repo } from '../../../../shared/repo-types'
import {
  findSidebarViewNameConflict,
  MAX_SIDEBAR_VIEW_NAME_LENGTH,
  type SidebarSavedView,
  type SidebarViewLiveSettings
} from '../../../../shared/sidebar-saved-views'
import {
  GROUP_BY_OPTIONS,
  PROJECT_ORDER_OPTIONS,
  SORT_OPTIONS
} from './sidebar-workspace-option-items'

export type SavedViewSummaryRow = { label: string; value: string }

function optionLabel(
  options: readonly { id: string; label: string }[],
  id: string
): string | undefined {
  return options.find((option) => option.id === id)?.label
}

function projectsLabel(filterRepoIds: readonly string[], repos: readonly Repo[]): string {
  const names = repos.filter((repo) => filterRepoIds.includes(repo.id)).map((r) => r.displayName)
  return names.length > 0
    ? names.join(', ')
    : translate('sidebar.savedViews.allProjects', 'All projects')
}

// Reuses the Filters section's own labels so the summary reads like the menu it captures.
function hiddenLabels(live: SidebarViewLiveSettings): string[] {
  const labels: string[] = []
  if (!live.showSleepingWorkspaces) {
    labels.push(
      translate('auto.components.sidebar.SidebarWorkspaceFilterSection.ed1611b65b', 'Hide sleeping')
    )
  }
  if (live.hideDefaultBranchWorkspace) {
    labels.push(
      translate(
        'auto.components.sidebar.SidebarWorkspaceFilterSection.c3fa13dc2e',
        'Hide default branch'
      )
    )
  }
  if (live.hideAutomationGeneratedWorkspaces) {
    labels.push(
      translate(
        'auto.components.sidebar.SidebarWorkspaceFilterSection.automationCreated',
        'Hide automation-created'
      )
    )
  }
  if (live.hideCliCreatedWorkspaces) {
    labels.push(
      translate(
        'auto.components.sidebar.SidebarWorkspaceFilterSection.cliCreated',
        'Hide CLI-created'
      )
    )
  }
  if (live.hideWorkspacesFromOtherDevices) {
    labels.push(
      translate(
        'auto.components.sidebar.SidebarWorkspaceFilterSection.otherClients',
        'Hide other-client workspaces'
      )
    )
  }
  if (live.hideDetachedHeadWorkspaces) {
    labels.push(
      translate(
        'auto.components.sidebar.SidebarWorkspaceFilterSection.detachedHead',
        'Hide detached HEAD'
      )
    )
  }
  return labels
}

/** What the save dialog shows; optional rows appear only when they carry information. */
export function buildSavedViewSummary(args: {
  live: SidebarViewLiveSettings
  repos: readonly Repo[]
  hostsLabel: string | null
}): SavedViewSummaryRow[] {
  const { live, repos, hostsLabel } = args
  const rows: SavedViewSummaryRow[] = [
    {
      label: translate('sidebar.savedViews.summaryProjects', 'Projects'),
      value: projectsLabel(live.filterRepoIds, repos)
    },
    {
      label: translate(
        'auto.components.sidebar.SidebarWorkspaceOptionsMenu.dc0bb670bc',
        'Group by'
      ),
      value: optionLabel(GROUP_BY_OPTIONS, live.groupBy) ?? live.groupBy
    },
    {
      label: translate('auto.components.sidebar.SidebarWorkspaceOptionsMenu.7bada3b1ab', 'Sort by'),
      value: optionLabel(SORT_OPTIONS, live.sortBy) ?? live.sortBy
    }
  ]
  if (live.groupBy === 'repo') {
    rows.push({
      label: translate(
        'auto.components.sidebar.SidebarWorkspaceOptionsMenu.09faabd875',
        'Project order'
      ),
      value: optionLabel(PROJECT_ORDER_OPTIONS, live.projectOrderBy) ?? live.projectOrderBy
    })
  }
  const hidden = hiddenLabels(live)
  if (hidden.length > 0) {
    rows.push({
      label: translate('sidebar.savedViews.summaryHidden', 'Hidden'),
      value: hidden.join(', ')
    })
  }
  if (hostsLabel) {
    rows.push({ label: translate('sidebar.savedViews.summaryHosts', 'Hosts'), value: hostsLabel })
  }
  return rows
}

/** "homelab · Status": first filtered project (or All projects) and the grouping, made unique. */
export function suggestSavedViewName(args: {
  live: SidebarViewLiveSettings
  repos: readonly Repo[]
  views: readonly SidebarSavedView[]
}): string {
  const { live, repos, views } = args
  const firstProject = repos.find((repo) => live.filterRepoIds.includes(repo.id))?.displayName
  const scope = firstProject ?? translate('sidebar.savedViews.allProjects', 'All projects')
  const grouping = optionLabel(GROUP_BY_OPTIONS, live.groupBy) ?? live.groupBy
  const base = `${scope} · ${grouping}`.slice(0, MAX_SIDEBAR_VIEW_NAME_LENGTH - 3)
  let candidate = base
  for (let suffix = 2; findSidebarViewNameConflict(views, candidate); suffix++) {
    candidate = `${base} ${suffix}`
  }
  return candidate
}
