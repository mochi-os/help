import { createFileRoute, Outlet } from '@tanstack/react-router'
import { LocaleProvider, ThemeProvider, isInShell } from '@mochi/web'

export const Route = createFileRoute('/document')({
  component: DocumentLayout,
})

function DocumentLayout() {
  return (
    <ThemeProvider>
      <LocaleProvider>
        <div
          className={`flex h-svh flex-col overflow-auto${isInShell() ? ' md:ps-24' : ''}`}
        >
          <Outlet />
        </div>
      </LocaleProvider>
    </ThemeProvider>
  )
}
