/** True on Apple devices, where the palette shortcut is Cmd+K instead of Ctrl+K. */
export const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)
export const PALETTE_KEY_LABEL = IS_MAC ? '⌘K' : 'Ctrl K'
