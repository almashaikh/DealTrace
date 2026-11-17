import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router'

import { CommandPalette } from '@/app/CommandPalette'
import { HelpDialog } from '@/app/HelpDialog'
import { Sidebar } from '@/app/Sidebar'
import { Topbar } from '@/app/Topbar'
import { APP_VERSION } from '@/app/version'
import { useSidebar } from '@/app/useSidebar'

export function AppShell() {
  const { collapsed, toggle } = useSidebar()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const { pathname } = useLocation()
  const mainRef = useRef<HTMLElement>(null)

  // Ctrl/Cmd+K toggles the command palette from anywhere.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // The page scrolls inside <main>, so return to the top on navigation.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 })
  }, [pathname])

  return (
    <div className="flex h-screen overflow-hidden bg-app">
      <a
        href="#main"
        className="sr-only z-50 rounded-md border bg-surface px-3 py-2 text-sm text-text focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <Sidebar collapsed={collapsed} onToggle={toggle} onOpenHelp={() => setHelpOpen(true)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenPalette={() => setPaletteOpen(true)} />
        <main id="main" ref={mainRef} tabIndex={-1} className="flex min-h-0 flex-1 flex-col overflow-y-auto outline-none">
          <div className="mx-auto w-full max-w-[1440px] flex-1 px-6 py-6">
            <Outlet />
          </div>
          <footer className="flex shrink-0 items-center gap-2 px-6 pb-4 text-xs leading-4 text-text-muted">
            <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
            DealTrace {APP_VERSION} · Demo data
          </footer>
        </main>
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  )
}
