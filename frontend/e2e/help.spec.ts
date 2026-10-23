import { expect, test } from './fixtures'

// Help: every page opens; file formats are shown as tables, not tab-separated
// text; the How-to page holds its recipes; images and example downloads work.

test('help pages, format tables, how-to, images and example links', async ({
  page,
}) => {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await page
    .getByRole('tab', { name: 'Help', includeHidden: true, exact: true })
    .dispatchEvent('click')
  const buttons = page.locator('#helpDiv .tablinks')
  const n = await buttons.count()
  expect(n).toBeGreaterThanOrEqual(16)
  for (let i = 0; i < n; i++) {
    await buttons.nth(i).dispatchEvent('click')
    await expect(page.locator('#helpDiv .tabcontent:visible')).toHaveCount(1)
  }

  await page
    .locator('#helpDiv [data-help-tab="File_tab"]')
    .dispatchEvent('click')
  // six file formats as tables; no tab-separated <pre> examples left
  expect(await page.locator('#File_tab table.help-tsv').count()).toBe(6)
  const tabbedPre = await page
    .locator('#File_tab pre')
    .evaluateAll(
      (els) => els.filter((e) => e.textContent?.includes('\t')).length
    )
  expect(tabbedPre).toBe(0)
  await expect(
    page
      .locator('#File_tab .help-tsv-note', { hasText: 'Network file' })
      .locator('xpath=following-sibling::table[1]')
      .locator('th')
  ).toHaveCount(6)

  await page
    .locator('#helpDiv [data-help-tab="Howto_tab"]')
    .dispatchEvent('click')
  expect(await page.locator('#Howto_tab h3').count()).toBeGreaterThanOrEqual(11)
  await expect(page.locator('#Howto_tab')).toContainText('Upload node VALUES')

  const broken = await page.evaluate(async () => {
    const imgs = [
      ...document.querySelectorAll<HTMLImageElement>('#helpDiv img'),
    ]
    // lazy images in hidden pages never load on their own: force them
    for (const i of imgs) i.loading = 'eager'
    await Promise.all(
      imgs.map((i) =>
        i.complete
          ? Promise.resolve()
          : new Promise<void>((r) => {
              i.onload = () => r()
              i.onerror = () => r()
            })
      )
    )
    return imgs.filter((i) => !i.naturalWidth).map((i) => i.getAttribute('src'))
  })
  expect(broken).toEqual([])
  const links = await page
    .locator('#helpDiv a[download]')
    .evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href))
  expect(links.length).toBeGreaterThan(20)
  for (const href of links)
    expect((await page.request.get(href)).ok()).toBe(true)
})

