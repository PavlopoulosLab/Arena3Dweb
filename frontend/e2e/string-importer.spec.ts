import { expect, openCard, test, type Page } from './fixtures'

// Database Importers → STRING with NORMA's options. The backend route (and
// STRING itself, for Connect: Directly) is intercepted — no internet in CI.

type Body = Record<string, unknown>

function edge(s: string, t: string, channel: string | null) {
  return {
    src: `${s}_STRING`,
    trg: `${t}_STRING`,
    source_node: s,
    source_layer: 'STRING',
    target_node: t,
    target_layer: 'STRING',
    weight: 0.9,
    scaled_weight: 0.9,
    channel,
  }
}

const RESPONSE = {
  nodes: [
    { id: 'TP53_STRING', label: 'TP53', layer: 'STRING' },
    { id: 'MDM2_STRING', label: 'MDM2', layer: 'STRING' },
    { id: 'ATM_STRING', label: 'ATM', layer: 'STRING' },
  ],
  edges: [
    edge('MDM2', 'TP53', 'Experiments'),
    edge('ATM', 'TP53', 'Co-expression'),
  ],
  layers: ['STRING'],
  channels: ['Experiments', 'Co-expression'],
  warnings: [],
  string_version: '12.0',
  taxon_name: 'Homo sapiens',
  node_info: [
    {
      name: 'TP53',
      string_id: '9606.P1',
      description: 'Cellular tumor antigen p53',
      url: 'https://string-db.org/network/9606.P1',
      query: true,
    },
  ],
  groupings: [
    {
      category: 'Process',
      name: 'GO Biological Process',
      terms: [
        {
          term: 'GO:0006915',
          description: 'apoptotic process',
          members: ['TP53', 'MDM2'],
          fdr: 0.001,
          p_value: null,
        },
      ],
    },
    {
      category: 'KEGG',
      name: 'KEGG pathways',
      terms: [
        {
          term: 'hsa04115',
          description: 'p53 signaling pathway',
          members: ['TP53', 'MDM2', 'ATM'],
          fdr: 0.0001,
          p_value: null,
        },
      ],
    },
  ],
}

async function openStringCard(page: Page): Promise<void> {
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
  // folded by default (sections.spec.ts); open here through the fixture
  await openCard(page, '#card_string')
  await expect(page.locator('#card_string')).toHaveAttribute('open', '')
}

const nodes = (page: Page) =>
  page.evaluate(() =>
    (
      window as unknown as {
        __arena: {
          ctx: {
            nodeObjects: {
              name: string
              descr: string
              url: string
              annotations: string[]
            }[]
          }
        }
      }
    ).__arena.ctx.nodeObjects.map((n) => ({
      name: n.name,
      descr: n.descr,
      url: n.url,
      annotations: n.annotations,
    }))
  )

test('the STRING card shows every NORMA option and sends them', async ({
  page,
}) => {
  let body: Body | null = null
  await page.route('**/api/import/string', async (route) => {
    body = route.request().postDataJSON() as Body
    await route.fulfill({ json: RESPONSE })
  })
  await openStringCard(page)

  // the card's sections and choices, as in NORMA
  await expect(page.locator('#string_organism option')).toHaveCount(20)
  await expect(page.locator('#string_organism')).toHaveValue('9606')
  await expect(page.locator('#string_add_nodes_value')).toHaveText('20')
  await expect(page.locator('#db_string_opts .db_channel')).toHaveCount(7)
  await expect(page.locator('#string_categories .string_cat')).toHaveCount(21)
  await expect(
    page.locator('#string_categories .string_cat:checked')
  ).toHaveCount(8)
  await expect(page.locator('#string_connect')).toHaveValue('auto')
  await expect(page.locator('#string_connect_state')).toHaveText(
    'Decided at the first request.'
  )

  await page.locator('#db_identifiers').fill('TP53 MDM2, ATM')
  await page.locator('#string_organism').selectOption('other')
  await expect(page.locator('#string_taxon')).toBeVisible()
  await page.locator('#string_taxon').fill('7955')
  await page.locator('#string_network').selectOption('physical')
  await page.locator('#string_add_nodes').fill('50')
  await expect(page.locator('#string_add_nodes_value')).toHaveText('50')
  await page.locator('#string_score_preset').selectOption('custom')
  await expect(page.locator('#string_score_row')).toBeVisible()
  await page.locator('#string_score').fill('0.55')
  await page
    .locator('#card_string summary:has-text("Evidence channels")')
    .click()
  await page.locator('#db_ch_tscore').uncheck()
  await page.locator('#string_edge_mode').selectOption('combined')

  await page.locator('#card_string summary:has-text("Groupings")').click()
  await page.locator('#string_cat_none').click()
  await page.locator('#string_cat_KEGG').check()
  await page.locator('#string_annot_mode').selectOption('annotation')
  await expect(page.locator('#string_fdr_row')).toBeHidden()
  await expect(page.locator('#string_kegg_note')).toBeVisible()
  await page.locator('#string_max_terms').fill('10')
  await page.locator('#string_min_group').fill('3')

  await page.locator('#card_string summary:has-text("STRING server")').click()
  await page.locator('#string_connect').selectOption('proxy')
  await page
    .locator('#string_address')
    .fill('https://version-12-0.string-db.org')
  await page.locator('#string_descriptions').uncheck()
  // Ctrl+Enter in the protein box fetches
  await page.locator('#db_identifiers').press('Control+Enter')

  await expect(page.locator('#db_status')).toContainText('Loaded network')
  expect(body).toEqual({
    identifiers: ['TP53', 'MDM2', 'ATM'],
    species: 7955,
    network_type: 'physical',
    required_score: 0.55,
    channels: ['nscore', 'fscore', 'pscore', 'ascore', 'escore', 'dscore'],
    edge_mode: 'combined',
    add_nodes: 50,
    descriptions: false,
    groupings: {
      mode: 'annotation',
      fdr: 0.05,
      categories: ['KEGG'],
      other_categories: false,
      max_terms: 10,
      min_group: 3,
    },
    address: 'https://version-12-0.string-db.org',
  })
})

