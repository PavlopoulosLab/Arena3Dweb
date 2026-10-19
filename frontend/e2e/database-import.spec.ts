import { expect, openCard, test } from './fixtures'

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
    .getByRole('tab', {
      name: 'Database Importers',
      includeHidden: true,
      exact: true,
    })
    .click()
  await openCard(page, '#card_string')
  await page.locator('#db_identifiers').fill('TP53, MDM2\nATM')
  await page
    .locator('#card_string summary:has-text("Evidence channels")')
    .click()
  await page.locator('#db_ch_pscore').uncheck()
  await page.locator('#db_import_string').click()

  await expect(page.locator('#db_status')).toContainText(
    'Loaded network: 1 layers, 2 nodes, 2 edges.'
  )
  expect(body).toMatchObject({
    identifiers: ['TP53', 'MDM2', 'ATM'],
    species: 9606,
    network_type: 'functional',
    required_score: 0.4,
    add_nodes: 20,
    edge_mode: 'channels',
    descriptions: true,
    address: null,
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
    .getByRole('tab', {
      name: 'Database Importers',
      includeHidden: true,
      exact: true,
    })
    .click()
  // each source is its own card; proteins typed in one card reach the others
  await openCard(page, '#card_string')
  await page.locator('#db_identifiers').fill('TP53 MDM2')
  await openCard(page, '#card_compare')
  await expect(page.locator('#db_layer_opts')).toBeVisible()
  await expect(page.locator('#cmp_identifiers')).toHaveValue('TP53 MDM2')
  await page.locator('#db_db_OmniPath').uncheck()
  await page.locator('#db_import_layers').click()

  await expect(page.locator('#db_status')).toHaveText(
    'No interactions found for these identifiers and settings.'
  )
  // said in the card too, under its button
  await expect(page.locator('#msg_compare')).toHaveText(
    'No interactions found for these identifiers and settings.'
  )
  expect(body).toMatchObject({
    identifiers: ['TP53', 'MDM2'],
    databases: ['STRING', 'IntAct'],
    only_among: true,
  })
})

test('a query without input says so in its card and outlines the field', async ({
  page,
}) => {
  let requests = 0
  await page.route('**/api/import/**', (route) => {
    requests++
    return route.abort()
  })
  await page.route('**/api/sets/**', (route) => {
    requests++
    return route.abort()
  })
  await page.goto('/')
  await page
    .getByRole('tab', {
      name: 'Database Importers',
      includeHidden: true,
      exact: true,
    })
    .click()
  for (const [card, button, field, message] of [
    ['string', '#db_import_string', '#db_identifiers', 'protein names'],
    ['intact', '#db_import_intact', '#intact_identifiers', 'protein names'],
    [
      'omnipath',
      '#db_import_omnipath',
      '#omnipath_identifiers',
      'protein names',
    ],
    ['compare', '#db_import_layers', '#cmp_identifiers', 'protein names'],
    ['reactome', '#reactome_search', '#reactome_query', 'two characters'],
    ['reactome', '#db_import_reactome', '#reactome_ids', 'Reactome pathway'],
    ['go', '#go_search', '#go_query', 'two characters'],
    ['go', '#db_import_go', '#go_ids', 'GO term'],
    ['ndex', '#ndex_import_button', '#ndex_uuid', 'NDEx network UUID'],
  ] as const) {
    await openCard(page, `#card_${card}`)
    await page.locator(button).click()
    await expect(page.locator(`#msg_${card}`)).toContainText(message)
    await expect(page.locator(`#msg_${card}`)).toHaveClass(/text-danger/)
    await expect(page.locator(field)).toHaveClass(/is-invalid/)
    await expect(page.locator(field)).toBeFocused()
  }
  // typing clears the outline; nothing was sent
  await page.locator('#ndex_uuid').fill('x')
  await expect(page.locator('#ndex_uuid')).not.toHaveClass(/is-invalid/)
  expect(requests).toBe(0)
})

test('NDEx examples load with one click; OmniPath offers its organisms only', async ({
  page,
}) => {
  let body: Record<string, unknown> | null = null
  await page.route('**/api/import/ndex', async (route) => {
    body = route.request().postDataJSON() as Record<string, unknown>
    await route.fulfill({ json: NETWORK })
  })
  await page.goto('/')
  await page
    .getByRole('tab', {
      name: 'Database Importers',
      includeHidden: true,
      exact: true,
    })
    .click()
  await openCard(page, '#card_omnipath')
  await expect(page.locator('#omnipath_species option')).toHaveText([
    'Human',
    'Mouse',
    'Rat',
  ])
  // the among checkbox explains itself in a popup, on hover of the ⓘ or the
  // label, gone when the pointer leaves
  const tip = page.locator('.tooltip.arena-tooltip')
  for (const target of [
    '#card_omnipath .db-tip',
    'label[for="omnipath_only_among"]',
  ]) {
    await page.locator(target).hover()
    await expect(tip).toBeVisible()
    await expect(tip).toContainText(
      'Ticked: only interactions between two of the proteins you typed. Unticked: their other interaction partners join too'
    )
    await page.mouse.move(0, 0)
    await expect(tip).toHaveCount(0)
  }
  await openCard(page, '#card_ndex')
  await expect(page.locator('.ndex-example')).toHaveCount(3)
  await page.locator('.ndex-example', { hasText: 'p53 pathway' }).click()
  await expect(page.locator('#db_status')).toContainText('Loaded network')
  expect(body).toEqual({ uuid: '35e031eb-45d1-11ed-b7d0-0ac135e8bacf' })
  // the card's own progress bar finished
  await expect(page.locator('#progress_ndex')).toContainText(
    'NDEx: p53 pathway loaded'
  )
})
