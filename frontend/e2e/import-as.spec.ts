import { expect, test, type Page } from '@playwright/test'

// Every load — a file, an example, a database import, a saved session — first
// asks in a popup (ui/import_as.ts) how to show it (multilayered or single 3D)
// and whether it replaces the current network or is added to it. This spec
// drives the real popup; the other specs preset it through e2e/fixtures.ts.

function edge(s: string, sl: string, t: string, tl: string, channel: string) {
  return {
    src: `${s}_${sl}`,
    trg: `${t}_${tl}`,
    source_node: s,
    source_layer: sl,
    target_node: t,
    target_layer: tl,
    weight: 0.9,
    scaled_weight: 0.9,
    channel,
  }
}

const PTGS = {
  nodes: [
    { id: 'PTGS1_STRING', label: 'PTGS1', layer: 'STRING' },
    { id: 'PTGS2_STRING', label: 'PTGS2', layer: 'STRING' },
    { id: 'NEWGENE_STRING', label: 'NEWGENE', layer: 'STRING' },
  ],
  edges: [
    { ...edge('PTGS1', 'STRING', 'PTGS2', 'STRING', ''), channel: null },
    { ...edge('PTGS2', 'STRING', 'NEWGENE', 'STRING', ''), channel: null },
  ],
  layers: ['STRING'],
  channels: [],
  warnings: [],
}

type Ctx = {
  layers: { name: string }[]
  nodeObjects: unknown[]
  edgeObjects: { interLayer: boolean }[]
}
const read = (page: Page) =>
  page.evaluate(() => {
    const c = (window as unknown as { __arena: { ctx: Ctx } }).__arena.ctx
    return {
      layers: c.layers.map((l) => l.name),
      nodes: c.nodeObjects.length,
      edges: c.edgeObjects.length,
      inter: c.edgeObjects.filter((e) => e.interLayer).length,
      single: document.body.classList.contains('mode-single'),
    }
  })

const dialog = (page: Page) => page.locator('#importAsDialog')

async function start(page: Page): Promise<void> {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
}

async function stringImport(page: Page, proteins: string): Promise<void> {
  await page
    .getByRole('tab', {
      name: 'Database Importers',
      includeHidden: true,
      exact: true,
    })
    .dispatchEvent('click')
  const card = page.locator('#card_string')
  if ((await card.getAttribute('open')) === null)
    await page.locator('#card_string > summary').click()
  await page.locator('#db_identifiers').fill(proteins)
  await page.locator('#db_import_string').click()
}

const choose = async (
  page: Page,
  show: 'multilayer' | 'single3d',
  where: 'replace' | 'add'
) => {
  await expect(dialog(page)).toBeVisible()
  await page.locator(`#importAs_${show}`).check()
  await page.locator(`#importAs_${where}`).check()
  await page.locator('#importAsOk').click()
}

test('a file upload always asks; Cancel loads nothing', async ({ page }) => {
  await start(page)
  await page
    .getByRole('tab', { name: 'File', includeHidden: true, exact: true })
    .dispatchEvent('click')
  const input = page.locator('#input_network_file')
  await input.setInputFiles('public/data/aspirin_3channels.tsv')

  await expect(dialog(page)).toBeVisible()
  await expect(dialog(page)).toContainText('aspirin_3channels.tsv')
  // both views are offered; nothing loaded yet, so nothing to add to
  await expect(page.locator('#importAs_multilayer')).toBeChecked()
  await expect(page.locator('#importAs_single3d')).toBeEnabled()
  await expect(page.locator('#importAs_replace')).toBeChecked()
  await expect(page.locator('#importAs_add')).toBeDisabled()
  await expect(page.locator('#importAsAddNote')).toBeVisible()
  await page.locator('#importAsCancel').click()
  await expect(dialog(page)).toBeHidden()
  expect((await read(page)).nodes).toBe(0)
  await expect(input).toHaveValue('') // the same file can be picked again

  await input.setInputFiles('public/data/aspirin_3channels.tsv')
  // a new network is laid out with Fruchterman-Reingold unless unticked; a
  // file keeps its own inter-layer edges unless same-name links are asked for
  await expect(page.locator('#importAs_layout')).toBeChecked()
  await expect(page.locator('#importAs_link')).not.toBeChecked()
  await choose(page, 'multilayer', 'replace')
  await expect(page.locator('#file_status')).toContainText('Loaded network')
  await expect(page.locator('#file_status')).toContainText(
    'Laid out with Fruchterman-Reingold'
  )
  expect((await read(page)).nodes).toBeGreaterThan(0)
  expect((await read(page)).single).toBe(false)
})

