import { expect, test } from '@playwright/test'

// Edge weight as thickness. WebGL renders line primitives at a fixed 1px, so
// this is Line2 (instanced quads) rather than THREE.Line — meaning the only
// honest check is what actually reaches the framebuffer.

// Count pixels the edges cover. Three things are on screen: near-black
// background, mid-grey layer planes, and bright near-grey edges. Only the
// bright band counts — the planes' own pixel count *falls* as thicker edges
// cover them, so any metric including them cancels the effect out. Nodes are
// the saturated pixels and are excluded by the hue test. Requires bloom off
// (loadExample): glow lifts the whole plane into the bright band, which swamps
// the edges' own pixels. Retries because the render loop is FPS-limited and
// the headless GPU context can drop and restore, leaving most frames' buffers
// empty.
async function edgeCoverage(page: import('@playwright/test').Page) {
  for (let i = 0; i < 60; i++) {
    const sample = await page.evaluate(() => {
      const webgl = [...document.querySelectorAll('canvas')].find(
        (c) => !c.closest('#minimap')
      )
      if (!webgl) return null
      return new Promise<{ edge: number; node: number }>((resolve) => {
        requestAnimationFrame(() => {
          const c = document.createElement('canvas')
          c.width = webgl.width
          c.height = webgl.height
          const g = c.getContext('2d', { willReadFrequently: true })!
          g.drawImage(webgl, 0, 0)
          const { data } = g.getImageData(0, 0, c.width, c.height)
          let edge = 0
          let node = 0
          for (let p = 0; p < data.length; p += 4) {
            const r = data[p]
            const gr = data[p + 1]
            const b = data[p + 2]
            const hi = Math.max(r, gr, b)
            const lo = Math.min(r, gr, b)
            if (hi - lo >= 30)
              node++ // saturated: node spheres
            else if (hi >= 128) edge++ // bright near-grey: edges
          }
          resolve({ edge, node })
        })
      })
    })
    if (sample && sample.edge > 0) return sample
    await page.waitForTimeout(100)
  }
  throw new Error('no rendered frame captured')
}

