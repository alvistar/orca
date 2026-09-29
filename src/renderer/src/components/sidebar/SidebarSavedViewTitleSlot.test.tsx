// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SidebarSavedView } from '../../../../shared/sidebar-saved-views'
import { TooltipProvider } from '@/components/ui/tooltip'
import { SidebarSavedViewTitleSlot } from './SidebarSavedViewChip'
import { returnFocusOnClose } from './saved-view-focus-return'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

type MockState = {
  sidebarSavedViews: SidebarSavedView[]
  activeSidebarViewId: string | null
  clearActiveSidebarView: () => void
}

let mockState: MockState
const listeners = new Set<() => void>()

function setMockState(patch: Partial<MockState>): void {
  mockState = { ...mockState, ...patch }
  listeners.forEach((listener) => listener())
}

vi.mock('@/store', async () => {
  const { useSyncExternalStore } = await import('react')
  const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }
  const useAppStore = <T,>(selector: (state: MockState) => T): T =>
    useSyncExternalStore(subscribe, () => selector(mockState))
  useAppStore.getState = () => mockState
  return { useAppStore }
})

// Why: the menu items are the shared switcher list; here they only need to apply a view.
vi.mock('./SidebarSavedViewsMenu', async () => {
  const { DropdownMenuItem } = await import('@/components/ui/dropdown-menu')
  return {
    SidebarSavedViewsMenuItems: () => (
      <>
        {mockState.sidebarSavedViews.map((view) => (
          <DropdownMenuItem
            key={view.id}
            onSelect={() => setMockState({ activeSidebarViewId: view.id })}
          >
            {view.name}
          </DropdownMenuItem>
        ))}
      </>
    )
  }
})

const VIEW: SidebarSavedView = {
  id: 'view-1',
  name: 'Pinguino',
  settings: {
    filterRepoIds: [],
    groupBy: 'workspace-status',
    sortBy: 'recent',
    projectOrderBy: 'manual',
    hideDefaultBranchWorkspace: false
  }
}

let container: HTMLDivElement
let root: Root

function renderSlot(agentsViewActive = false): void {
  act(() => {
    root.render(
      <TooltipProvider>
        <SidebarSavedViewTitleSlot agentsViewActive={agentsViewActive} title="Workspaces">
          <span data-sidebar-section-title="workspaces">Workspaces</span>
        </SidebarSavedViewTitleSlot>
        <button type="button" aria-label="Workspace options" data-saved-view-focus-fallback="" />
      </TooltipProvider>
    )
  })
}

function titleTrigger(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[aria-label="Workspaces, switch saved view"]')
}

function pill(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[aria-label="Saved view: Pinguino. Switch view"]')
}

function openTitleMenu(): void {
  const trigger = titleTrigger()
  act(() => {
    trigger?.focus()
    trigger?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  })
}

async function selectMenuItem(name: string): Promise<void> {
  const item = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
    (node) => node.textContent === name
  )
  expect(item).toBeDefined()
  await act(async () => {
    item?.click()
  })
}

async function flushFrames(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
  })
}

beforeEach(() => {
  mockState = {
    sidebarSavedViews: [VIEW],
    activeSidebarViewId: null,
    clearActiveSidebarView: () => setMockState({ activeSidebarViewId: null })
  }
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  document.body.innerHTML = ''
})

describe('SidebarSavedViewTitleSlot title trigger', () => {
  it('turns the title into a switcher when views exist and none is active', () => {
    renderSlot()
    expect(titleTrigger()).not.toBeNull()
  })

  it('keeps the plain title when no view is saved', () => {
    setMockState({ sidebarSavedViews: [] })
    renderSlot()
    expect(titleTrigger()).toBeNull()
    expect(document.querySelector('[data-sidebar-section-title]')?.closest('button')).toBeNull()
  })

  it('keeps the plain title in the Activity body', () => {
    renderSlot(true)
    expect(titleTrigger()).toBeNull()
  })

  it('hands the switcher role to the pill while a view is active', () => {
    setMockState({ activeSidebarViewId: VIEW.id })
    renderSlot()
    const switchers = document.querySelectorAll('[data-saved-view-switcher]')
    expect(switchers).toHaveLength(1)
    expect(switchers[0].getAttribute('aria-label')).toBe('Saved view: Pinguino. Switch view')
    expect(titleTrigger()?.closest('[inert]')).not.toBeNull()
  })
})

describe('SidebarSavedViewTitleSlot focus', () => {
  it('moves focus to the pill after a view is applied from the title menu', async () => {
    renderSlot()
    openTitleMenu()
    await selectMenuItem('Pinguino')
    await flushFrames()
    expect(document.activeElement).toBe(pill())
  })

  it('moves focus to the pill when a shortcut applies a view while the title is focused', async () => {
    renderSlot()
    act(() => titleTrigger()?.focus())
    act(() => setMockState({ activeSidebarViewId: VIEW.id }))
    await flushFrames()
    expect(document.activeElement).toBe(pill())
  })

  it('moves focus to the title trigger after the pill is cleared', async () => {
    setMockState({ activeSidebarViewId: VIEW.id })
    renderSlot()
    const clear = document.querySelector<HTMLElement>('[aria-label="Clear saved view"]')
    await act(async () => {
      clear?.focus()
      clear?.click()
    })
    await flushFrames()
    expect(document.activeElement).toBe(titleTrigger())
  })

  it('leaves focus alone when the title menu is dismissed by clicking outside', async () => {
    renderSlot()
    openTitleMenu()
    expect(document.querySelector('[role="menu"]')).not.toBeNull()
    // Why: Radix registers its outside-pointer listener a tick after the menu mounts.
    await flushFrames()
    await act(async () => {
      document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    })
    await flushFrames()
    await flushFrames()
    expect(document.querySelector('[role="menu"]')).toBeNull()
    expect(document.activeElement).not.toBe(titleTrigger())
  })
})

describe('saved view dialog focus return', () => {
  function closeDialog(opener: HTMLElement | null): Event {
    const event = new Event('focusout', { cancelable: true })
    act(() => returnFocusOnClose(opener)(event))
    return event
  }

  it('returns focus to an opener that is still shown', async () => {
    renderSlot()
    const opener = titleTrigger()
    const event = closeDialog(opener)
    await flushFrames()
    expect(event.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(opener)
  })

  it('sends focus to the pill when a save started from the title activates the view', async () => {
    renderSlot()
    const opener = titleTrigger()
    act(() => setMockState({ activeSidebarViewId: VIEW.id }))
    closeDialog(opener)
    await flushFrames()
    expect(document.activeElement).toBe(pill())
  })

  it('falls back to Workspace options when managing from the title deletes every view', async () => {
    renderSlot()
    const opener = titleTrigger()
    act(() => setMockState({ sidebarSavedViews: [] }))
    closeDialog(opener)
    await flushFrames()
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Workspace options')
  })
})