test('STRING results: descriptions, links, colours and groupings', async ({
  page,
}) => {
  await page.route('**/api/import/string', (route) =>
    route.fulfill({ json: RESPONSE })
  )
  await openStringCard(page)
  await page.locator('#db_identifiers').fill('TP53 MDM2 ATM')
  await page.locator('#db_import_string').click()

  await expect(page.locator('#db_status')).toContainText(
    'From STRING 12.0, Homo sapiens.'
  )
  await expect(page.locator('#db_status')).toContainText(
    'Added 2 groupings: GO Biological Process, KEGG pathways'
  )
  // each set is named after the query, so later imports never overwrite it
  await expect(
    page.locator('#annotationSet option', {
      hasText: 'STRING TP53: KEGG pathways (FDR ≤ 0.05)',
    })
  ).toHaveCount(1)
  const loaded = await nodes(page)
  const tp53 = loaded.find((n) => n.name === 'TP53')!
  expect(tp53.descr).toBe('Cellular tumor antigen p53')
  expect(tp53.url).toBe('https://string-db.org/network/9606.P1')
  // KEGG is preferred over GO processes, so it is the set on the nodes
  expect(loaded.find((n) => n.name === 'ATM')!.annotations).toEqual([
    'p53 signaling pathway',
  ])
  const colours = await page.evaluate(
    () =>
      (
        window as unknown as {
          __arena: { ctx: { channelColors: Record<string, string> } }
        }
      ).__arena.ctx.channelColors
  )
  expect(colours.Experiments).toBe('#b464c9')
})

test('Connect automatically: the browser asks STRING when the server cannot', async ({
  page,
}) => {
  const bodies: Body[] = []
  await page.route('**/api/import/string', async (route) => {
    bodies.push(route.request().postDataJSON() as Body)
    if (bodies.length === 1)
      await route.fulfill({
        status: 502,
        json: { detail: 'Could not reach string-db.org: timed out' },
      })
    else await route.fulfill({ json: RESPONSE })
  })
  const asked: string[] = []
  await page.route('https://string-db.org/api/json/**', async (route) => {
    const method = route.request().url().split('/').pop()!
    asked.push(method)
    const json =
      method === 'version'
        ? [{ string_version: '12.0' }]
        : method === 'get_string_ids'
          ? [{ queryItem: 'TP53', stringId: '9606.P1', preferredName: 'TP53' }]
          : method === 'network'
            ? [
                {
                  stringId_A: '9606.P1',
                  stringId_B: '9606.P2',
                  score: 0.9,
                  escore: 0.9,
                },
              ]
            : []
    await route.fulfill({
      json,
      headers: { 'Access-Control-Allow-Origin': '*' },
    })
  })
  await openStringCard(page)
  await page.locator('#db_identifiers').fill('TP53')
  await page.locator('#db_import_string').click()

  // five STRING calls, one second apart (as STRING asks)
  await expect(page.locator('#db_status')).toContainText('Loaded network', {
    timeout: 20_000,
  })
  expect(bodies).toHaveLength(2)
  expect(bodies[0].raw).toBeUndefined()
  const raw = bodies[1].raw as Record<string, unknown[]>
  expect(raw.ids).toHaveLength(1)
  expect(raw.network).toHaveLength(1)
  // descriptions and groupings asked for the proteins the network keeps
  expect(asked).toEqual([
    'version',
    'get_string_ids',
    'network',
    'get_string_ids',
    'enrichment',
  ])
  await expect(page.locator('#string_connect_state')).toContainText(
    'directly from the browser'
  )
})

test('groupings for the current view use the loaded node names', async ({
  page,
}) => {
  await page.route('**/api/import/string', (route) =>
    route.fulfill({ json: { ...RESPONSE, groupings: [] } })
  )
  let body: Body | null = null
  await page.route('**/api/import/string/groupings', async (route) => {
    body = route.request().postDataJSON() as Body
    await route.fulfill({
      json: { groupings: RESPONSE.groupings.slice(0, 1), warnings: [] },
    })
  })
  await openStringCard(page)
  await expect(page.locator('#string_groupings_button')).toBeDisabled()
  await page.locator('#db_identifiers').fill('TP53')
  await page.locator('#db_import_string').click()
  await expect(page.locator('#db_status')).toContainText('Loaded network')

  await page
    .getByRole('tab', {
      name: 'Database Importers',
      includeHidden: true,
      exact: true,
    })
    .click()
  await expect(page.locator('#string_groupings_button')).toBeEnabled()
  await page.locator('#string_groupings_button').click()
  await expect(page.locator('#db_status')).toContainText(
    'Added 1 grouping: GO Biological Process'
  )
  expect(body).toMatchObject({
    identifiers: ['TP53', 'MDM2', 'ATM'],
    species: 9606,
    groupings: { mode: 'enrichment', fdr: 0.05 },
  })
  const loaded = await nodes(page)
  expect(loaded.find((n) => n.name === 'MDM2')!.annotations).toEqual([
    'apoptotic process',
  ])
})
