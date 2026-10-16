import { expect, test } from '@playwright/test'

// PLAN-ROADMAP Phase 3: Import from Databases card. The backend route is
// intercepted (no internet in CI) — the test checks the request the card
// sends and that the returned network loads.

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

const NETWORK = {
  nodes: [
    { id: 'TP53_STRING', label: 'TP53', layer: 'STRING' },
    { id: 'MDM2_STRING', label: 'MDM2', layer: 'STRING' },
  ],
  edges: [
    edge('MDM2', 'STRING', 'TP53', 'STRING', 'Experiments'),
    edge('MDM2', 'STRING', 'TP53', 'STRING', 'Text mining'),
  ],
  layers: ['STRING'],
  channels: ['Experiments', 'Text mining'],
  warnings: [],
}

test('STRING import sends evidence channels and loads the network', async ({
  page,
}) => {
  let body: Record<string, unknown> | null = null
  await page.route('**/api/import/string', async (route) => {
    body = route.request().postDataJSON() as Record<string, unknown>
    await route.fulfill({ json: NETWORK })
  })

  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await page
    .getByRole('tab', { name: 'Databases', includeHidden: true, exact: true })
    .click()
  await page.locator('#db_identifiers').fill('TP53, MDM2\nATM')
  await page.locator('#db_ch_pscore').uncheck()
  await page.locator('#db_import_string').click()

  await expect(page.locator('#db_status')).toContainText(
    'Loaded network: 1 layers, 2 nodes, 2 edges.'
  )
  expect(body).toMatchObject({
    identifiers: ['TP53', 'MDM2', 'ATM'],
    species: 9606,
    required_score: 0.4,
    add_nodes: 0,
  })
  expect((body as unknown as { channels: string[] }).channels).not.toContain(
    'pscore'
  )
  const count = await page.evaluate(
    () =>
      (window as unknown as { __arena: { ctx: { nodeObjects: unknown[] } } })
        .__arena.ctx.nodeObjects.length
  )
  expect(count).toBe(2)
})

test('one-layer-per-database importer sends the ticked databases; errors show detail', async ({
  page,
}) => {
  let body: Record<string, unknown> | null = null
  await page.route('**/api/import/databases', async (route) => {
    body = route.request().postDataJSON() as Record<string, unknown>
    await route.fulfill({
      status: 400,
      json: {
        detail: 'No interactions found for these identifiers and settings.',
      },
    })
  })

  await page.goto('/')
  await page
    .getByRole('tab', { name: 'Databases', includeHidden: true, exact: true })
    .click()
  // each source is its own card; proteins typed in one card reach the others
  await page.locator('#db_identifiers').fill('TP53 MDM2')
  await page.locator('#card_compare summary').click()
  await expect(page.locator('#db_layer_opts')).toBeVisible()
  await expect(page.locator('#cmp_identifiers')).toHaveValue('TP53 MDM2')
  await page.locator('#db_db_OmniPath').uncheck()
  await page.locator('#db_import_layers').click()

  await expect(page.locator('#db_status')).toHaveText(
    'No interactions found for these identifiers and settings.'
  )
  expect(body).toMatchObject({
    identifiers: ['TP53', 'MDM2'],
    databases: ['STRING', 'IntAct'],
    only_among: true,
  })
})

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
const read = (page: import('@playwright/test').Page) =>
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

test('Import as: a new layer joins the loaded network with links to copies; single 3D network', async ({
  page,
}) => {
  await page.route('**/api/import/string', (route) =>
    route.fulfill({ json: PTGS })
  )
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await page
    .getByRole('tab', { name: 'File', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page
    .locator('#input_network_file')
    .setInputFiles('public/data/aspirin_3channels.tsv')
  await expect(page.locator('#file_status')).toContainText('Loaded network')
  const before = await read(page)

  await page
    .getByRole('tab', { name: 'Databases', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page.locator('#db_mode_layer').check()
  await page.locator('#db_identifiers').fill('PTGS1 PTGS2')
  await page.locator('#db_import_string').click()
  await expect(page.locator('#db_status')).toContainText('Added layer STRING')
  await expect(page.locator('#db_status')).toContainText('links to copies')
  const after = await read(page)
  expect(after.layers).toEqual([...before.layers, 'STRING'])
  expect(after.nodes).toBe(before.nodes + 3)
  // PTGS1 and PTGS2 exist in the aspirin layers: every copy got a link
  expect(after.inter).toBeGreaterThan(before.inter)
  expect(after.single).toBe(false)

  // single 3D network: the import replaces the network and stacks it
  await page
    .getByRole('tab', { name: 'Databases', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page.locator('#db_mode_single').check()
  await page.locator('#db_import_string').click()
  await expect(page.locator('#db_status')).toContainText('as one 3D network')
  await expect.poll(async () => (await read(page)).single).toBe(true)
  expect((await read(page)).layers).toEqual(['STRING'])
})
