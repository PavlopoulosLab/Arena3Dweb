import { expect, openCard, test, type Page } from './fixtures'
import path from 'node:path'

// Layout panel: with 3D Layout on only the algorithms that have a 3D version
// are offered (and a non-3D choice falls back to Fruchterman-Reingold); a run
// shows a progress bar that ends on "Layout applied" and then hides.

const tab = (page: Page, name: string) =>
  page
    .getByRole('tab', { name, includeHidden: true, exact: true })
    .dispatchEvent('click')

test('3D layout filters the algorithm list; runs show a progress bar', async ({
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
  await tab(page, 'Layout')
  const enabled = () =>
    page
      .locator('#layoutAlgorithmChoice option')
      .evaluateAll((os) =>
        os
          .filter((o) => !(o as HTMLOptionElement).disabled)
          .map((o) => (o as HTMLOptionElement).value)
      )
  expect((await enabled()).length).toBe(13) // '-' + 11 algorithms + UMAP
  await page.locator('#layoutAlgorithmChoice').selectOption('Sugiyama')
  await page
    .locator('#layout3dCheckbox')
    .evaluate((el) => (el as HTMLInputElement).click())
  expect(await enabled()).toEqual([
    '-',
    'Fruchterman-Reingold',
    'Circle',
    'Grid',
    'Random',
    'DrL',
    'Kamada-Kawai',
    'UMAP',
  ])
  await expect(page.locator('#layoutAlgorithmChoice')).toHaveValue(
    'Fruchterman-Reingold'
  ) // Sugiyama has no 3D version
  await page
    .locator('#layout3dCheckbox')
    .evaluate((el) => (el as HTMLInputElement).click())
  expect((await enabled()).length).toBe(13)

  // the run reports progress, ends on "applied", then hides the bar
  await page
    .locator('#selectAllLayersCheckbox')
    .evaluate((el) => (el as HTMLInputElement).click())
  await page.locator('#runLayout').dispatchEvent('click')
  await expect(page.locator('#layoutProgress')).toBeVisible()
  await expect(page.locator('#layoutProgress .progress-bar')).toHaveText(
    'Layout applied',
    { timeout: 30000 }
  )
  await expect(page.locator('#layouts_status')).toHaveText('Layout applied.')
  await expect(page.locator('#layoutProgress')).toBeHidden({ timeout: 5000 })
})

test('incompatible options are disabled, not mixed; single mode shows the NORMA groups card', async ({
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
  await tab(page, 'Layout')
  const click = (sel: string) =>
    page.locator(sel).evaluate((el) => (el as HTMLInputElement).click())
  const select = (sel: string, v: string) =>
    page.locator(sel).evaluate((el, v) => {
      ;(el as HTMLSelectElement).value = v
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }, v)
  // nothing chosen yet: every control usable except the local layout; no
  // clustering algorithm here (the Clustering panel has them)
  await expect(page.locator('#clusteringAlgorithmChoice')).toHaveCount(0)
  await expect(page.locator('#layout3dCheckbox')).toBeEnabled()
  await expect(page.locator('#localLayoutAlgorithmChoice')).toBeDisabled()
  await expect(page.locator('#layoutCompat')).toBeHidden()
  // 3D on: no alignment
  await click('#layout3dCheckbox')
  await expect(page.locator('#alignmentMode')).toBeDisabled()
  await expect(page.locator('#alignmentNote')).toContainText('2D layout')
  await click('#layout3dCheckbox')
  await expect(page.locator('#alignmentMode')).toBeEnabled()
  await select('#layoutAlgorithmChoice', 'Fruchterman-Reingold')
  await expect(page.locator('#useEdgeWeightsCheckbox')).toBeEnabled()
  // a scope other than Per Layer locks alignment; weights only on the plain scopes
  await click('#subgraph_coupled')
  await expect(page.locator('#alignmentMode')).toBeDisabled()
  await expect(page.locator('#useEdgeWeightsCheckbox')).toBeDisabled()
  await click('#subgraph_nodesPerLayers')
  await expect(page.locator('#localLayoutAlgorithmChoice')).toBeEnabled()
  await click('#subgraph_perLayer')
  await expect(page.locator('#alignmentMode')).toBeEnabled()
  // single network: the layer-centric controls step aside; the NORMA card
  // offers its drawing options (sections.spec.ts checks the folded defaults)
  await page.locator('#modeSingle').dispatchEvent('click')
  await expect(page.locator('body')).toHaveClass(/mode-single/)
  await expect(page.locator('#subgraph_perLayer')).toBeHidden()
  await expect(page.locator('#alignmentCard')).toBeHidden()
  await openCard(page, '#groupLayoutCard')
  await expect(page.locator('#groupDraw')).toBeVisible()
  await expect(page.locator('#groupPies')).toBeVisible()
  // no clusters yet: the card points to the Clustering panel
  await expect(page.locator('#groupNoClusters')).toBeVisible()
  await page.locator('#groupOpenClustering').click()
  await expect(page.locator('#panel-clustering')).toHaveClass(/show/)
  await page.locator('#modeMultilayer').dispatchEvent('click')
  await expect(page.locator('body')).not.toHaveClass(/mode-single/)
  await expect(page.locator('#groupDraw')).toBeHidden()
})

test('the Layer Arrangement card moves the floors, undoably', async ({
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
  await tab(page, 'Layout')
  const floors = () =>
    page.evaluate(() =>
      (
        window as unknown as {
          __arena: {
            ctx: { layers: { plane: { position: { z: number } } }[] }
          }
        }
      ).__arena.ctx.layers.map((l) => Math.round(l.plane.position.z))
    )
  expect((await floors()).every((z) => z === 0)).toBe(true) // parallel: all on z = 0
  await page
    .locator('#arrangementCard')
    .evaluate((el) => ((el as HTMLDetailsElement).open = true))
  await page.locator('#layerArrangement').selectOption('circle')
  await page.locator('#applyArrangement').dispatchEvent('click')
  await expect(page.locator('#layouts_status')).toContainText('Circle')
  expect((await floors()).some((z) => Math.abs(z) > 100)).toBe(true)
  await expect(page.locator('#predef_circle')).toBeChecked() // Scene panel in step
  await page.locator('#undoButton').dispatchEvent('click')
  await expect
    .poll(async () => (await floors()).every((z) => z === 0))
    .toBe(true)
  await page.locator('#layerArrangement').selectOption('fan')
  await page.locator('#applyArrangement').dispatchEvent('click')
  await expect(page.locator('#layouts_status')).toContainText('Fan')

  // chord diagram: floors on a ring (in the plane facing the viewer, so not
  // along z like the circle) and the nodes strung along their arcs
  const floorDistances = () =>
    page.evaluate(() =>
      (
        window as unknown as {
          __arena: {
            ctx: { layers: { plane: { position: { length: () => number } } }[] }
          }
        }
      ).__arena.ctx.layers.map((l) => l.plane.position.length())
    )
  const nodeSpread = () =>
    page.evaluate(() => {
      const c = (
        window as unknown as {
          __arena: {
            ctx: { nodeObjects: { getPosition: (a: string) => number }[] }
          }
        }
      ).__arena.ctx
      const ys = c.nodeObjects.map((n) => n.getPosition('y'))
      const zs = c.nodeObjects.map((n) => n.getPosition('z'))
      return {
        y: Math.max(...ys) - Math.min(...ys),
        z: Math.max(...zs) - Math.min(...zs),
        x: Math.max(...c.nodeObjects.map((n) => Math.abs(n.getPosition('x')))),
      }
    })
  const fan = await floors() // where Fan put the floors
  await page.locator('#layerArrangement').selectOption('chord')
  await page.locator('#applyArrangement').dispatchEvent('click')
  await expect(page.locator('#layouts_status')).toContainText('Chord')
  expect((await floorDistances()).every((d) => d > 100)).toBe(true)
  const spread = await nodeSpread()
  expect(spread.x).toBeLessThan(1) // flat on the floor
  expect(spread.z).toBeGreaterThan(100) // along the arc
  // one undo takes the chord diagram and its view fit back: the Fan floors
  await page.locator('#undoButton').dispatchEvent('click')
  await expect.poll(() => floors()).toEqual(fan)
})
