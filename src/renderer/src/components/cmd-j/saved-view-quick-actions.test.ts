import { describe, expect, it, vi } from 'vitest'
import type { SidebarSavedView } from '../../../../shared/sidebar-saved-views'
import type { CmdJQuickActionContext } from './quick-action-context'
import { buildSavedViewQuickActions } from './saved-view-quick-actions'

// oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: saved-view actions never read the palette context.
const NO_CONTEXT = {} as CmdJQuickActionContext

function view(id: string, name: string): SidebarSavedView {
  return {
    id,
    name,
    settings: {
      filterRepoIds: [],
      groupBy: 'repo',
      sortBy: 'recent',
      projectOrderBy: 'manual',
      hideDefaultBranchWorkspace: false
    }
  }
}

function build(overrides: Partial<Parameters<typeof buildSavedViewQuickActions>[0]> = {}) {
  const applyView = vi.fn()
  const openDialog = vi.fn()
  const actions = buildSavedViewQuickActions({
    views: [view('v1', 'Homelab'), view('v2', 'Review')],
    activeId: 'v2',
    shortcutLabel: (index) => (index === 0 ? '⌘⌥1' : null),
    applyView,
    openDialog,
    ...overrides
  })
  return { actions, applyView, openDialog }
}

describe('saved view Cmd+J actions', () => {
  it('lists every view, then Save and Manage', () => {
    const { actions } = build()

    expect(actions.map((a) => a.title)).toEqual([
      'View: Homelab',
      'View: Review',
      'Save current view…',
      'Manage saved views…'
    ])
  })

  it('shows the bound chord and marks the current view', () => {
    const { actions } = build()

    expect(actions[0].description).toBe('Saved sidebar view · ⌘⌥1')
    expect(actions[1].description).toBe('Current')
  })

  it('matches on "view" and the view name', () => {
    const { actions } = build()

    expect(actions[0].verbKeywords).toEqual(expect.arrayContaining(['view', 'Homelab']))
  })

  it('keeps Save and Manage available with no views', () => {
    const { actions } = build({ views: [], activeId: null })

    expect(actions.map((a) => a.title)).toEqual(['Save current view…', 'Manage saved views…'])
    expect(actions[0].isAvailable(NO_CONTEXT)).toEqual({ available: true })
  })

  it('applies a view and opens the dialogs when run', async () => {
    const { actions, applyView, openDialog } = build()

    await expect(actions[0].run(NO_CONTEXT)).resolves.toEqual({ status: 'ok' })
    await actions[2].run(NO_CONTEXT)
    await actions[3].run(NO_CONTEXT)

    expect(applyView).toHaveBeenCalledWith('v1')
    expect(openDialog.mock.calls).toEqual([['save'], ['manage']])
  })
})
