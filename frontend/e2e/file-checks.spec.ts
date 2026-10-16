import { expect, test } from '@playwright/test'

// PLAN-ROADMAP Phase 22: files are checked before upload (with the line at
// fault), server errors read cleanly, and a progress bar shows the stages.

const file = (name: string, text: string) => ({
  name,
  mimeType: 'text/plain',
  buffer: Buffer.from(text),
})

test('pre-checks, readable server errors, progress bar', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await page
    .getByRole('tab', { name: 'File', includeHidden: true, exact: true })
    .click()
  let uploads = 0
  page.on('request', (r) => {
    if (r.url().endsWith('/api/network')) uploads++
  })

  const input = page.locator('#input_network_file')
  await input.setInputFiles(file('net.csv', 'a,b\n'))
  await expect(page.locator('#file_status')).toContainText('expected a')
  await input.setInputFiles(file('net.tsv', 'SourceNode,TargetNode\nA,B\n'))
  await expect(page.locator('#file_status')).toContainText('TAB-separated')
  await input.setInputFiles(
    file('net.tsv', 'SourceNode\tTargetNode\tWeight\nA\tB\t1\nC\tD\tlots\n')
  )
  await expect(page.locator('#file_status')).toContainText(
    'line 3 has a non-numeric Weight "lots"'
  )
  expect(uploads).toBe(0) // none of these reached the server

  // only the server knows channels must be non-empty -> clean message, line no.
  await input.setInputFiles(
    file('net.tsv', 'SourceNode\tTargetNode\tChannel\nA\tB\tppi\nC\tD\t \n')
  )
  await expect(page.locator('#file_status')).toHaveText(
    'At least one edge has no channel name (first on line 3). Please reupload the network file with all edge channels.'
  )
  expect(uploads).toBe(1)

  // a good file: the progress bar shows while loading and hides afterwards
  const rows = Array.from(
    { length: 3000 },
    (_, i) => `N${i}\tN${(i * 7) % 3000}\t1`
  )
  const seen: string[] = []
  await page.exposeFunction('seenProgress', (t: string) => seen.push(t))
  await page.evaluate(() => {
    const bar = document.querySelector('#file_progress .progress-bar')!
    new MutationObserver(() =>
      (window as unknown as { seenProgress: (t: string) => void }).seenProgress(
        bar.textContent ?? ''
      )
    ).observe(bar, { childList: true, characterData: true, subtree: true })
  })
  await page
    .getByRole('tab', { name: 'File', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await input.setInputFiles(
    file('big.tsv', 'SourceNode\tTargetNode\tWeight\n' + rows.join('\n') + '\n')
  )
  // 3000 nodes/edges means building the scene (software GL on CI) can run
  // past the default 5s assertion timeout — see the project-wide note in
  // playwright.config.ts about CI having no GPU.
  await expect(page.locator('#file_status')).toContainText('Loaded network', {
    timeout: 30_000,
  })
  await expect(page.locator('#file_progress')).toBeHidden()
  expect(seen.some((t) => t.startsWith('Uploading'))).toBe(true)
  expect(seen.some((t) => t.startsWith('Building the scene'))).toBe(true)
})