async function loadExample(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await page
    .getByRole('tab', { name: 'File', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page.getByRole('button', { name: 'Load Example' }).click()
  await expect(page.locator('#file_status')).toContainText('Loaded network')
  // Bloom off so pixel counts measure geometry, not glow. Driven on the input
  // itself rather than through its tab: uncheck() waits for visibility, and on
  // a slow runner the Scene Actions pane isn't shown by the time we get here.
  await page.locator('#toggleBloom').evaluate((el) => {
    const box = el as HTMLInputElement
    box.checked = false
    box.dispatchEvent(new Event('change'))
  })
  await page
    .getByRole('tab', { name: 'Edges', includeHidden: true, exact: true })
    .dispatchEvent('click')
}

test('weight-as-width thickens edges without touching nodes', async ({
  page,
}) => {
  await loadExample(page)

  // Default is Opacity, matching the pre-thickness appearance.
  await expect(page.locator('#edgeWeight_opacity')).toBeChecked()
  await expect(page.locator('#intraLayerEdgeOpacityWrap')).toBeHidden()
  await expect(page.locator('#intraLayerEdgeWidthWrap')).toBeVisible()
  const before = await edgeCoverage(page)

  await page.locator('#edgeWeight_width').check()
  // Width now comes from weight, so its manual sliders hide and opacity's show.
  await expect(page.locator('#intraLayerEdgeWidthWrap')).toBeHidden()
  await expect(page.locator('#intraLayerEdgeOpacityWrap')).toBeVisible()
  const after = await edgeCoverage(page)

  expect(after.edge).toBeGreaterThan(before.edge * 1.5)
  // Node pixels only ever fall, from thicker edges drawing over the spheres —
  // width must never add saturated pixels of its own.
  expect(after.node).toBeLessThanOrEqual(before.node)
})

test('manual width slider thickens edges when weight drives neither', async ({
  page,
}) => {
  await loadExample(page)
  await page.locator('#edgeWeight_neither').check()
  const thin = await edgeCoverage(page)

  for (const id of ['#intraLayerEdgeWidth', '#interLayerEdgeWidth']) {
    await page.locator(id).fill('6')
    await page.locator(id).dispatchEvent('input')
  }
  const thick = await edgeCoverage(page)

  expect(thick.edge).toBeGreaterThan(thin.edge * 1.5)
})

// Curvature only bends channel curves, which single-edge networks never build.
test('channel curvature sliders appear only for multi-edge networks', async ({
  page,
}) => {
  await loadExample(page) // figure2A_data.tsv has no Channel column
  await expect(page.locator('#intraChannelCurvatureWrap')).toBeHidden()
  await expect(page.locator('#interChannelCurvatureWrap')).toBeHidden()

  await page
    .getByRole('tab', { name: 'File', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page.locator('#load_network_file').setInputFiles({
    name: 'channels.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        layers: [{ name: 'L1' }],
        nodes: [
          { name: 'A', layer: 'L1' },
          { name: 'B', layer: 'L1' },
        ],
        edges: [
          { src: 'A_L1', trg: 'B_L1', channel: 'ppi' },
          { src: 'A_L1', trg: 'B_L1', channel: 'coexpression' },
        ],
      })
    ),
  })
  await expect(page.locator('#file_status')).toContainText('Session loaded')

  await page
    .getByRole('tab', { name: 'Edges', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await expect(page.locator('#intraChannelCurvatureWrap')).toBeVisible()
  // one layer opens as a single network: nothing is inter-layer there
  await expect(page.locator('body')).toHaveClass(/mode-single/)
  await expect(page.locator('#interChannelCurvatureWrap')).toBeHidden()
  await page.locator('#modeMultilayer').dispatchEvent('click')
  await expect(page.locator('body')).not.toHaveClass(/mode-single/)
  await expect(page.locator('#interChannelCurvatureWrap')).toBeVisible()
})

// Importing a session writes ctx directly (actions/network.ts) and never
// touches the DOM, so the panel has to re-read it on network:loaded. Drive the
// real path: upload JSON -> backend normalises -> buildFromSession -> radio.
test('the radio reflects whichever flag combination a session carries', async ({
  page,
}) => {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )

  for (const [byOpacity, byWidth, expected] of [
    [false, true, 'edgeWeight_width'],
    [true, true, 'edgeWeight_both'],
    [false, false, 'edgeWeight_neither'],
    [true, false, 'edgeWeight_opacity'],
  ] as const) {
    await page
      .getByRole('tab', { name: 'File', includeHidden: true, exact: true })
      .dispatchEvent('click')
    await page.locator('#load_network_file').setInputFiles({
      name: 'session.json',
      mimeType: 'application/json',
      buffer: Buffer.from(
        JSON.stringify({
          layers: [{ name: 'L1' }],
          nodes: [
            { name: 'A', layer: 'L1' },
            { name: 'B', layer: 'L1' },
          ],
          edges: [{ src: 'A_L1', trg: 'B_L1' }],
          edgeOpacityByWeight: byOpacity,
          edgeWidthByWeight: byWidth,
        })
      ),
    })
    await expect(page.locator('#file_status')).toContainText('Session loaded')
    // loading switches to the 3D view; let that tab switch finish first
    await expect(page.locator('#panel-main-view')).toHaveClass(/show/)

    await page
      .getByRole('tab', { name: 'Edges', includeHidden: true, exact: true })
      .dispatchEvent('click')
    await expect(page.locator(`#${expected}`)).toBeChecked()
    // The slider pair for a weight-driven property stays hidden.
    await expect(page.locator('#intraLayerEdgeOpacityWrap')).toBeVisible({
      visible: !byOpacity,
    })
    await expect(page.locator('#intraLayerEdgeWidthWrap')).toBeVisible({
      visible: !byWidth,
    })
  }
})
