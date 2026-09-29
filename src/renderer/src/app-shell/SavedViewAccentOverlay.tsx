import type React from 'react'
import { useState } from 'react'
import { useActiveSidebarView } from '../components/sidebar/SidebarSavedViewChip'
import { cn } from '@/lib/utils'

/** 2px window frame in the active saved view's color; decorative, never takes input or layout. */
export function SavedViewAccentOverlay(): React.JSX.Element | null {
  const activeView = useActiveSidebarView()
  const color = activeView?.color ?? null
  // Why: keep the last color so a clear fades the frame out; a switch to an uncolored view cuts it.
  const [lastColor, setLastColor] = useState(color)
  const nextLastColor = activeView ? color : lastColor
  if (nextLastColor !== lastColor) {
    setLastColor(nextLastColor)
  }
  const frameColor = color ?? nextLastColor
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
