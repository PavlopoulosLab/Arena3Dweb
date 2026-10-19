// The API panel (top bar → API, before Help): Arena3D's REST API for scripts
// and other tools — where it is, what it allows, ready-to-run code in curl,
// Python, R and JavaScript, and the interactive Swagger UI. Swagger UI is
// bundled (swagger-ui-dist), not fetched from a CDN, and loads the first time
// the panel opens; its "Try it out" calls this server.

import { escapeHtml } from '../utils'
import { showTab } from './tabs'

const SPEC = '/api/openapi.json'

type Config = {
  version?: string
  max_edges?: number
  max_nodes?: number
  max_layers?: number
  max_channels?: number
  max_upload_bytes?: number
  compute_seconds?: number
}

// ready-to-run snippets: open a network as a link, then a metric per layer
function snippets(origin: string): Record<string, string> {
  const rows = [
    '{"source": "TP53", "target": "MDM2", "source_layer": "PPI"}',
    '{"source": "TP53", "target": "CDKN1A", "source_layer": "PPI"}',
    '{"source": "TP53", "target": "BAX", "source_layer": "Regulation"}',
    '{"source": "TP53", "target": "TP53", "source_layer": "PPI", "target_layer": "Regulation"}',
  ]
  const list = (indent: string) =>
    `[\n${rows.map((r) => indent + r).join(',\n')},\n]`
  return {
    curl: `# open a network in Arena3D: the answer holds a link, valid for one hour
curl -s -X POST ${origin}/api/open \\
  -H 'Content-Type: application/json' \\
  -d '{"layout": "Fruchterman-Reingold", "edges": [${rows.join(', ')}]}'

# what the server allows, and the names it accepts
curl -s ${origin}/api/config`,
    Python: `import requests

API = "${origin}/api"
edges = ${list('    ')}

# open the network in Arena3D: a link, valid for one hour
link = requests.post(f"{API}/open", json={"edges": edges, "layout": "Fruchterman-Reingold"})
print(link.json()["url"])

# what the server allows, and the names it accepts
cfg = requests.get(f"{API}/config").json()
print(cfg["layouts"], cfg["clustering_algorithms"])`,
    R: `library(httr2)

api <- "${origin}/api"
edges <- list(
  list(source = "TP53", target = "MDM2", source_layer = "PPI"),
  list(source = "TP53", target = "CDKN1A", source_layer = "PPI"),
  list(source = "TP53", target = "BAX", source_layer = "Regulation"),
  list(source = "TP53", target = "TP53", source_layer = "PPI", target_layer = "Regulation")
)

# open the network in Arena3D: a link, valid for one hour
res <- request(paste0(api, "/open")) |>
  req_body_json(list(edges = edges, layout = "Fruchterman-Reingold")) |>
  req_perform() |>
  resp_body_json()
res$url`,
    JavaScript: `const API = '${origin}/api'
const edges = ${list('  ')}

// open the network in Arena3D: a link, valid for one hour
const res = await fetch(\`\${API}/open\`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ edges, layout: 'Fruchterman-Reingold' }),
})
const { url } = await res.json()
window.open(url, '_blank', 'noopener')`,
  }
}

const API_HTML = (origin: string) => {
  const code = snippets(origin)
  const langs = Object.keys(code)
  return `
<div class="api-page">
  <header class="api-head">
    <p class="api-kicker">Programmatic access</p>
    <h2>Arena3D REST API</h2>
    <p class="api-lead">Open networks in Arena3D from your own code, and run layouts, clustering, metrics,
    statistics, perturbation, plots, enrichment and database imports without the browser. JSON in, JSON out;
    no key, and any origin may call it.</p>
  </header>

  <section class="api-facts" aria-label="The API at a glance">
    <div class="api-fact"><span class="api-fact__label">Base URL</span><code id="apiBase">${escapeHtml(origin)}/api</code></div>
    <div class="api-fact"><span class="api-fact__label">Version</span><span id="apiVersion">—</span></div>
    <div class="api-fact"><span class="api-fact__label">Limits</span><span id="apiLimits">—</span></div>
    <div class="api-fact"><span class="api-fact__label">Description</span>
      <span><a href="${SPEC}" target="_blank" rel="noopener">OpenAPI JSON</a> ·
      <a href="/api/redoc" target="_blank" rel="noopener">ReDoc</a> ·
      <a href="/api/docs" target="_blank" rel="noopener">Swagger in a tab</a> ·
      <a href="#" id="apiHelpLink">Help → API</a></span></div>
  </section>

  <section class="api-card">
    <h3>Quick start</h3>
    <p class="api-hint">Open a two-layer network in Arena3D as a link; the server lays it out. Every request in
    the reference below has a worked example that runs as it is.</p>
    <div class="api-tabs" role="tablist" aria-label="Language">
      ${langs
        .map(
          (l, i) =>
            `<button type="button" role="tab" class="api-tab${i ? '' : ' is-active'}" data-lang="${l}" aria-selected="${i === 0}">${l}</button>`
        )
        .join('')}
      <button type="button" class="api-copy" id="apiCopy" title="Copy the code">Copy</button>
    </div>
    ${langs
      .map(
        (l, i) =>
          `<pre class="api-code${i ? ' d-none' : ''}" data-lang="${l}"><code>${escapeHtml(code[l])}</code></pre>`
      )
      .join('')}
  </section>

  <section class="api-card">
    <h3>Try it here</h3>
    <p class="api-hint">Every endpoint, grouped as in the app: open one, press <i>Try it out</i>, then
    <i>Execute</i>. Requests go to this server; database imports reach STRING, EBI, NDEx, Reactome and
    QuickGO from it.</p>
    <div id="swaggerUi" class="api-swagger"><p class="api-hint" id="swaggerStatus">Loading the interactive reference…</p></div>
  </section>
</div>`
}

