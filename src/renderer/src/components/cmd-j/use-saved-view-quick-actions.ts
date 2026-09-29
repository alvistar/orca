import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '@/store'
import { getShortcutPlatform } from '@/hooks/useShortcutLabel'
import { savedViewShortcutLabel } from '@/components/sidebar/saved-view-shortcut-labels'
import { resolvePaletteFocusRestoreTarget } from './palette-focus-restore-target'
import { buildSavedViewQuickActions } from './saved-view-quick-actions'
import type { CmdJQuickAction } from './quick-actions'

function focusedWorkSurface(target: EventTarget | null): HTMLElement | null {
  return target instanceof HTMLElement &&
    target !== document.body &&
    !target.closest('[role="dialog"]')
    ? target
    : null
}

/** Saved-view rows for Cmd+J; focus goes back to the surface in use before the palette opened. */
export function useSavedViewQuickActions(): CmdJQuickAction[] {
  const views = useAppStore((s) => s.sidebarSavedViews)
  const activeId = useAppStore((s) => s.activeSidebarViewId)
  const keybindings = useAppStore((s) => s.keybindings)
  // Why: seeded at render, before the palette takes focus on its first (lazy) mount.
  const [initialWorkSurface] = useState(() => focusedWorkSurface(document.activeElement))
  const lastWorkSurfaceRef = useRef(initialWorkSurface)

  useEffect(() => {
    // Why: palette quick actions skip the palette's own focus restore, so track the last
    // focused element outside any dialog (the palette included) to hand focus back to.
    const onFocusIn = (event: FocusEvent): void => {
      lastWorkSurfaceRef.current = focusedWorkSurface(event.target) ?? lastWorkSurfaceRef.current
    }
    document.addEventListener('focusin', onFocusIn, true)
    return () => document.removeEventListener('focusin', onFocusIn, true)
  }, [])

  return useMemo(() => {
    const workSurface = (): HTMLElement | null =>
      resolvePaletteFocusRestoreTarget(lastWorkSurfaceRef.current)
    const platform = getShortcutPlatform()
    return buildSavedViewQuickActions({
      views,
      activeId,
      shortcutLabel: (index) => savedViewShortcutLabel(index, keybindings, platform),
      applyView: (id) => {
        useAppStore.getState().applySidebarView(id)
        // Two frames: let the palette dialog finish its own close focus handling first.
        requestAnimationFrame(() =>
          requestAnimationFrame(() => workSurface()?.focus({ preventScroll: true }))
        )
      },
      openDialog: (kind) => useAppStore.getState().openSavedViewDialog(kind, workSurface())
    })
  }, [activeId, keybindings, views])
}
