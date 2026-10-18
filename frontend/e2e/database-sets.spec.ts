import { expect, test, type Page } from './fixtures'

// Reactome and Gene Ontology cards: search a set by name, add the hit, import
// (the backend is mocked: pathways/terms become layers). Cards expand, the
// "?" opens the Databases help page.

const NETWORK = {
  layers: ['Apoptosis', 'DNA repair'],
  channels: [],
  warnings: ['Apoptosis: the first 2 of 3 genes.'],
  nodes: [
    { id: 'TP53_Apoptosis', label: 'TP53', layer: 'Apoptosis' },
    { id: 'BAX_Apoptosis', label: 'BAX', layer: 'Apoptosis' },
    { id: 'TP53_DNA repair', label: 'TP53', layer: 'DNA repair' },
    { id: 'ATM_DNA repair', label: 'ATM', layer: 'DNA repair' },
  ],
  edges: [
    ['TP53', 'Apoptosis', 'BAX', 'Apoptosis'],
    ['TP53', 'DNA repair', 'ATM', 'DNA repair'],
    ['TP53', 'Apoptosis', 'TP53', 'DNA repair'],
  ].map(([a, al, b, bl]) => ({
    src: `${a}_${al}`,
    trg: `${b}_${bl}`,
    source_node: a,
    source_layer: al,
    target_node: b,
    target_layer: bl,
    weight: 1,
    scaled_weight: 1,
    channel: null,
  })),
}

const tab = (page: Page, name: string) =>
  page
    .getByRole('tab', { name, includeHidden: true, exact: true })
    .dispatchEvent('click')

test('Reactome card: search, add a hit, import pathways as layers', async ({
  page,
}) => {
  let body: Record<string, unknown> | null = null
  await page.route('**/api/import/reactome/search**', (route) =>
    route.fulfill({
      json: [
        { id: 'R-HSA-73894', name: 'DNA Repair', detail: 'Homo sapiens' },
        { id: 'R-HSA-1640170', name: 'Cell Cycle', detail: 'Homo sapiens' },
        { id: 'R-HSA-109581', name: 'Apoptosis', detail: 'Homo sapiens' },
      ],
    })
  )
  await page.route('**/api/import/reactome', async (route) => {
    body = route.request().postDataJSON() as Record<string, unknown>
    await route.fulfill({ json: NETWORK })
  })
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await tab(page, 'Database Importers')
  // cards: all folded until clicked
  await expect(page.locator('#card_string')).not.toHaveAttribute('open', '')
  await expect(page.locator('#reactome_query')).toBeHidden()
  await page.locator('#card_reactome summary').click()
  await expect(page.locator('#reactome_query')).toBeVisible()
  await page.locator('#reactome_query').fill('apopt')
  await page.locator('#reactome_search').click()
  const hits = page.locator('#reactome_results .db-hit')
  await expect(hits).toHaveCount(3)
  // sorted by name by default; by ID or as found on request
  const order = () => hits.evaluateAll((bs) => bs.map((b) => b.dataset.id))
  expect(await order()).toEqual([
    'R-HSA-109581',
    'R-HSA-1640170',
    'R-HSA-73894',
  ])
  await page.locator('#reactome_sort').selectOption('id')
  expect(await order()).toEqual([
    'R-HSA-73894',
    'R-HSA-109581',
    'R-HSA-1640170',
  ])
  await page.locator('#reactome_sort').selectOption('relevance')
  expect(await order()).toEqual([
    'R-HSA-73894',
    'R-HSA-1640170',
    'R-HSA-109581',
  ])
  await page.locator('#reactome_sort').selectOption('name')
  await hits.nth(0).click() // Apoptosis
  await hits.nth(2).click() // DNA Repair
  await expect(page.locator('#reactome_ids')).toHaveValue(
    'R-HSA-109581\nR-HSA-73894'
  )
  await page.locator('#db_import_reactome').click()
  await expect(page.locator('#db_status')).toContainText(
    'Loaded network: 2 layers, 4 nodes'
  )
  await expect(page.locator('#db_status')).toContainText('first 2 of 3 genes')
  expect(body).toMatchObject({
    pathways: ['R-HSA-109581', 'R-HSA-73894'],
    species: 9606,
    required_score: 0.4,
    max_genes: 300,
  })
})

test('Gene Ontology card imports terms; the ? opens the help page', async ({
  page,
}) => {
  let body: Record<string, unknown> | null = null
  await page.route('**/api/import/go', async (route) => {
    body = route.request().postDataJSON() as Record<string, unknown>
    await route.fulfill({ json: NETWORK })
  })
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await tab(page, 'Database Importers')
  await page.locator('#card_go summary').click()
  await page.locator('#go_ids').fill('GO:0006915\nGO:0006281')
  await expect(page.locator('#go_children')).toBeChecked() // the default
  await page.locator('#db_import_go').click()
  await expect(page.locator('#db_status')).toContainText(
    'Loaded network: 2 layers'
  )
  expect(body).toMatchObject({
    terms: ['GO:0006915', 'GO:0006281'],
    taxon: 9606,
    include_children: true,
  })
  await tab(page, 'Database Importers')
  await page.locator('#card_intact .db-card__help').click()
  await expect(page.locator('#panel-help')).toHaveClass(/active/)
  await expect(page.locator('#Databases_tab')).toBeVisible()
  await expect(page.locator('#Databases_tab')).toContainText('Gene Ontology')
})