const COMPARED = {
  nodes: [
    { id: 'TP53_STRING', label: 'TP53', layer: 'STRING' },
    { id: 'MDM2_STRING', label: 'MDM2', layer: 'STRING' },
    { id: 'TP53_IntAct', label: 'TP53', layer: 'IntAct' },
    { id: 'MDM2_IntAct', label: 'MDM2', layer: 'IntAct' },
  ],
  edges: [
    { ...edge('TP53', 'STRING', 'MDM2', 'STRING', ''), channel: null },
    { ...edge('TP53', 'IntAct', 'MDM2', 'IntAct', ''), channel: null },
    // the importer links copies of a protein (MDM2's link is missing)
    { ...edge('TP53', 'STRING', 'TP53', 'IntAct', ''), channel: null },
  ],
  layers: ['STRING', 'IntAct'],
  channels: [],
  warnings: [],
}

test('same-name links across layers: completed, or left out', async ({
  page,
}) => {
  await page.route('**/api/import/databases', (route) =>
    route.fulfill({ json: COMPARED })
  )
  await start(page)
  const compare = async () => {
    await page
      .getByRole('tab', {
        name: 'Database Importers',
        includeHidden: true,
        exact: true,
      })
      .dispatchEvent('click')
    if ((await page.locator('#card_compare').getAttribute('open')) === null)
      await page.locator('#card_compare > summary').click()
    await page.locator('#cmp_identifiers').fill('TP53 MDM2')
    await page.locator('#db_import_layers').click()
    await expect(dialog(page)).toBeVisible()
  }
  // database imports: linked by default, the missing MDM2 link added
  await compare()
  await expect(page.locator('#importAs_link')).toBeChecked()
  await page.locator('#importAs_layout').uncheck()
  await choose(page, 'multilayer', 'replace')
  await expect(page.locator('#db_status')).toContainText('Linked 1 copy')
  expect((await read(page)).inter).toBe(2)

  // unticked: the importer's own links are left out too
  await compare()
  await page.locator('#importAs_link').uncheck()
  await page.locator('#importAs_layout').uncheck()
  await choose(page, 'multilayer', 'replace')
  await expect.poll(async () => (await read(page)).inter).toBe(0)
})

