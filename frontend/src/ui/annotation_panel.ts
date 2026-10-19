// The Annotations menu (top bar, after Clustering): how annotation groups and
// clusters show in the scene — the annotation set, hulls or fog clouds with
// their opacity and padding, pies (ui/annotations.ts), and the group list
// with colours and a hull switch per group (ui/groups.ts). Analyze →
// Annotations & Groups (enrichment), the Networks menu and the Clustering
// panel link here with openAnnotationPanel().

import { ANNOTATION_VIEW_HTML, initAnnotations } from './annotations'
import { GROUPS_HTML, initGroups } from './groups'
import { openCard } from './sections'
import { showTab } from './tabs'

const HTML = `
<div class="col-md-8 col-lg-6 layout-panel annotation-panel">
  ${ANNOTATION_VIEW_HTML}
  ${GROUPS_HTML}
</div>
`

/** Shows the Annotations menu; with `around`, draws around those groups. */
export function openAnnotationPanel(around?: 'cluster' | 'annotation'): void {
  showTab('#panel-annotation-view')
  const card = document.getElementById('annCard_show')
  openCard(card?.querySelector('summary') ?? null)
  if (around) {
    const radio = document.getElementById(
      `hull_${around}`
    ) as HTMLInputElement | null
    if (radio && !radio.disabled && !radio.checked) {
      radio.checked = true
      radio.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const list = document.getElementById(
      'groupsSource'
    ) as HTMLSelectElement | null
    const option = list?.querySelector<HTMLOptionElement>(
      `option[value="${around}"]`
    )
    if (list && option && !option.disabled && list.value !== around) {
      list.value = around
      list.dispatchEvent(new Event('change', { bubbles: true }))
    }
  }
  card?.scrollIntoView({ block: 'nearest' })
}

export function initAnnotationPanel(): void {
  const pane = document.getElementById('panel-annotation-view')
  if (!pane) return
  pane.innerHTML = HTML
  initAnnotations()
  initGroups()
  // the links under the main card: Clustering, Analyze, Layout's Group Layout
  pane.addEventListener('click', (e) => {
    const link = (e.target as Element).closest<HTMLElement>('[data-ann-go]')
    if (!link) return
    e.preventDefault()
    const target = link.dataset.annGo!
    showTab(target)
    if (target === '#panel-layouts') {
      const card = document.getElementById('groupLayoutCard')
      openCard(card?.querySelector('summary') ?? null)
      card?.scrollIntoView({ block: 'nearest' })
    }
  })
}
