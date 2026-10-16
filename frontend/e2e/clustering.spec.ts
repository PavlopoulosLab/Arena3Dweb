import { expect, test, type Page } from '@playwright/test'
import path from 'node:path'

// Layout → Clustering: communities without a layout, coloured, listed, and
// reusable as annotations.

const tab = (page: Page, name: string) =>
  page
    .getByRole('tab', { name, includeHidden: true, exact: true })
    .dispatchEvent('click')

type Ctx = {
  nodeObjects: {
    cluster: string
    annotations: string[]
    getPosition: (a: string) => number
  }[]
}
const read = (page: Page) =>
  page.evaluate(() => {
    const c = (window as unknown as { __arena: { ctx: Ctx } }).__arena.ctx
    return {
      clustered: c.nodeObjects.filter((n) => n.cluster !== '').length,
      clusters: new Set(c.nodeObjects.map((n) => n.cluster)).size,
      annotated: c.nodeObjects.filter((n) => n.annotations.length > 0).length,
      firstAnnotation: c.nodeObjects[0]?.annotations[0] ?? '',
      y0: c.nodeObjects[0]?.getPosition('y'),
    }
  })

test('find communities, then use them as annotations; both undoable', async ({
  page,
}) => {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await tab(page, 'File')
  await page
    .locator('#input_network_file')
    .setInputFiles(path.resolve('public/data/figure2A_data.tsv'))
  await expect(page.locator('#file_status')).toContainText('Loaded network')
  const before = await read(page)
  expect(before.clustered).toBe(0)

  await tab(page, 'Layout')
  await expect(page.locator('#clustersToAnnotations')).toBeDisabled()
  await page.locator('#clusterAlgorithm').selectOption('Louvain')
  await page.locator('#runClustering').dispatchEvent('click')
  await expect(page.locator('#cluster_status')).toContainText(
    'nodes coloured by community',
    { timeout: 60_000 }
  )
  const after = await read(page)
  expect(after.clustered).toBe(255) // every node of figure 2A
  expect(after.clusters).toBeGreaterThan(1)
  expect(after.y0).toBe(before.y0) // nodes did not move
  await expect(page.locator('#clustersToAnnotations')).toBeEnabled()

  await page.locator('#clustersToAnnotations').dispatchEvent('click')
  const annotated = await read(page)
  expect(annotated.annotated).toBe(annotated.clustered)
  expect(annotated.firstAnnotation).toMatch(/^Cluster \d+$/)
  await tab(page, 'Analysis')
  await page.locator('#annotation_card summary').dispatchEvent('click')
  await expect(page.locator('#showPies')).toBeEnabled()

  await page.locator('#undoButton').dispatchEvent('click')
  expect((await read(page)).annotated).toBe(0)
  await page.locator('#undoButton').dispatchEvent('click')
  expect((await read(page)).clustered).toBe(0)
})
