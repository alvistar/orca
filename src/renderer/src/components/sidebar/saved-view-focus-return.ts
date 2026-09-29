/**
 * The element that opened the menu `from` sits in: walks aria-labelledby up through submenus
 * (whose triggers unmount with the menu) to the root trigger, which survives the close.
 */
export function findMenuRootTrigger(from: Element | null): HTMLElement | null {
  let menu = from?.closest('[role="menu"]') ?? null
  while (menu) {
    const labelledBy = menu.getAttribute('aria-labelledby')
    const trigger = labelledBy ? document.getElementById(labelledBy) : null
    if (!trigger) {
      return null
    }
    const parentMenu = trigger.closest('[role="menu"]')
    if (!parentMenu) {
      return trigger
    }
    menu = parentMenu
  }
  return null
}

/**
 * Radix `onCloseAutoFocus` handler: send focus to the opener instead of the document body.
 * An opener the dialog hid (the title, once a save activates a view) hands off to the switcher.
 */
export function returnFocusOnClose(returnFocusTo: HTMLElement | null) {
  return (event: Event): void => {
    event.preventDefault()
    if (returnFocusTo && !isHiddenFocusTarget(returnFocusTo)) {
      returnFocusTo.focus()
      return
    }
    requestAnimationFrame(() => focusSavedViewSwitcher())
  }
}

/** Hidden by slot state, not computed style: fading layers stay mounted and are marked inert. */
export function isHiddenFocusTarget(element: Element | null): boolean {
  return !element || !element.isConnected || element.closest('[inert]') !== null
}

/**
 * Focuses the saved view switcher on show (pill or title), else the Workspace options trigger.
 * Unless forced, only acts when focus was lost, so it never steals it from an opening dialog.
 */
export function focusSavedViewSwitcher({ force = false }: { force?: boolean } = {}): void {
  const active = document.activeElement
  if (!force && active && active !== document.body && !isHiddenFocusTarget(active)) {
    return
  }
  const candidates = document.querySelectorAll<HTMLElement>(
    '[data-saved-view-switcher], [data-saved-view-focus-fallback]'
  )
  const target =
    [...candidates].find(
      (node) => node.hasAttribute('data-saved-view-switcher') && !isHiddenFocusTarget(node)
    ) ?? [...candidates].find((node) => !isHiddenFocusTarget(node))
  target?.focus({ preventScroll: true })
}