let swaggerLoaded = false

async function loadSwagger(): Promise<void> {
  if (swaggerLoaded) return
  swaggerLoaded = true
  const status = document.getElementById('swaggerStatus')
  try {
    const [{ default: SwaggerUIBundle }] = await Promise.all([
      import('swagger-ui-dist/swagger-ui-es-bundle.js'),
      import('swagger-ui-dist/swagger-ui.css'),
    ])
    SwaggerUIBundle({
      url: SPEC,
      dom_id: '#swaggerUi',
      deepLinking: false,
      docExpansion: 'list',
      defaultModelsExpandDepth: 0,
      displayRequestDuration: true,
      filter: true,
      tryItOutEnabled: false,
    })
  } catch {
    swaggerLoaded = false
    if (status)
      status.innerHTML = `The interactive reference could not load here; open it <a href="/api/docs" target="_blank" rel="noopener">in a tab</a>.`
  }
}

async function loadFacts(): Promise<void> {
  try {
    const cfg = (await (await fetch('/api/config')).json()) as Config
    const v = document.getElementById('apiVersion')
    if (v && cfg.version) v.textContent = cfg.version
    const l = document.getElementById('apiLimits')
    if (l)
      l.textContent = [
        cfg.max_nodes && `${cfg.max_nodes.toLocaleString('en')} nodes`,
        cfg.max_edges && `${cfg.max_edges.toLocaleString('en')} edges`,
        cfg.max_layers && `${cfg.max_layers} layers`,
        cfg.max_channels && `${cfg.max_channels} channels`,
        cfg.max_upload_bytes &&
          `${Math.round(cfg.max_upload_bytes / 1048576)} MB per request`,
        cfg.compute_seconds && `${cfg.compute_seconds} s per computation`,
      ]
        .filter(Boolean)
        .join(' · ')
  } catch {
    /* the facts stay as dashes */
  }
}

export function initApiPanel(): void {
  const pane = document.getElementById('panel-api')
  if (!pane) return
  pane.innerHTML = API_HTML(window.location.origin)
  // the language tabs and the copy button
  const tabs = [...pane.querySelectorAll<HTMLButtonElement>('.api-tab')]
  const blocks = [...pane.querySelectorAll<HTMLElement>('.api-code')]
  tabs.forEach((t) =>
    t.addEventListener('click', () => {
      tabs.forEach((o) => {
        o.classList.toggle('is-active', o === t)
        o.setAttribute('aria-selected', String(o === t))
      })
      blocks.forEach((b) =>
        b.classList.toggle('d-none', b.dataset.lang !== t.dataset.lang)
      )
    })
  )
  const copy = document.getElementById('apiCopy') as HTMLButtonElement
  const copyCode = async () => {
    const shown = blocks.find((b) => !b.classList.contains('d-none'))
    try {
      await navigator.clipboard.writeText(shown?.textContent ?? '')
      copy.textContent = 'Copied'
    } catch {
      copy.textContent = 'Copy failed'
    }
    setTimeout(() => (copy.textContent = 'Copy'), 1500)
  }
  copy.addEventListener('click', () => void copyCode())
  document.getElementById('apiHelpLink')?.addEventListener('click', (e) => {
    e.preventDefault()
    showTab('#panel-help')
    document
      .querySelector<HTMLElement>('#helpDiv [data-help-tab="API_tab"]')
      ?.click()
  })
  // the facts and the reference load the first time the panel opens
  document
    .querySelector('[data-bs-target="#panel-api"]')
    ?.addEventListener('shown.bs.tab', () => {
      void loadFacts()
      void loadSwagger()
    })
}
