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
  layers: { plane: { children: { userData: Record<string, unknown> }[] } }[]
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
      hulls: c.layers.reduce(
        (n, l) =>
          n + l.plane.children.filter((o) => o.userData.hullGroup).length,
        0
      ),
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
  // Draw Around Clusters… opens View → Annotations with cluster hulls on
  await page.locator('#clustersToHulls').click()
  await expect(page.locator('#panel-annotation-view')).toHaveClass(/show/)
  await expect(page.locator('#hull_cluster')).toBeChecked()
  await expect(page.locator('#groupsSource')).toHaveValue('cluster')
  expect((await read(page)).hulls).toBeGreaterThan(0)
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

test('the summary shows the ticked communities and fades the rest', async ({
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
  await tab(page, 'Clustering')
  await page.locator('#clusterAlgorithm').selectOption('Louvain')
  await page.locator('#runClustering').dispatchEvent('click')
  await expect(page.locator('#cluster_status')).toContainText(
    'nodes coloured by community',
    { timeout: 60_000 }
  )
  // hulls round the communities, then back to the summary
  await page.locator('#clustersToHulls').click()
  await tab(page, 'Clustering')
  const faded = () =>
    page.evaluate(() => {
      const c = (
        window as unknown as {
          __arena: {
            ctx: {
              nodeObjects: { faded: boolean; cluster: string }[]
              edgeObjects: { faded: boolean }[]
            }
          }
        }
      ).__arena.ctx
      return {
        nodes: c.nodeObjects.filter((n) => n.faded).length,
        shown: [
          ...new Set(
            c.nodeObjects.filter((n) => !n.faded).map((n) => n.cluster)
          ),
        ],
        edges: c.edgeObjects.filter((e) => e.faded).length,
      }
    })
  expect(await faded()).toEqual({
    nodes: 0,
    shown: expect.any(Array),
    edges: 0,
  })
  const before = (await read(page)).hulls
  expect(before).toBeGreaterThan(0)

  // None: every node and edge fades, no shapes; the Groups card follows
  await page.locator('#clusterShowNone').click()
  let state = await faded()
  expect(state.nodes).toBe(255)
  expect(state.edges).toBeGreaterThan(0)
  expect((await read(page)).hulls).toBe(0)
  await expect(
    page.locator('#groupsList .group-row .group-hull input:checked')
  ).toHaveCount(0)

  // one community ticked: only its nodes stand out, only its shapes drawn
  const first = page.locator('#clusterSummary .cluster-show').first()
  const id = await first.getAttribute('data-cluster')
  await first.check()
  state = await faded()
  expect(state.shown).toEqual([id])
  expect(state.nodes).toBeLessThan(255)
  const hulls = (await read(page)).hulls
  expect(hulls).toBeGreaterThan(0)
  expect(hulls).toBeLessThan(before)
  await expect(
    page.locator(
      `#groupsList .group-row[data-group="Cluster ${id}"] .group-hull input`
    )
  ).toBeChecked()

  // All: everything back
  await page.locator('#clusterShowAll').click()
  expect((await faded()).nodes).toBe(0)
  expect((await faded()).edges).toBe(0)
  expect((await read(page)).hulls).toBe(before)
  await expect(
    page.locator('#clusterSummary .cluster-show:not(:checked)')
  ).toHaveCount(0)
})
