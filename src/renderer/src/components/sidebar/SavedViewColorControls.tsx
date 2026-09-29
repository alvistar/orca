import type React from 'react'
import { REPO_COLORS } from '../../../../shared/constants'
import { normalizeRepoBadgeColor } from '../../../../shared/repo-badge-color'
import { ColorPicker } from '@/components/ui/color-picker'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'

/** 8px view marker; a dashed ring stands in for "no color". */
export function SavedViewColorDot({
  color,
  className
}: {
  color: string | undefined
  className?: string
}): React.JSX.Element {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block size-2 shrink-0 rounded-full',
        !color && 'border border-dashed border-muted-foreground',
        className
      )}
      style={color ? { backgroundColor: color } : undefined}
    />
  )
}

const SWATCH_CLASS =
  'size-6 rounded-[4px] outline-none transition-all focus-visible:ring-[3px] focus-visible:ring-ring/50'
const SELECTED_SWATCH_CLASS = 'ring-2 ring-foreground ring-offset-2 ring-offset-background'
const IDLE_SWATCH_CLASS =
  'hover:ring-1 hover:ring-muted-foreground hover:ring-offset-2 hover:ring-offset-background'

/** None + the project badge presets + custom hex, as in project color settings. */
export function SavedViewColorField({
  value,
  onChange,
  labelledBy
}: {
  value: string | null
  onChange: (color: string | null) => void
  labelledBy?: string
}): React.JSX.Element {
  const selected = normalizeRepoBadgeColor(value)
  const isCustom = selected !== null && !REPO_COLORS.some((color) => color === selected)

  return (
    <div role="group" aria-labelledby={labelledBy} className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(null)}
        aria-label={translate('sidebar.savedViews.noColor', 'No color')}
        aria-pressed={selected === null}
        className={cn(
          SWATCH_CLASS,
          'border border-dashed border-muted-foreground',
          selected === null ? SELECTED_SWATCH_CLASS : IDLE_SWATCH_CLASS
        )}
      />
      {REPO_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          aria-label={translate('sidebar.savedViews.useColor', 'Use {{color}}', { color })}
          aria-pressed={selected === color}
          className={cn(
            SWATCH_CLASS,
            selected === color ? SELECTED_SWATCH_CLASS : IDLE_SWATCH_CLASS
          )}
          style={{ backgroundColor: color }}
        />
      ))}
      <ColorPicker
        value={selected ?? REPO_COLORS[0]}
        onChange={onChange}
        label={translate('sidebar.savedViews.customColor', 'Choose a custom color')}
        selected={isCustom}
        triggerLabel={translate('sidebar.savedViews.customColorTrigger', 'Custom')}
        showHexInTrigger={isCustom}
      />
    </div>
  )
}
