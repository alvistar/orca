import {
  canonicalizeParsedKeybinding,
  DIGIT_INDEX_KEY_PATTERN,
  formatKeybindingList,
  getEffectiveKeybindingsForAction,
  parseKeybinding,
  type KeybindingOverrides
} from '../../../../shared/keybindings'

/** The chord that selects the view at `index`, or null when unbound or past 9. */
export function savedViewShortcutLabel(
  index: number,
  overrides: KeybindingOverrides | undefined,
  platform: NodeJS.Platform
): string | null {
  if (index > 8) {
    return null
  }
  const [binding] = getEffectiveKeybindingsForAction(
    'sidebar.view.selectByIndex',
    platform,
    overrides
  )
  const parsed = binding ? parseKeybinding(binding) : null
  if (!parsed || parsed.doubleTapModifier || !DIGIT_INDEX_KEY_PATTERN.test(parsed.key)) {
    return null
  }
  // The stored chord is a digit-1 representative; show the digit this view answers to.
  const chord = canonicalizeParsedKeybinding({ ...parsed, key: String(index + 1) })
  return formatKeybindingList([chord], platform)
}
