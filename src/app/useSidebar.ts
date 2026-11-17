import { useCallback, useState } from 'react'

const KEY = 'dealtrace.sidebar.collapsed'

function initial(): boolean {
  try {
    const stored = window.localStorage.getItem(KEY)
    if (stored !== null) return stored === '1'
  } catch {
    // ignore
  }
  return window.innerWidth < 1100
}

/** Sidebar collapsed state, remembered between visits. */
export function useSidebar(): { collapsed: boolean; toggle: () => void } {
  const [collapsed, setCollapsed] = useState(initial)
  const toggle = useCallback(() => {
    setCollapsed((c) => {
      try {
        window.localStorage.setItem(KEY, c ? '0' : '1')
      } catch {
        // ignore
      }
      return !c
    })
  }, [])
  return { collapsed, toggle }
}
