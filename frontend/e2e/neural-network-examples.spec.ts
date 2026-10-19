import { expect, test } from './fixtures'

// The neural network examples (scripts/neural_network_examples.py) open from
// File → Example as sessions: every network layer an Arena3D layer, the kinds
// of link as channels, the layers in order — side by side along x, or for the
// graph neural network flat floors stacked up y.

type Arena = {
  __arena: {
    ctx: {
      layers: {
        name: string
        geometry_parameters_width: number
        getPosition(axis: 'x' | 'y'): number
      }[]
      nodeObjects: {
        getName(): string
        getLayer(): string
        getPosition(axis: 'y' | 'z'): number
        annotations: string[]
        sphere: {
          scale: { y: number }
          geometry: {
            computeBoundingSphere(): void
            boundingSphere: { radius: number } | null
          }
        }
      }[]
      edgeObjects: { channels: string[] }[]
      channelColors: Record<string, string>
    }
  }
}

const EXAMPLES = [
  [
    'Neural network: convolutional (LeNet-like), 7 layers',
    7,
    ['Convolution', 'Pooling', 'Dense'],
    'Input',
    'Output',
    'x',
  ],
  [
    'Neural network: transformer (LLM-like), 10 layers',
    10,
    ['Projection', 'Residual', 'Feed-forward', 'Attention'],
    'Embedding',
    'Output',
    'x',
  ],
  [
    'Neural network: LSTM unrolled over 6 time steps',
    6,
    [
      'Input',
      'Recurrent',
      'Cell state',
      'Forget gate',
      'Candidate',
      'Output gate',
      'Input gate',
    ],
    'Step 1 · Arena',
    'Step 6 · space',
    'x',
  ],
  [
    'Neural network: U-Net encoder–decoder, 7 layers',
    7,
    ['Convolution', 'Down-sampling', 'Up-sampling', 'Skip connection'],
    'Input',
    'Output mask',
    'x',
  ],
  [
    'Neural network: graph neural network on the karate club',
    5,
    ['Graph edge', 'Message', 'Self'],
    'Input',
    'Output',
    'y',
  ],
  [
    'Neural network: variational autoencoder, 8 layers',
    8,
    ['Encoder', 'Mean', 'Log-variance', 'Sampling', 'Noise', 'Decoder'],
    'Input',
    'Output',
    'x',
  ],
] as const

async function openExample(
  page: import('@playwright/test').Page,
  label: string
) {
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
}

// One test over all examples rather than one test per example: the assertions
// below are identical for every example (same app code path, only the fixture
// data differs), so separate tests would just pay six full page loads/app
// inits for no extra coverage — matches the pattern already used below for
// "every node ... sits on its floor".
test('File → Example opens every neural network correctly', async ({
  page,
}) => {
  test.setTimeout(120_000) // six sessions on software GL
  for (const [label, layers, channels, first, last, axis] of EXAMPLES) {
    await openExample(page, label)
    const scene = await page.evaluate((axis) => {
      const { ctx } = (window as unknown as Arena).__arena
      return {
        layers: ctx.layers.map((l) => l.name),
        at: ctx.layers.map((l) => l.getPosition(axis)),
        nodes: ctx.nodeObjects.length,
        edges: ctx.edgeObjects.length,
        channels: Object.keys(ctx.channelColors),
        used: [...new Set(ctx.edgeObjects.flatMap((e) => e.channels))],
      }
    }, axis)
    expect(scene.layers, label).toHaveLength(layers)
    expect(scene.layers[0], label).toBe(first)
    expect(scene.layers.at(-1), label).toBe(last)
    // in order: left to right, or bottom to top
    expect(scene.at, label).toEqual([...scene.at].sort((a, b) => a - b))
    expect(new Set(scene.at).size, label).toBe(layers)
    expect(scene.channels, label).toEqual(channels)
    expect(scene.used.sort(), label).toEqual([...channels].sort())
    expect(scene.nodes, label).toBeGreaterThan(100)
    expect(scene.edges, label).toBeLessThanOrEqual(10_000)
  }
})

// every node whole on its (square) floor: none runs past an edge
test('every node of every neural network sits on its floor', async ({
  page,
}) => {
  test.setTimeout(180_000) // six sessions on software GL
  for (const [label] of EXAMPLES) {
    await openExample(page, label)
    const outside = await page.evaluate(() => {
      const { ctx } = (window as unknown as Arena).__arena
      return ctx.nodeObjects
        .map((n) => {
          const width = ctx.layers.find(
            (l) => l.name === n.getLayer()
          )!.geometry_parameters_width
          n.sphere.geometry.computeBoundingSphere()
          const radius =
            (n.sphere.geometry.boundingSphere?.radius ?? 0) * n.sphere.scale.y
          const reach =
            Math.max(
              Math.abs(n.getPosition('y')),
              Math.abs(n.getPosition('z'))
            ) + radius
          return reach <= width / 2
            ? null
            : `${n.getName()} (${n.getLayer()}): ${reach.toFixed(1)} > ${width / 2}`
        })
        .filter((s) => s !== null)
    })
    expect(outside, label).toEqual([])
  }
})

test('the graph neural network is a multiplex with annotated members', async ({
  page,
}) => {
  await openExample(
    page,
    'Neural network: graph neural network on the karate club'
  )
  const nodes = await page.evaluate(() =>
    (window as unknown as Arena).__arena.ctx.nodeObjects.map((n) => ({
      name: n.getName(),
      layer: n.getLayer(),
      terms: n.annotations,
    }))
  )
  // the same 34 members in every layer
  const byLayer = new Map<string, string[]>()
  for (const n of nodes)
    byLayer.set(n.layer, [...(byLayer.get(n.layer) ?? []), n.name])
  const members = [...byLayer.values()].map((names) => names.sort().join())
  expect(byLayer.size).toBe(5)
  expect(new Set(members).size).toBe(1)
  expect(byLayer.get('Input')).toHaveLength(34)
  // annotation terms: the real club everywhere, the prediction in the output
  const output = nodes.filter((n) => n.layer === 'Output')
  expect(output.every((n) => n.terms.some((t) => t.endsWith("'s club")))).toBe(
    true
  )
  expect(
    output.filter((n) => n.terms.includes('misclassified')).map((n) => n.name)
  ).toEqual(['member 9'])
})

test('the Home page features neural networks and lists them all', async ({
  page,
}) => {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  for (const title of ['Convolutional network', 'LLM-like transformer'])
    await expect(
      page.locator('.home-example', { hasText: title })
    ).toBeVisible()
  const listed = await page
    .locator('#homeExampleChoice option')
    .allTextContents()
  for (const [label] of EXAMPLES) expect(listed).toContain(label)
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
