// The saved sidebar view 1-9 range: a digit-index row that ships unbound.
import { describe, expect, it } from 'vitest'
import {
  getEffectiveKeybindingsForAction,
  getKeybindingDefinition,
  isDigitIndexActionId,
  matchKeybindingDigitIndex
} from './keybindings'

const ACTION = 'sidebar.view.selectByIndex'

function digitInput(
  digit: string,
  modifiers: { meta?: boolean; control?: boolean; alt?: boolean; shift?: boolean }
): Parameters<typeof matchKeybindingDigitIndex>[1] {
  return {
    key: digit,
    code: `Digit${digit}`,
    meta: Boolean(modifiers.meta),
    control: Boolean(modifiers.control),
    alt: Boolean(modifiers.alt),
    shift: Boolean(modifiers.shift)
  }
}

describe('select saved view 1-9 shortcut', () => {
  it('is a digit-index row titled for the keybindings settings', () => {
    expect(isDigitIndexActionId(ACTION)).toBe(true)
    expect(getKeybindingDefinition(ACTION)?.title).toBe('Select Saved View 1–9')
  })

  it('ships unbound on every platform', () => {
    for (const platform of ['darwin', 'linux', 'win32'] as const) {
      expect(getEffectiveKeybindingsForAction(ACTION, platform)).toEqual([])
      expect(
        matchKeybindingDigitIndex(ACTION, digitInput('1', { meta: true, alt: true }), platform)
      ).toBeNull()
    }
  })

  it('maps any digit of a bound chord to its 0-based view position', () => {
    const overrides = { [ACTION]: ['Mod+Alt+1'] }

    expect(
      matchKeybindingDigitIndex(
        ACTION,
        digitInput('3', { meta: true, alt: true }),
        'darwin',
        overrides
      )
    ).toBe(2)
    expect(
      matchKeybindingDigitIndex(
        ACTION,
        digitInput('9', { control: true, alt: true }),
        'linux',
        overrides
      )
    ).toBe(8)
  })

  it('fires with terminal focus under the default orca-first policy', () => {
    const overrides = { [ACTION]: ['Mod+Alt+1'] }

    expect(
      matchKeybindingDigitIndex(
        ACTION,
        digitInput('2', { meta: true, alt: true }),
        'darwin',
        overrides,
        { context: 'terminal', terminalShortcutPolicy: 'orca-first' }
      )
    ).toBe(1)
  })
})
