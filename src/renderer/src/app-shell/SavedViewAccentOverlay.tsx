import type React from 'react'
import { useState } from 'react'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'

/** 2px window frame in the active saved view's color; decorative, never takes input or layout. */
export function SavedViewAccentOverlay(): React.JSX.Element | null {
  const color = useAppStore(
    (s) => s.sidebarSavedViews.find((view) => view.id === s.activeSidebarViewId)?.color ?? null
  )
  // Why: keep the last color so a clear fades the frame out instead of cutting it.
  const [lastColor, setLastColor] = useState(color)
  if (color && color !== lastColor) {
    setLastColor(color)
  }
  const frameColor = color ?? lastColor
  if (!frameColor) {
    return null
  }
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none fixed inset-0 z-40 border-2',
        color
          ? 'opacity-100'
          : 'opacity-0 motion-safe:transition-opacity motion-safe:duration-150 motion-safe:ease-out'
      )}
      style={{ borderColor: frameColor }}
    />
  )
}
