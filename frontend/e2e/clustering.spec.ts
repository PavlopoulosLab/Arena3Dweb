import { expect, test, type Page } from './fixtures'
import path from 'node:path'

// The Clustering panel (top bar, next to Layout): communities without a
// layout, in a panel of their own — coloured, summarised, listed, and reusable as annotations. The
// Layout panel runs no clustering algorithm itself.

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
  await expect(
    page
      .locator('#panel-layouts')
      .locator('#clusterAlgorithm, #clusteringAlgorithmChoice')
  ).toHaveCount(0)
  await tab(page, 'Clustering')
  await expect(page.locator('#panel-clustering')).toHaveClass(/show/)
  await expect(page.locator('#clusterSummary')).toContainText(
    'No communities yet'
  )
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
  // the summary: how many communities, over how many nodes, the largest listed
  await expect(page.locator('#clusterCount')).toContainText(
    `${after.clusters} communities (Louvain, within each layer), 255 of 255 nodes`
  )
  expect(
    await page.locator('#clusterSummary tbody tr').count()
  ).toBeGreaterThan(1)

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
  await tab(page, 'Clustering')
  await expect(page.locator('#clusterSummary')).toContainText(
    'No communities yet'
  )
})
