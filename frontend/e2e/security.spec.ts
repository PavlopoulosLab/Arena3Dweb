import { expect, test } from './fixtures'

// A session (or a shared /?session= link) whose colours carry markup must not
// inject it: colours are checked as CSS colours wherever they are used.

const PAYLOAD = '#fff"><img src=x onerror="window.__xss=1">'

test('colours from a session cannot inject markup', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await page
    .getByRole('tab', { name: 'File', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page.locator('#load_network_file').setInputFiles({
    name: 'session.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        layers: [{ name: 'L1', floor_current_color: PAYLOAD }, { name: 'L2' }],
        nodes: [
          { name: 'A', layer: 'L1', color: PAYLOAD },
          { name: 'B', layer: 'L1', color: 'red;position:fixed;inset:0' },
          { name: 'A', layer: 'L2' },
        ],
        edges: [{ src: 'A_L1', trg: 'B_L1' }],
      })
    ),
  })
  await expect(page.locator('#file_status')).toContainText('Session loaded')
  // the Layer selection swatches and the legend are drawn from those colours
  await page
    .getByRole('tab', {
      name: 'Layer selection',
      includeHidden: true,
      exact: true,
    })
    .dispatchEvent('click')
  await expect(page.locator('#checkboxdiv .layer-row')).toHaveCount(2)
  await page.waitForTimeout(500)
  expect(await page.locator('img[src="x"]').count()).toBe(0)
  expect(
    await page.evaluate(
      () => (window as unknown as { __xss?: number }).__xss ?? 0
    )
  ).toBe(0)
  const colours = await page.evaluate(() =>
    (
      window as unknown as {
        __arena: { ctx: { nodeObjects: { color: string }[] } }
      }
    ).__arena.ctx.nodeObjects.map((n) => n.color)
  )
  // the payloads are not kept: those nodes fall back to a plain colour
  for (const c of colours.slice(0, 2)) expect(c).toMatch(/^#[0-9a-f]{6}$/i)
})
