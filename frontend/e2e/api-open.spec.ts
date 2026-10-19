import { expect, test } from './fixtures'

// POST /api/open: another tool sends plain edges and gets a link; opening the
// link loads the network laid out, with the requested node look and arrows.
// An expired link is reported in the File panel.

const EDGES = [
  ['A', 'B', 'PPI', 'PPI'],
  ['B', 'C', 'PPI', 'PPI'],
  ['A', 'C', 'PPI', 'PPI'],
  ['C', 'D', 'PPI', 'PPI'],
  ['A', 'A', 'PPI', 'Regulation'],
  ['A', 'E', 'Regulation', 'Regulation'],
  ['E', 'F', 'Regulation', 'Regulation'],
  ['F', 'A', 'Regulation', 'Regulation'],
].map(([source, target, source_layer, target_layer]) => ({
  source,
  target,
  source_layer,
  target_layer,
}))

test('a network sent to /api/open opens laid out from its link', async ({
  page,
}) => {
  const res = await page.request.post('/api/open', {
    data: {
      edges: EDGES,
      nodes: [{ name: 'A', color: '#ff0000', size: 2 }],
      layout: 'Fruchterman-Reingold',
      directed: true,
    },
  })
  expect(res.ok()).toBe(true)
  const body = (await res.json()) as {
    token: string
    url: string
    layers: number
    nodes: number
    edges: number
  }
  expect(body.layers).toBe(2)
  expect(body.url).toContain(`?session=${body.token}`)

  await page.goto(`/?session=${body.token}`)
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  type Ctx = {
    layers: unknown[]
    isDirectionEnabled: boolean
    nodeObjects: {
      name: string
      layer: string
      color: string
      getScale: () => number
      getPosition: (a: string) => number
    }[]
  }
  const read = () =>
    page.evaluate(() => {
      const c = (window as unknown as { __arena: { ctx: Ctx } }).__arena.ctx
      return {
        layers: c.layers.length,
        nodes: c.nodeObjects.length,
        arrows: c.isDirectionEnabled,
        a: c.nodeObjects
          .filter((n) => n.name === 'A')
          .map((n) => [n.color.toLowerCase(), n.getScale()]),
        spots: new Set(
          c.nodeObjects.map(
            (n) =>
              `${n.getPosition('y').toFixed(0)},${n.getPosition('z').toFixed(0)}`
          )
        ).size,
      }
    })
  await expect.poll(async () => (await read()).nodes).toBe(body.nodes)
  const state = await read()
  expect(state.layers).toBe(2)
  expect(state.arrows).toBe(true)
  expect(state.a).toEqual([
    ['#ff0000', 2],
    ['#ff0000', 2],
  ]) // every copy of A
  expect(state.spots).toBe(body.nodes) // laid out: no two nodes share a spot
  await expect(page.locator('#panel-main-view')).toHaveClass(/active/)

  // the interactive docs are served under /api/ (so the proxy reaches them)
  const docs = await page.request.get('/api/docs')
  expect(docs.ok()).toBe(true)
  expect(await docs.text()).toContain('swagger')

  // an expired or wrong link says so where the user looks next
  await page.goto('/?session=not-a-real-token')
  await expect(page.locator('#file_status')).toContainText('expired')
  await expect(page.locator('#panel-file')).toHaveClass(/active/)
})