test('About: publications newest first, each with DOI, PubMed and Copy citation', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await page
    .getByRole('tab', { name: 'Help', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page
    .locator('#helpDiv [data-help-tab="About_tab"]')
    .dispatchEvent('click')
  const about = page.locator('#About_tab')
  await expect(about).toBeVisible()

  // the release now, then four papers, newest first
  const years = await about
    .locator('.about-pub__year')
    .evaluateAll((els) => els.map((e) => Number(e.textContent)))
  expect(years).toEqual([2026, 2023, 2021, 2012, 2008])
  const papers = about.locator('.about-pub:has(.about-copy)')
  await expect(papers).toHaveCount(4)
  await expect(about.locator('.about-pub--cite')).toHaveCount(2)
  for (const doi of ['10.1093/nargab/lqad053', '10.1093/nar/gkab278'])
    await expect(
      about.locator(`.about-pub a[href="https://doi.org/${doi}"]`)
    ).toHaveCount(1)
  await expect(
    about.locator('.about-pub a[href*="pubmed.ncbi.nlm.nih.gov"]')
  ).toHaveCount(4)

  const copy = papers.first().locator('.about-copy')
  await copy.click()
  await expect(copy).toHaveText('Copied')
  const text = await page.evaluate(() => navigator.clipboard.readText())
  expect(text).toContain('NAR Genomics and Bioinformatics 5(2):lqad053')
  expect(text).toContain('doi:10.1093/nargab/lqad053')
  await expect(copy).toHaveText('Copy citation', { timeout: 4000 })

  // related tools, developers, and How to cite scrolls to the papers
  await expect(about.locator('.about-tool')).toHaveCount(3)
  await expect(about.locator('.about-person')).toHaveCount(3)
  await about.locator('#aboutToPubs').click()
  await expect(about.locator('#aboutPubs')).toBeInViewport()
})

test('Help layout: grouped navigation, page headers, figures, contents, callouts and example cards', async ({
  page,
}) => {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await page
    .getByRole('tab', { name: 'Help', includeHidden: true, exact: true })
    .dispatchEvent('click')
  const help = page.locator('#helpDiv')

  // every page button has an icon; the groups are named
  const buttons = help.locator('.tab .tablinks')
  await expect(help.locator('.tab .tablinks:not(:has(svg))')).toHaveCount(0)
  expect(await buttons.count()).toBeGreaterThanOrEqual(16)
  await expect(help.locator('.help-nav__group')).toHaveText([
    'Start',
    'Load & find',
    'View & layout',
    'Edit',
    'Analyse & share',
    'Reference',
  ])

  // every page but About opens with a header: its group, title and summary
  const pages = help.locator('.help-page')
  const n = await pages.count()
  expect(n).toBeGreaterThanOrEqual(15)
  await expect(help.locator('.help-page > .help-head h2')).toHaveCount(n)
  await expect(help.locator('.help-page > .help-head .help-lead')).toHaveCount(
    n
  )
  // pictures are framed with their alt text as the caption (the video
  // tour's still is its play button instead)
  await expect(
    help.locator('.help-page img:not(figure img):not(.tour img)')
  ).toHaveCount(0)
  await expect(
    help.locator('#File_tab .help-figure--panel figcaption')
  ).toHaveText('The File panel')

  // File: On this page scrolls to a section; menu paths are chips
  await help.locator('[data-help-tab="File_tab"]').dispatchEvent('click')
  const toc = help.locator('#File_tab .help-toc button')
  expect(await toc.count()).toBeGreaterThanOrEqual(4)
  await toc.filter({ hasText: 'File formats' }).click()
  await expect(
    help.locator('#File_tab h3', { hasText: 'File formats' })
  ).toBeInViewport()
  await expect(
    help.locator('#File_tab .help-path', { hasText: 'Edit → Edges' }).first()
  ).toBeVisible()
  await expect(help.locator('#File_tab .help-note')).toHaveCount(1)
  await expect(help.locator('#File_tab .help-tip')).toHaveCount(1)

  // option lists read as definition lists
  await help.locator('[data-help-tab="Databases_tab"]').dispatchEvent('click')
  await expect(
    help.locator('#Databases_tab ul.help-defs .help-term', {
      hasText: 'Reactome',
    })
  ).toBeVisible()

  // Examples: a card per example under each category, Open loads it
  await help.locator('[data-help-tab="Examples_tab"]').dispatchEvent('click')
  await expect(help.locator('#Examples_tab hr')).toHaveCount(0)
  const cards = help.locator('#Examples_tab .help-example')
  expect(await cards.count()).toBeGreaterThanOrEqual(15)
  const covid = cards.filter({ hasText: 'SARS-CoV-2 example' })
  await expect(covid.locator('.help-example__title')).toHaveText(
    'SARS-CoV-2 example'
  )
  await expect(covid.locator('a[download]')).toHaveCount(4)
  await covid.locator('.help-example__open').click()
  await expect(page.locator('#file_status')).toContainText('Session loaded')
})

test('Privacy & Data and browser support: a Help page, an About card and Getting Started', async ({
  page,
}) => {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await page
    .getByRole('tab', { name: 'Help', includeHidden: true, exact: true })
    .dispatchEvent('click')
  const help = page.locator('#helpDiv')
  await expect(
    help.locator('#Start_tab h3', { hasText: 'Browsers' })
  ).toHaveCount(1)
  await expect(help.locator('#Start_tab')).toContainText(
    'Chrome, Edge, Firefox and Safari'
  )

  // About: a fact card says it is free, and opens the Privacy & Data page
  await help.locator('[data-help-tab="About_tab"]').dispatchEvent('click')
  await expect(help.locator('#About_tab .about-eyebrow')).toContainText(
    'no login required'
  )
  await expect(help.locator('#About_tab .about-fact')).toHaveCount(6)
  await help.locator('#aboutToPrivacy').click()
  const privacy = help.locator('#Privacy_tab')
  await expect(privacy).toBeVisible()
  await expect(help.locator('[data-help-tab="Privacy_tab"]')).toHaveClass(
    /active/
  )
  await expect(privacy.locator('.help-head h2')).toHaveText('Privacy & Data')
  await expect(privacy.locator('h3')).toHaveText([
    'Free and open to all',
    'Your data',
    'No cookies, no tracking',
    'Other services, only when you ask',
    'Running it yourself',
  ])
  for (const service of ['STRING', 'NORMA', 'Gephi Lite', 'Cytoscape'])
    await expect(privacy).toContainText(service)
})
