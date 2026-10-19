// Every new network first asks "Import as" in a popup (ui/import_as.ts).
// Specs that are not about the popup answer it up front — a new network, as
// before — so their loads run unattended; import-as.spec.ts drives the popup.
// The panels' cards all start folded (ui/sections.ts): specs see them open,
// so they reach every control; `test.use({ openCards: false })` keeps the
// real folded defaults (sections.spec.ts).

import { test as base, type Page } from '@playwright/test'

export * from '@playwright/test'

export const test = base.extend<{ openCards: boolean }>({
  openCards: [true, { option: true }],
  page: async ({ page, openCards }, use) => {
    await page.addInitScript((open) => {
      const w = window as unknown as {
        __arenaImportAs?: string
        __arenaOpenCards?: boolean
      }
      w.__arenaImportAs = 'replace'
      w.__arenaOpenCards = open
    }, openCards)
    await use(page)
  },
})

/** Opens a folded card (a no-op when it is open), as a click on its title would. */
export const openCard = (page: Page, card: string) =>
  page.locator(card).evaluate((d) => {
    ;(d as HTMLDetailsElement).open = true
  })
