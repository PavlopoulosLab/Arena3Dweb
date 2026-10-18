// Every new network first asks "Import as" in a popup (ui/import_as.ts).
// Specs that are not about the popup answer it up front — a new network, as
// before — so their loads run unattended; import-as.spec.ts drives the popup.

import { test as base } from '@playwright/test'

export * from '@playwright/test'

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      ;(window as unknown as { __arenaImportAs?: string }).__arenaImportAs =
        'replace'
    })
    await use(page)
  },
})
