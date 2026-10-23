import { expect, test } from './fixtures'

// Show Direction with arrowheads only in some layers: a network mixing a
// directed and an undirected layer, such as OmniPath next to STRING.

const TSV = [
  'SourceNode\tSourceLayer\tTargetNode\tTargetLayer',
  'A\tSignaling\tB\tSignaling',
  'B\tSignaling\tC\tSignaling',
  'A\tBinding\tB\tBinding',
  'B\tBinding\tC\tBinding',
  'A\tSignaling\tA\tBinding',
  'B\tSignaling\tB\tBinding',
].join('\n')

// arrowheads in the scene: [within layers, between layers]
const arrows = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    type E = {
      interLayer: boolean
      THREE_Object: { traverse(f: (o: { type: string }) => void): void }
    }
    const edges = (
      window as unknown as { __arena: { ctx: { edgeObjects: E[] } } }
    ).__arena.ctx.edgeObjects
    const count = (e: E) => {
      let n = 0
      e.THREE_Object.traverse((o) => {
        if (o.type === 'ArrowHelper') n++
      })
      return n
    }
    const sum = (es: E[]) => es.reduce((a, e) => a + count(e), 0)
    return [
      sum(edges.filter((e) => !e.interLayer)),
      sum(edges.filter((e) => e.interLayer)),
    ]
  })

test('arrowheads only in the chosen layers, and on the links between layers by their own switch', async ({
  page,
}) => {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await page.locator('#input_network_file').setInputFiles({
    name: 'mixed.tsv',
    mimeType: 'text/tab-separated-values',
    buffer: Buffer.from(TSV),
  })
  await expect(page.locator('#file_status')).toContainText('Loaded network', {
    timeout: 30000,
  })
  await page
    .locator('[data-bs-target="#panel-edge"]')
    .first()
    .dispatchEvent('click')
  await page
    .locator('#edgeCard_direction')
    .evaluate((d) => ((d as HTMLDetailsElement).open = true))
  await expect(page.locator('#arrowLayersWrap')).toBeHidden()
  await page.locator('#edgeDirectionToggle').check()
  await expect(page.locator('#arrowLayersWrap')).toBeVisible()
  await expect(page.locator('#arrowLayersList input')).toHaveCount(2)
  await expect.poll(() => arrows(page)).toEqual([4, 2])

  await page.locator('#arrowLayersList label', { hasText: 'Binding' }).click()
  await page.locator('#interLayerArrows').uncheck()
  await expect.poll(() => arrows(page)).toEqual([2, 0])
})
