import { expect, test } from './fixtures'

// The two neural network examples (scripts/neural_network_examples.py) open
// from File → Example as sessions: every network layer an Arena3D layer, the
// kinds of link as channels, the layers side by side in order.

type Arena = {
  __arena: {
    ctx: {
      layers: { name: string; getPosition(axis: 'x'): number }[]
      nodeObjects: unknown[]
      edgeObjects: { channels: string[] }[]
      channelColors: Record<string, string>
    }
  }
}

for (const [label, layers, channels, first, last] of [
  [
    'Neural network: convolutional (LeNet-like), 7 layers',
    7,
    ['Convolution', 'Pooling', 'Dense'],
    'Input',
    'Output',
  ],
  [
    'Neural network: transformer (LLM-like), 10 layers',
    10,
    ['Projection', 'Residual', 'Feed-forward', 'Attention'],
    'Embedding',
    'Output',
  ],
] as const) {
  test(`File → Example opens "${label}"`, async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(
      () => '__arena' in (window as unknown as Record<string, unknown>)
    )
    await page
      .getByRole('tab', { name: 'File', includeHidden: true, exact: true })
      .dispatchEvent('click')
    await page.locator('#exampleChoice').selectOption({ label })
    await page.locator('#exampleButton').click()
    await expect(page.locator('#file_status')).toContainText('Session loaded', {
      timeout: 30_000,
    })
    const scene = await page.evaluate(() => {
      const { ctx } = (window as unknown as Arena).__arena
      return {
        layers: ctx.layers.map((l) => l.name),
        xs: ctx.layers.map((l) => l.getPosition('x')),
        nodes: ctx.nodeObjects.length,
        edges: ctx.edgeObjects.length,
        channels: Object.keys(ctx.channelColors),
        used: [...new Set(ctx.edgeObjects.flatMap((e) => e.channels))],
      }
    })
    expect(scene.layers).toHaveLength(layers)
    expect(scene.layers[0]).toBe(first)
    expect(scene.layers.at(-1)).toBe(last)
    // side by side, in order, left to right
    expect(scene.xs).toEqual([...scene.xs].sort((a, b) => a - b))
    expect(scene.channels).toEqual(channels)
    expect(scene.used.sort()).toEqual([...channels].sort())
    expect(scene.nodes).toBeGreaterThan(100)
    expect(scene.edges).toBeLessThanOrEqual(10_000)
  })
}

test('the Home page features both neural networks', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  for (const title of ['Convolutional network', 'LLM-like transformer'])
    await expect(
      page.locator('.home-example', { hasText: title })
    ).toBeVisible()
  await page
    .locator('.home-example', { hasText: 'LLM-like transformer' })
    .click()
  await expect(page.locator('#file_status')).toContainText('Session loaded', {
    timeout: 30_000,
  })
  const layers = await page.evaluate(
    () => (window as unknown as Arena).__arena.ctx.layers.length
  )
  expect(layers).toBe(10)
})
