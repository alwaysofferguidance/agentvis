export function shouldIgnoreShortcut(event: { defaultPrevented: boolean; ctrlKey: boolean; metaKey: boolean; altKey: boolean; repeat: boolean; key: string; target: EventTarget | null }): boolean {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return true
  const target = event.target
  if (typeof Element !== 'undefined' && target instanceof Element) {
    if (target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')) return event.key !== 'Escape'
    // Space belongs to the focused control, rather than global playback.
    if (event.key === ' ' && target.closest('button, a, [role="button"], [role="slider"]')) return true
  }
  return false
}

export function getTypeToOpenText(event: {
  defaultPrevented: boolean
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  isComposing?: boolean
  key: string
  target: EventTarget | null
}): string | null {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return null
  const target = event.target as (EventTarget & { closest?: (selector: string) => Element | null }) | null
  if (target?.closest?.('input, textarea, select, button, a, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="dialog"], [role="menu"], [role="menuitem"], [data-no-type-to-open]')) return null
  if (event.key === 'Dead' || event.key === 'Process') return ''
  if (event.key.length !== 1 || event.key <= ' ' || event.key === '\u007f') return null
  return event.key
}
