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

/** Radix `onCloseAutoFocus` handler: send focus to the opener instead of the document body. */
export function returnFocusOnClose(returnFocusTo: HTMLElement | null) {
  return (event: Event): void => {
    if (returnFocusTo?.isConnected) {
      event.preventDefault()
      returnFocusTo.focus()
    }
  }
}
