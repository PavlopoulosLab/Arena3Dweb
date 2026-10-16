import { expect, test, type Page } from '@playwright/test'
import path from 'node:path'

// Edit → Nodes → Label Style: colour, font, weight, halo, background and
// opacity for all node labels or for the selected layers; undoable.

const tab = (page: Page, name: string) =>
  page
    .getByRole('tab', { name, includeHidden: true, exact: true })
    .dispatchEvent('click')

type Ctx = { layers: { isSelected: boolean }[]; nodeLayerNames: string[] }
const labelStyles = (page: Page) =>
  page.evaluate(() => {
    const c = (window as unknown as { __arena: { ctx: Ctx } }).__arena.ctx
    const of = (i: number) => {
      const div = document.getElementById(`${c.nodeLayerNames[i]}_label`)!
      return {
        color: div.style.color,
        weight: div.style.fontWeight,
        italic: div.style.fontStyle,
        halo: div.style.textShadow !== '',
        background: div.style.background !== '',
        opacity: div.style.opacity,
      }
    }
    const firstOfLayer2 = c.nodeLayerNames.findIndex((n) =>
      n.endsWith('_Layer2')
    )
    return { layer1: of(0), layer2: of(firstOfLayer2) }
  })

test('label style for all nodes, then for one layer; undo', async ({
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
  await tab(page, 'Nodes')
  await page.locator('#nodeLabels_all').dispatchEvent('click')

  const set = (id: string, value: string | boolean) =>
    page.locator(`#${id}`).evaluate((el, value) => {
      const input = el as HTMLInputElement
      if (typeof value === 'boolean') {
        if (input.checked !== value) input.click()
      } else {
        input.value = value
        input.dispatchEvent(new Event('input', { bubbles: true }))
        input.dispatchEvent(new Event('change', { bubbles: true }))
      }
    }, value)
  await set('labelColor', '#ff0000')
  await set('labelBold', true)
  await set('labelHalo', true)
  await set('labelOpacity', '0.6')
  await page.locator('#applyLabelStyle').dispatchEvent('click')
  await expect(page.locator('#node_status')).toContainText('all nodes')
  const all = await labelStyles(page)
  expect(all.layer1).toMatchObject({
    color: 'rgb(255, 0, 0)',
    weight: 'bold',
    halo: true,
    opacity: '0.6',
  })
  expect(all.layer2.color).toBe('rgb(255, 0, 0)')

  // layer 2 only: green italic with a background; layer 1 keeps red bold
  await page.evaluate(() => {
    const c = (window as unknown as { __arena: { ctx: Ctx } }).__arena.ctx
    c.layers[1].isSelected = true
  })
  await set('labelTarget_layers', true)
  await set('labelColor', '#00ff00')
  await set('labelBold', false)
  await set('labelItalic', true)
  await set('labelBackground', true)
  await page.locator('#applyLabelStyle').dispatchEvent('click')
  await expect(page.locator('#node_status')).toContainText('1 layer')
  const per = await labelStyles(page)
  expect(per.layer2).toMatchObject({
    color: 'rgb(0, 255, 0)',
    italic: 'italic',
    background: true,
  })
  expect(per.layer1).toMatchObject({ color: 'rgb(255, 0, 0)', weight: 'bold' })

  await page.locator('#undoButton').dispatchEvent('click')
  expect((await labelStyles(page)).layer2.color).toBe('rgb(255, 0, 0)')
  await page.locator('#undoButton').dispatchEvent('click')
  expect((await labelStyles(page)).layer1.weight).toBe('')
})
