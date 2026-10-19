import { expect, test, type Page } from './fixtures'
import path from 'node:path'

// NORMA-style groups: a group file annotates nodes by name in every layer;
// the Groups card lists, recolours, hides, selects; tables; super-node view.

const tab = (page: Page, name: string) =>
  page
    .getByRole('tab', { name, includeHidden: true, exact: true })
    .dispatchEvent('click')
type Ctx = {
  nodeObjects: {
    name: string
    layer: string
    color: string
    isSelected: boolean
    faded: boolean
    annotations: string[]
    getScale: () => number
  }[]
  layers: { plane: { children: { userData: { hullGroup?: string } }[] } }[]
}
const read = (page: Page) =>
  page.evaluate(() => {
    const c = (window as unknown as { __arena: { ctx: Ctx } }).__arena.ctx
    return {
      nodes: c.nodeObjects.length,
      annotated: c.nodeObjects.filter((n) => n.annotations.length).length,
      selected: c.nodeObjects.filter((n) => n.isSelected).length,
      hulls: c.layers.reduce(
        (s, l) =>
          s + l.plane.children.filter((o) => o.userData.hullGroup).length,
        0
      ),
      colorOf1: c.nodeObjects.find((n) => n.name === '1')?.color.toLowerCase(),
      scales: c.nodeObjects.map((n) => n.getScale()),
      // the nodes that stand out (the rest fade), by name
      shown: [
        ...new Set(c.nodeObjects.filter((n) => !n.faded).map((n) => n.name)),
      ].sort(),
    }
  })

test('group file → Groups card → hulls, colours, selection, tables, super nodes', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await tab(page, 'File')
  await page
    .locator('#input_network_file')
    .setInputFiles(path.resolve('public/data/figure2A_data.tsv'))
  await expect(page.locator('#file_status')).toContainText('Loaded network')
  // the legend lists the layers after a load; an entry selects its layer
  await expect(page.locator('#legend .legend-entry')).toHaveCount(4)
  await page.locator('#legend .legend-entry').first().click()
  expect((await read(page)).selected).toBeGreaterThan(0)

  await page.locator('#groups_file').setInputFiles({
    name: 'groups.tsv',
    mimeType: 'text/tab-separated-values',
    buffer: Buffer.from('Alpha\t1, 2, 3\nBeta\t3;4;5;6\n'),
  })
  await expect(page.locator('#file_status')).toContainText('2 groups applied')
  const before = await read(page)
  expect(before.annotated).toBeGreaterThan(0)

  await tab(page, 'Annotations')
  await page
    .locator('#groups_card')
    .evaluate((d) => ((d as HTMLDetailsElement).open = true))
  const rows = page.locator('#groupsList .group-row')
  await expect(rows).toHaveCount(2)
  await expect(rows.first().locator('.group-name')).toHaveText('Beta') // larger first
  // hulls: Beta hidden → fewer hulls
  await page.locator('#hull_annotation').dispatchEvent('click')
  // What to show sums the set up; the list shows the groups drawn
  await expect(page.locator('#annSummary')).toContainText('2 groups over')
  await expect(page.locator('#groupsSource')).toHaveValue('annotation')
  await expect(page.locator('#groupsCount')).toHaveText('2 groups')
  await page.waitForTimeout(300)
  const withHulls = (await read(page)).hulls
  expect(withHulls).toBeGreaterThan(0)
  await rows
    .first()
    .locator('.group-hull input')
    .evaluate((el) => {
      ;(el as HTMLInputElement).click()
    })
  await page.waitForTimeout(300)
  expect((await read(page)).hulls).toBeLessThan(withHulls)
  // …and Beta's nodes fade, with every node in no group: only Alpha's
  // members stand out (3 is in both)
  expect((await read(page)).shown).toEqual(['1', '2', '3'])
  // Show: None hides every group, All draws them all again
  await page.locator('#groupsShowNone').dispatchEvent('click')
  await expect(
    page.locator('#groupsList .group-hull input:checked')
  ).toHaveCount(0)
  await expect(page.locator('#groups_status')).toHaveText('Hiding 2 groups.')
  await page.waitForTimeout(300)
  expect((await read(page)).hulls).toBe(0)
  expect((await read(page)).shown).toEqual([])
  await page.locator('#groupsShowAll').dispatchEvent('click')
  await expect(
    page.locator('#groupsList .group-hull input:checked')
  ).toHaveCount(2)
  await page.waitForTimeout(300)
  expect((await read(page)).hulls).toBe(withHulls)
  expect(
    await page.evaluate(
      () =>
        (
          window as unknown as { __arena: { ctx: Ctx } }
        ).__arena.ctx.nodeObjects.filter((n) => n.faded).length
    )
  ).toBe(0)
  // On the nodes: each node takes its first group's colour; undo restores
  const own = (await read(page)).colorOf1
  const alpha = await rows.nth(1).locator('.group-color').inputValue()
  await page.locator('#annColorNodes').dispatchEvent('click')
  await expect(page.locator('#groups_status')).toContainText(
    'coloured by their first annotation'
  )
  expect((await read(page)).colorOf1).toBe(alpha.toLowerCase())
  await page.locator('#undoButton').dispatchEvent('click')
  expect((await read(page)).colorOf1).toBe(own)
  // recolour Alpha → every copy of node 1 changes
  await rows
    .nth(1)
    .locator('.group-color')
    .evaluate((el) => {
      const i = el as HTMLInputElement
      i.value = '#ff00aa'
      i.dispatchEvent(new Event('change', { bubbles: true }))
    })
  expect((await read(page)).colorOf1).toBe('#ff00aa')
  // select Alpha
  await rows.nth(1).locator('.group-select').dispatchEvent('click')
  await expect(page.locator('#groups_status')).toContainText(
    'nodes of Alpha selected'
  )
  // tables
  await page.locator('#groupsOverlap').dispatchEvent('click')
  await expect(page.locator('#dataPane-groupOverlap table')).toBeVisible()
  await expect(page.locator('#dataPane-groupOverlap tbody tr')).toHaveCount(2)
  await tab(page, 'Annotations')
  await page.locator('#groupsTable').dispatchEvent('click')
  await expect(page.locator('#dataPane-groups tbody tr')).toHaveCount(2)
  // super nodes: Alpha/Beta per layer + ungrouped nodes; undo restores
  await tab(page, 'Annotations')
  await page.locator('#groupsCollapse').dispatchEvent('click')
  await expect(page.locator('#groups_status')).toContainText('super nodes')
  const collapsed = await read(page)
  expect(collapsed.nodes).toBeLessThan(before.nodes)
  expect(Math.max(...collapsed.scales)).toBeGreaterThan(1) // sized by members
  await page.locator('#undoButton').dispatchEvent('click') // the look
  await page.locator('#undoButton').dispatchEvent('click') // the collapse
  expect((await read(page)).nodes).toBe(before.nodes)
})
