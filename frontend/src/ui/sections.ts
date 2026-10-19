// Folding cards in the panels — <details class="lp-section lp-more" id=…>
// (and the Database Importers' db-cards): every card starts folded, except a
// panel's only card, which starts open; the open state is remembered in this
// browser once the user opens or folds it, and an Expand all / Collapse all
// row (FOLD_ALL_HTML) does every card of its panel.

// .v2: the cards started open or folded before; begin again from all folded
const KEY = 'arena3d.sections.v2'
const OLD_KEYS = ['arena3d.sections']
const CARDS = 'details.lp-more[id], details.db-card[id]'

function saved(): Record<string, boolean> {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return v && typeof v === 'object' ? (v as Record<string, boolean>) : {}
  } catch {
    return {}
  }
}

function save(cards: HTMLDetailsElement[], open: boolean): void {
  const state = saved()
  for (const d of cards) state[d.id] = open
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* private mode: the choice lasts for this visit */
  }
}

export const FOLD_ALL_HTML = `
<div class="d-flex justify-content-end gap-3 mb-2">
  <button type="button" class="btn btn-link btn-sm p-0 text-decoration-none" data-fold-all="open">Expand all</button>
  <button type="button" class="btn btn-link btn-sm p-0 text-decoration-none" data-fold-all="close">Collapse all</button>
</div>`

/** Opens the card holding `el`, so a control the app points at can be seen. */
export function openCard(el: Element | null): void {
  const card = el?.closest('details')
  if (card) card.open = true
}

/** Restores the panels' cards as the user left them, then keeps track. */
export function initSections(): void {
  const root = document.getElementById('panelContent')
  if (!root) return
  try {
    OLD_KEYS.forEach((k) => localStorage.removeItem(k))
  } catch {
    /* private mode */
  }
  const state = saved()
  // e2e/fixtures.ts sets this so specs reach every control; sections.spec.ts
  // turns it off to test the folded defaults
  const openAll =
    (window as unknown as { __arenaOpenCards?: boolean }).__arenaOpenCards ===
    true
  // a panel of a single card shows it: there is nothing else to fold it for
  const single = new Set<HTMLDetailsElement>()
  root.querySelectorAll('.tab-pane').forEach((pane) => {
    const cards = [...pane.querySelectorAll<HTMLDetailsElement>(CARDS)].filter(
      (d) => !d.parentElement?.closest('details')
    )
    if (cards.length === 1) single.add(cards[0])
  })
  root.querySelectorAll<HTMLDetailsElement>(CARDS).forEach((d) => {
    if (openAll) d.open = true
    else if (typeof state[d.id] === 'boolean') d.open = state[d.id]
    else if (single.has(d)) d.open = true
  })
  // Only the user's own clicks are remembered (a summary is clicked by mouse
  // and by Enter / Space alike): a card the app opens to show something stays
  // folded on the next visit until the user opens it.
  root.addEventListener('click', (e) => {
    const target = e.target as Element
    const all = target.closest<HTMLElement>('[data-fold-all]')
    if (all) {
      const open = all.dataset.foldAll === 'open'
      const cards = [
        ...(
          all.closest('.tab-pane') ?? root
        ).querySelectorAll<HTMLDetailsElement>(CARDS),
      ]
      cards.forEach((d) => (d.open = open))
      return save(cards, open)
    }
    const card = target.closest('summary')?.parentElement
    if (e.defaultPrevented || !(card instanceof HTMLDetailsElement)) return
    // the click toggles the card after this listener: save the state it goes to
    if (card.matches(CARDS)) save([card], !card.open)
  })
}
