// View → Annotations: how annotation groups and clusters are highlighted in
// the scene, in five cards — What to show (the set or the clusters), How to
// draw (the shape around each group, its opacity and padding), On the nodes
// (pies, group colours) in ui/annotations.ts; Groups (the list with colours
// and a switch per group) and Legend & reports in ui/groups.ts. Analyze →
// Annotations & Groups (enrichment), the Networks menu and the Clustering
// panel link here with openAnnotationPanel().

import { ANNOTATION_VIEW_HTML, initAnnotations } from './annotations'
import { GROUPS_HTML, initGroups } from './groups'
import { FOLD_ALL_HTML, openCard } from './sections'
import { showTab } from './tabs'

const HTML = `
<div class="col-md-8 col-lg-6 layout-panel annotation-panel">
  ${FOLD_ALL_HTML}
  ${ANNOTATION_VIEW_HTML}
  ${GROUPS_HTML}
</div>
`

/** Shows View → Annotations; with `around`, draws around those groups. */
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
  // the links in the cards: another panel, and the card there to open
  pane.addEventListener('click', (e) => {
    const link = (e.target as Element).closest<HTMLElement>('[data-ann-go]')
    if (!link) return
    e.preventDefault()
    showTab(link.dataset.annGo!)
    const card = link.dataset.annCard
      ? document.getElementById(link.dataset.annCard)
      : null
    if (card) {
      openCard(card.querySelector('summary'))
      card.scrollIntoView({ block: 'nearest' })
    }
  })
}