test('database imports: cancel, add as layers, single 3D, back to layers', async ({
  page,
}) => {
  let fetched = 0
  await page.route('**/api/import/string', (route) => {
    fetched++
    return route.fulfill({ json: PTGS })
  })
  await start(page)
  await page
    .getByRole('tab', { name: 'File', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page
    .locator('#input_network_file')
    .setInputFiles('public/data/aspirin_3channels.tsv')
  await choose(page, 'multilayer', 'replace')
  await expect(page.locator('#file_status')).toContainText('Loaded network')
  const before = await read(page)

  // a cancelled popup fetches nothing
  await stringImport(page, 'PTGS1 PTGS2')
  await expect(dialog(page)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog(page)).toBeHidden()
  expect(fetched).toBe(0)

  // multilayered + add: new layer(s), copies linked across layers
  await page.locator('#db_import_string').click()
  await expect(page.locator('#importAs_add')).toBeEnabled()
  await expect(page.locator('#importAs_addLabel')).toContainText('new layer')
  await choose(page, 'multilayer', 'add')
  await expect(page.locator('#db_status')).toContainText('Added layer STRING')
  await expect(page.locator('#db_status')).toContainText('links to copies')
  const after = await read(page)
  expect(after.layers).toEqual([...before.layers, 'STRING'])
  expect(after.nodes).toBe(before.nodes + 3)
  // PTGS1 and PTGS2 exist in the aspirin layers: every copy got a link
  expect(after.inter).toBeGreaterThan(before.inter)
  expect(after.single).toBe(false)

  // the popup offers the previous answers; single 3D + replace redraws
  await stringImport(page, 'PTGS1 PTGS2')
  await expect(page.locator('#importAs_multilayer')).toBeChecked()
  await expect(page.locator('#importAs_add')).toBeChecked()
  await choose(page, 'single3d', 'replace')
  await expect(page.locator('#db_status')).toContainText('as one 3D network')
  await expect.poll(async () => (await read(page)).single).toBe(true)
  expect((await read(page)).layers).toEqual(['STRING'])

  // from the single 3D network, the popup still offers multilayered: adding
  // as layers puts everything back on floors
  await stringImport(page, 'PTGS1 PTGS2')
  await expect(page.locator('#importAs_single3d')).toBeChecked()
  await choose(page, 'multilayer', 'add')
  await expect(page.locator('#db_status')).toContainText('Added layer')
  await expect.poll(async () => (await read(page)).single).toBe(false)
  expect((await read(page)).layers).toHaveLength(2)
  expect(fetched).toBe(3)
})

test('a one-layer network shown multilayered sits on a floor, without asking again', async ({
  page,
}) => {
  await page.route('**/api/import/string', (route) =>
    route.fulfill({ json: PTGS })
  )
  await start(page)
  await stringImport(page, 'PTGS1 PTGS2')
  await choose(page, 'multilayer', 'replace')
  await expect(page.locator('#db_status')).toContainText('Loaded network')
  // the popup answered the one-layer question already
  await expect(page.locator('#oneLayerPrompt')).toBeHidden()
  await expect.poll(async () => (await read(page)).single).toBe(false)
  const floor = await page.evaluate(
    () =>
      (
        window as unknown as {
          __arena: { ctx: { layers: { floorVisible: boolean }[] } }
        }
      ).__arena.ctx.layers[0].floorVisible
  )
  expect(floor).toBe(true)
})

const MORE = {
  nodes: [
    { id: 'PTGS2_STRING', label: 'PTGS2', layer: 'STRING' },
    { id: 'EXTRA_STRING', label: 'EXTRA', layer: 'STRING' },
  ],
  edges: [
    { ...edge('PTGS2', 'STRING', 'EXTRA', 'STRING', ''), channel: null },
    // already in the view: not added twice
    { ...edge('PTGS1', 'STRING', 'PTGS2', 'STRING', ''), channel: null },
  ],
  layers: ['STRING'],
  channels: [],
  warnings: [],
}

const positions = (page: Page) =>
  page.evaluate(() =>
    Object.fromEntries(
      (
        window as unknown as {
          __arena: {
            ctx: {
              nodeObjects: {
                name: string
                getPosition: (a: string) => number
              }[]
            }
          }
        }
      ).__arena.ctx.nodeObjects.map((n) => [
        n.name,
        ['x', 'y', 'z'].map((a) => Math.round(n.getPosition(a) * 1000) / 1000),
      ])
    )
  )

test('single 3D + add expands the view; what is there stays put', async ({
  page,
}) => {
  let calls = 0
  await page.route('**/api/import/string', (route) =>
    route.fulfill({ json: calls++ === 0 ? PTGS : MORE })
  )
  await start(page)
  await stringImport(page, 'PTGS1 PTGS2')
  await choose(page, 'single3d', 'replace')
  await expect(page.locator('#db_status')).toContainText('as one 3D network')
  await expect.poll(async () => (await read(page)).single).toBe(true)
  const before = await positions(page)

  await stringImport(page, 'PTGS2')
  // both views are still offered
  await expect(page.locator('#importAs_multilayer')).toBeEnabled()
  await expect(page.locator('#importAs_single3d')).toBeChecked()
  await page.locator('#importAs_add').check()
  await expect(page.locator('#importAs_addLabel')).toContainText('stays put')
  await page.locator('#importAsOk').click()
  await expect(page.locator('#db_status')).toContainText(
    'Expanded the view: 1 new node, 1 new edge'
  )
  const after = await positions(page)
  for (const name of Object.keys(before))
    expect(after[name]).toEqual(before[name])
  expect(Object.keys(after).sort()).toEqual([
    'EXTRA',
    'NEWGENE',
    'PTGS1',
    'PTGS2',
  ])
  const now = await read(page)
  expect(now.layers).toEqual(['STRING'])
  expect(now.single).toBe(true)
  // next time the popup offers the same answers
  await stringImport(page, 'PTGS2')
  await expect(page.locator('#importAs_single3d')).toBeChecked()
  await expect(page.locator('#importAs_add')).toBeChecked()
  await page.locator('#importAsCancel').click()
})

test('a saved session asks the view too, and always replaces', async ({
  page,
}) => {
  await start(page)
  await page
    .getByRole('tab', { name: 'File', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page
    .locator('#load_network_file')
    .setInputFiles('public/data/figure2A_export.json')
  await expect(dialog(page)).toBeVisible()
  await expect(page.locator('#importAs_add')).toBeDisabled()
  await expect(page.locator('#importAsAddNote')).toHaveText(
    'A saved session replaces the current network.'
  )
  await choose(page, 'single3d', 'replace')
  await expect(page.locator('#file_status')).toContainText('Session loaded')
  await expect.poll(async () => (await read(page)).single).toBe(true)

  // and as a multilayered network: on floors
  await page
    .locator('#load_network_file')
    .setInputFiles('public/data/figure1_export.json')
  await expect(page.locator('#importAs_single3d')).toBeChecked()
  await choose(page, 'multilayer', 'replace')
  await expect.poll(async () => (await read(page)).single).toBe(false)
})
