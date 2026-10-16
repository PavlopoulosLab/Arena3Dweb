import { Collapse, Dropdown, Tab } from 'bootstrap'

/** Programmatically activate a navbar tab by its pane selector, e.g. '#panel-file'. */
export function showTab(paneSelector: string): void {
  const trigger = document.querySelector(`[data-bs-target="${paneSelector}"]`)
  if (trigger) Tab.getOrCreateInstance(trigger).show()
}

// On phones/narrow windows the menu bar is a collapsed ☰ menu: close it once a
// panel is chosen so the panel isn't hidden behind the open menu.
export function initMenuAutoClose(): void {
  const menu = document.getElementById('navbarTabs')
  if (!menu) return
  // Bootstrap's tab plugin opens the dropdown holding the tab it activates,
  // so programmatic switches (e.g. to 3D View after loading a file) would
  // leave a menu hanging open; close it once the panel is shown.
  // Choosing the panel that is already active fires no shown.bs.tab, so a
  // click closes the menu too.
  menu
    .querySelectorAll('.dropdown-item[data-bs-toggle="tab"]')
    .forEach((el) => {
      const close = () => {
        const dd = el.closest('.dropdown')
        const toggle = dd?.querySelector<HTMLElement>(
          '[data-bs-toggle="dropdown"]'
        )
        dd?.querySelector('.dropdown-menu')?.classList.remove('show')
        if (toggle) {
          toggle.setAttribute('aria-expanded', 'false')
          Dropdown.getInstance(toggle)?.hide()
        }
      }
      el.addEventListener('shown.bs.tab', close)
      el.addEventListener('click', close)
    })
  menu.querySelectorAll('[data-bs-toggle="tab"]').forEach((el) =>
    el.addEventListener('click', () => {
      if (menu.classList.contains('show'))
        Collapse.getOrCreateInstance(menu).hide()
    })
  )
}
