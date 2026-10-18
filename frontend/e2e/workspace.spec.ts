import { expect, test, type Page } from './fixtures'
import path from 'node:path'

// Several loaded networks: the File panel lists them, switching restores each
// one, networks can be compared; annotation sets are kept and switchable;
// group statistics and the statistics buttons open the Data Tables panel.

const tab = (page: Page, name: string) =>
  page
    .getByRole('tab', { name, includeHidden: true, exact: true })
    .dispatchEvent('click')
const upload = async (page: Page, file: string) => {
  await tab(page, 'File')
  await page
    .locator('#input_network_file')
    .setInputFiles(path.resolve('public/data', file))
  await expect(page.locator('#file_status')).toContainText('Loaded network')
}
type Ctx = {
  layers: { name: string }[]
  nodeObjects: { annotations: string[]; getPosition: (a: string) => number }[]
}
const read = (page: Page) =>
  page.evaluate(() => {
    const c = (window as unknown as { __arena: { ctx: Ctx } }).__arena.ctx
    return {
      layers: c.layers.map((l) => l.name),
      nodes: c.nodeObjects.length,
      annotated: c.nodeObjects.filter((n) => n.annotations.length > 0).length,
      y0: c.nodeObjects[0]?.getPosition('y'),
    }
  })

test('loaded networks: list, switch back and forth, compare', async ({
  page,
}) => {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await expect(page.locator('#workspaceList')).toContainText('Nothing loaded')
  await upload(page, 'figure2A_data.tsv')
  await expect(page.locator('#workspaceList .workspace-row')).toHaveCount(1)
  await expect(
    page.locator('#workspaceList .workspace-row.is-active')
  ).toContainText('figure2A_data.tsv')
  const a = await read(page)
  // move a node so the restored layout can be told from a fresh one
  await page.evaluate(() => {
    const c = (
      window as unknown as {
        __arena: {
          ctx: Ctx & {
            nodeObjects: { setPosition: (a: string, v: number) => void }[]
          }
        }
      }
    ).__arena.ctx
    c.nodeObjects[0].setPosition('y', 123.5)
  })

  await upload(page, 'aspirin_3channels.tsv')
  await expect(page.locator('#workspaceList .workspace-row')).toHaveCount(2)
  await expect(
    page.locator('#workspaceList .workspace-row.is-active')
  ).toContainText('aspirin')
  const b = await read(page)
  expect(b.layers).not.toEqual(a.layers)

  // back to the first: its layers and the moved node come back
  await page.locator('.workspace-switch[data-id="1"]').dispatchEvent('click')
  await expect(page.locator('#file_status')).toContainText(
    'Switched to figure2A'
  )
  await expect.poll(async () => (await read(page)).layers).toEqual(a.layers)
  expect((await read(page)).y0).toBeCloseTo(123.5, 3)
  await expect(
    page.locator('#workspaceList .workspace-row.is-active')
  ).toContainText('figure2A')

  // compare with the aspirin network: a table in Data Tables (a load reveals
  // the scene, so open the File panel again)
  await tab(page, 'File')
  await page.locator('#compareWith').selectOption('2')
  await page.locator('#compareNetworks').dispatchEvent('click')
  await expect(page.locator('#panel-data')).toHaveClass(/show/)
  await expect(page.locator('#dataPane-compare')).toContainText(
    'Nodes (by name)'
  )
  expect(
    await page.locator('#dataPane-compare tbody tr').count()
  ).toBeGreaterThanOrEqual(5)
  const firstRow = await page
    .locator('#dataPane-compare tbody tr')
    .nth(1)
    .locator('td')
    .allTextContents()
  expect(Number(firstRow[1])).toBeGreaterThan(0) // numbers, not blanks

  // remove the other network
  await tab(page, 'File')
  await page.locator('.workspace-remove[data-id="2"]').dispatchEvent('click')
  await expect(page.locator('#workspaceList .workspace-row')).toHaveCount(1)
})

test('annotation sets, group statistics and the statistics buttons open Data Tables', async ({
  page,
}) => {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await upload(page, 'figure2A_data.tsv')
  await page.locator('#groups_file').setInputFiles({
    name: 'alpha-beta.tsv',
    mimeType: 'text/tab-separated-values',
    buffer: Buffer.from('Alpha\t1, 2, 3\nBeta\t3;4;5;6\n'),
  })
  await expect(page.locator('#file_status')).toContainText('2 groups applied')
  await page.locator('#groups_file').setInputFiles({
    name: 'gamma.tsv',
    mimeType: 'text/tab-separated-values',
    buffer: Buffer.from('Gamma\t7, 8\n'),
  })
  await expect(page.locator('#file_status')).toContainText('1 groups applied')
  const gamma = await read(page)

  await tab(page, 'Analysis')
  await page.locator('#annotation_card summary').dispatchEvent('click')
  await expect(page.locator('#annotationSet option')).toHaveCount(3)
  await expect(page.locator('#annotationSet')).toHaveValue('1')
  await page.locator('#annotationSet').selectOption('0')
  const alpha = await read(page)
  expect(alpha.annotated).toBeGreaterThan(gamma.annotated)
  await page.locator('#annotationSet').selectOption('-1')
  expect((await read(page)).annotated).toBe(0)
  await page.locator('#annotationSet').selectOption('0')

  // group statistics
  await page.locator('#groups_card summary').dispatchEvent('click')
  await page.locator('#groupsStats').dispatchEvent('click')
  await expect(page.locator('#panel-data')).toHaveClass(/show/)
  await expect(page.locator('#dataPane-groupStats')).toContainText('Alpha')
  const rows = page.locator('#dataPane-groupStats tbody tr')
  await expect(rows).toHaveCount(2)
  const beta = await rows.nth(0).locator('td').allTextContents()
  expect(Number(beta[1])).toBeGreaterThan(0) // nodes
  expect(Number(beta[6])).toBeGreaterThanOrEqual(0) // density

  // network statistics open the panel too
  await tab(page, 'Analysis')
  await page.locator('#networkStats').dispatchEvent('click')
  await expect(page.locator('#panel-data')).toHaveClass(/show/, {
    timeout: 30_000,
  })
  await expect(page.locator('#dataPane-stats table')).toBeVisible()
})
