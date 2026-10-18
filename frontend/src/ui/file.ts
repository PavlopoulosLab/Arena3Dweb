// File panel — port of v2 views/file.R + functions/input.R upload handlers.

import { api, type UploadProgress } from '../api/client'
import { escapeHtml } from '../utils'
import { bus } from '../bus'
import { renderCompareTable } from './data'
import {
  activeSlot,
  compareSets,
  compareWith,
  listSlots,
  registerAnnotationSet,
  registerLoad,
  removeSlot,
  snapshotActive,
  switchTo,
} from '../actions/workspace'
import {
  checkFileMeta,
  checkFileText,
  type FileKind,
} from '../actions/filecheck'
import { applyEdgeAttributes } from '../actions/edge'
import { loadSession } from '../actions/network'
import {
  askImportAs,
  askSessionView,
  placeNetwork,
  showSessionAs,
} from './import_as'
import { applyNodeAttributes } from '../actions/node'
import { applyGroups } from '../actions/groups'
import { matchedNodes, setValues } from '../actions/values'
import { renderValuesTable } from './data'
import { startLoader, finishLoader } from '../actions/screen'
import { exportSession } from '../actions/session'
import { showTab } from './tabs'
import { ctx } from '../three'
import { history } from '../commands/base'
import { PredefinedLayoutCommand } from '../commands/scene'
import { applyPredefinedLayout } from '../actions/layout'
import {
  HIVE_FIT,
  hivePositions,
  nodeDegrees,
  type HiveAxes,
  type HiveScale,
} from '../actions/hive'
import { fitViewNow } from '../actions/search'

// Load Example choices (public/data); .json files load as sessions
export const EXAMPLES = [
  { file: 'figure2A_data.tsv', label: 'Four weighted layers' },
  {
    file: 'figure2A_export.json',
    label: 'Four layers forming a cube (session)',
  },
  {
    file: 'figure1_export.json',
    label: 'Six layers with different random topologies',
  },
  {
    file: 'figure2B_export.json',
    label: 'Four layers with node and edge attributes',
  },
  {
    file: 'covid19_export.json',
    label: 'SARS-CoV-2 host–virus network (5 layers)',
  },
  {
    file: 'covid19_no_layers.tsv',
    label: 'SARS-CoV-2 network without layers (edgelist)',
  },
  {
    file: 'covid19_3d_network.json',
    label: 'SARS-CoV-2 as one 3D network (layers ignored)',
  },
  { file: 'GPCRs_export.json', label: 'GPCR signalling (4 layers)' },
  { file: 'GPCRs_spheres.json', label: 'GPCR signalling, layers as spheres' },
  {
    file: 'aspirin_3channels_directed.json',
    label: 'Aspirin, three channels, directed',
  },
  {
    file: 'Arena3DApp_aspirin.json',
    label: 'Aspirin from Cytoscape (Arena3DApp)',
  },
  {
    file: 'prego.json',
    label: 'PREGO anaerobic ammonium oxidation, three channels',
  },
  { file: 'edgelist_2columns.tsv', label: 'Minimal two-column edgelist' },
  // hive plots (Krzywinski et al. 2012): the layers become the axes, nodes
  // placed by degree — by rank where most nodes share one or two links
  {
    file: 'prego.tsv',
    label: 'Hive plot: PREGO, three layers as three axes',
    hive: { scale: 'rank', axes: 'flat' },
  },
  {
    file: 'GPCRs_data.tsv',
    label: 'Hive plot: GPCR signalling, four axes',
    hive: { scale: 'axis', axes: 'flat' },
  },
  {
    file: 'covid19_data.tsv',
    label: 'Hive plot: SARS-CoV-2 host–virus network, five axes',
    hive: { scale: 'axis', axes: 'flat' },
  },
  // …and with the axes spread in 3D: every two axes neighbours
  {
    file: 'GPCRs_data.tsv',
    label: '3D hive plot: GPCR signalling, four axes as a tetrahedron',
    hive: { scale: 'axis', axes: '3d' },
  },
  {
    file: 'covid19_data.tsv',
    label: '3D hive plot: SARS-CoV-2 host–virus network, five axes on a sphere',
    hive: { scale: 'axis', axes: '3d' },
  },
  {
    file: 'figure1_data.tsv',
    label: '3D hive plot: six layers along ±X, ±Y and ±Z',
    hive: { scale: 'rank', axes: '3d' },
  },
] satisfies {
  file: string
  label: string
  hive?: { scale: HiveScale; axes: HiveAxes }
}[]

const FILE_HTML = `
<div class="col-md-6 col-lg-4">
  <h6>Network</h6>
  <div class="mb-3">
    <label for="input_network_file" class="form-label">Upload Network (TSV, GraphML, GML, SIF, CX2):</label>
    <input class="form-control" type="file" id="input_network_file" accept=".tsv,.txt,.graphml,.xml,.gml,.sif,.cx2,.cx" />
  </div>
  <div class="mb-3">
    <label for="load_network_file" class="form-label">Load Session:</label>
    <input class="form-control" type="file" id="load_network_file" accept=".json" />
  </div>
  <h6>Attributes</h6>
  <div class="mb-3">
    <label for="node_attributes_file" class="form-label">Upload NODE attributes:</label>
    <input class="form-control" type="file" id="node_attributes_file" accept=".tsv,.txt" />
  </div>
  <div class="mb-3">
    <label for="edge_attributes_file" class="form-label">Upload EDGE attributes:</label>
    <input class="form-control" type="file" id="edge_attributes_file" accept=".tsv,.txt" />
  </div>
  <div class="mb-3">
    <label for="groups_file" class="form-label">Upload GROUP file (annotations, NORMA format):</label>
    <input class="form-control" type="file" id="groups_file" accept=".tsv,.txt" />
    <div class="form-text">One group per line: name, TAB, its members (comma-separated). Nodes are matched by name in every layer.</div>
  </div>
  <div class="mb-3">
    <label for="values_file" class="form-label">Upload node VALUES (expression, scores):</label>
    <input class="form-control" type="file" id="values_file" accept=".tsv,.txt" />
    <div class="form-text">Node, then one numeric column per condition; colour nodes by a column in Edit → Style.</div>
  </div>
  <h6>Examples</h6>
  <div class="mb-2">
    <label for="exampleChoice" class="form-label">Example:</label>
    <select class="form-select form-select-sm" id="exampleChoice">
      ${EXAMPLES.map((e, i) => `<option value="${i}">${e.label}</option>`).join('')}
    </select>
  </div>
  <h6>Loaded networks</h6>
  <div class="workspace mb-3" id="workspaceCard">
    <div id="workspaceList" class="workspace-list"></div>
    <div class="form-text">Every load adds a network here; switching keeps each one as it was (layout, colours, shapes, annotations, mode). Compare the active network with another in Data Tables.</div>
    <div class="d-flex flex-wrap align-items-center gap-2 mt-2">
      <select id="compareWith" class="form-select form-select-sm" style="width:auto" aria-label="Network to compare with"></select>
      <button id="compareNetworks" class="btn btn-outline-primary btn-sm">Compare Networks</button>
    </div>
  </div>
  <div class="file-actions">
    <button id="save_network_object" class="btn btn-primary file-action">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2.8 2.2h8.4L13.2 4.6v9.2a1 1 0 0 1-1 1H2.8a1 1 0 0 1-1-1V3.2a1 1 0 0 1 1-1Z"/><path d="M4.6 2.2v3.6h5.4V2.2"/><path d="M4.9 9.4h6.2v4.4H4.9Z"/></svg>
      <span>Save Session</span>
    </button>
    <button id="exampleButton" class="btn btn-outline-secondary file-action">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6.3 2.4h3.4"/><path d="M6.8 2.4v3.1L3.6 11a1.3 1.3 0 0 0 1.1 2h6.6a1.3 1.3 0 0 0 1.1-2L9.2 5.5V2.4"/><path d="M5.1 9.4h5.8"/></svg>
      <span>Load Example</span>
    </button>
  </div>
  <div id="file_progress" class="progress mt-3 d-none" role="progressbar" aria-label="Loading progress" style="height: 1.25rem">
    <div class="progress-bar" style="width: 0%"></div>
  </div>
  <div id="file_status" class="mt-3 small text-danger"></div>
</div>
`

function status(msg: string, isError = false): void {
  const el = document.getElementById('file_status')
  if (!el) return
  el.textContent = msg
  el.className = `mt-3 small ${isError ? 'text-danger' : 'text-success'}`
}

// Progress bar: a fraction fills it; null shows an animated "busy" bar.
function progress(label: string | false, fraction: number | null = null): void {
  const wrap = document.getElementById('file_progress')
  const bar = wrap?.firstElementChild as HTMLElement | null
  if (!wrap || !bar) return
  wrap.classList.toggle('d-none', label === false)
  if (label === false) return
  bar.textContent = label
  bar.style.width = `${Math.round((fraction ?? 1) * 100)}%`
  bar.classList.toggle('progress-bar-striped', fraction === null)
  bar.classList.toggle('progress-bar-animated', fraction === null)
  wrap.setAttribute('aria-valuenow', String(Math.round((fraction ?? 1) * 100)))
}

const uploadProgress: UploadProgress = (stage, f) =>
  stage === 'upload'
    ? progress(`Uploading ${Math.round(f * 100)}%`, f)
    : progress('Checking the file on the server…')

// let the progress bar paint before a long synchronous scene build
const nextFrame = () =>
  new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)))

// Size/extension, then content checks — before anything is uploaded.
async function precheck(file: File, kind: FileKind): Promise<boolean> {
  const problem =
    checkFileMeta(file.name, file.size, kind) ??
    checkFileText(file.name, await file.text(), kind)
  if (problem) {
    progress(false)
    status(problem, true)
  }
  return problem === null
}

// @return false when the user cancels the "Import as" popup
async function onUploadNetwork(file: File): Promise<boolean> {
  if (!(await precheck(file, 'network'))) return true
  const mode = await askImportAs(file.name)
  if (!mode) return false
  startLoader()
  try {
    progress('Uploading 0%', 0)
    const data = await api.uploadNetwork(file, uploadProgress)
    progress(
      `Building the scene (${data.nodes.length} nodes, ${data.edges.length} edges)…`
    )
    await nextFrame()
    status(await placeNetwork(data, mode, file.name))
    showTab('#panel-main-view') // reveal the scene; drawer toggle shows closed
  } catch (err) {
    status(err instanceof Error ? err.message : 'Network upload failed.', true)
  } finally {
    progress(false)
    finishLoader()
  }
  return true
}

// @return false when the user cancels the "Import as" popup
async function onLoadSession(file: File): Promise<boolean> {
  if (!(await precheck(file, 'session'))) return true
  const view = await askSessionView(file.name)
  if (!view) return false
  startLoader()
  try {
    progress('Uploading 0%', 0)
    const session = await api.importSession(file, uploadProgress)
    progress('Building the scene…')
    await nextFrame()
    snapshotActive()
    loadSession(session)
    registerLoad(file.name)
    await showSessionAs(view)
    const warnings = session.warnings ?? []
    status(
      warnings.length
        ? `Session loaded. ${warnings.join(' ')}`
        : 'Session loaded.'
    )
    showTab('#panel-main-view') // reveal the scene; drawer toggle shows closed
  } catch (err) {
    status(err instanceof Error ? err.message : 'Session load failed.', true)
  } finally {
    progress(false)
    finishLoader()
  }
  return true
}

// also used by the Home page's example picker
export async function loadExample(index: number): Promise<void> {
  const choice = document.getElementById(
    'exampleChoice'
  ) as HTMLSelectElement | null
  if (choice) choice.value = String(index)
  await onLoadExample()
}

async function onLoadExample(): Promise<void> {
  try {
    // Sub-path deployment fix: this is a hardcoded root-absolute fetch, so
    // Vite's `base` rewriting (which only covers Vite-generated asset/HTML
    // URLs) doesn't apply here — prefix it manually via BASE_URL so it still
    // resolves under a reverse-proxied sub-path (e.g. /arena3/). Without the
    // res.ok check, a 404 here would silently POST the error page's body to
    // /api/network as if it were the TSV.
    const choice = document.getElementById(
      'exampleChoice'
    ) as HTMLSelectElement | null
    const example =
      (
        EXAMPLES as {
          file: string
          hive?: { scale: HiveScale; axes: HiveAxes }
        }[]
      )[Number(choice?.value ?? 0)] ?? EXAMPLES[0]
    const name = example.file
    const res = await fetch(`${import.meta.env.BASE_URL}data/${name}`)
    if (!res.ok)
      throw new Error(`Failed to fetch example network: ${res.status}`)
    const json = name.endsWith('.json')
    const file = new File([await res.blob()], name, {
      type: json ? 'application/json' : 'text/tab-separated-values',
    })
    const loaded = await (json ? onLoadSession(file) : onUploadNetwork(file))
    // hive plot examples open as one, when shown multilayered
    if (
      loaded &&
      example.hive &&
      ctx.layers.length > 1 &&
      ctx.networkMode === 'multilayer'
    ) {
      const { scale, axes } = example.hive
      const input = {
        position: hivePositions(nodeDegrees(), scale),
        curved: true,
        axes,
      }
      history.execute(
        new PredefinedLayoutCommand('hive', () => {
          applyPredefinedLayout('hive', input)
          fitViewNow(HIVE_FIT)
        })
      )
      status(
        `Loaded ${name} as a ${axes === '3d' ? '3D ' : ''}hive plot: ${ctx.layers.length} layers as axes${axes === '3d' ? ' spread in 3D' : ''}, nodes by degree${scale === 'rank' ? ' (rank)' : ''}. Layout → Layer Arrangement changes it.`
      )
    }
  } catch (err) {
    status(err instanceof Error ? err.message : 'Example load failed.', true)
  }
}

// v2 handleInputNodeAttributeFileUpload / handleInputEdgeAttributeFileUpload.
async function onUploadNodeAttributes(file: File): Promise<void> {
  if (!(await precheck(file, 'nodeAttributes'))) return
  startLoader()
  try {
    const rows = await api.uploadNodeAttributes(file)
    applyNodeAttributes(rows)
    const annotatedIds = new Set(
      rows.filter((r) => r.annotations?.length).map((r) => r.node_layer)
    )
    registerAnnotationSet(file.name, (_, id) => annotatedIds.has(id))
    // keep the Node Actions color-priority radio in sync (v2 clicked it)
    const radio = document.querySelector<HTMLInputElement>(
      'input[name="nodeColorPriorityRadio"][value="default"]'
    )
    if (radio) radio.checked = true
    status('Node attributes applied.')
  } catch (err) {
    status(
      err instanceof Error ? err.message : 'Bad node attributes file format.',
      true
    )
  } finally {
    finishLoader()
  }
}

async function onUploadGroups(file: File): Promise<void> {
  if (!(await precheck(file, 'groups'))) return
  startLoader()
  try {
    const rows = await api.uploadGroups(file)
    const n = applyGroups(rows)
    const named = new Set(rows.map((r) => r.node))
    if (n) registerAnnotationSet(file.name, (name) => named.has(name))
    const groups = new Set(rows.flatMap((r) => r.groups)).size
    status(
      n
        ? `${groups} groups applied to ${n} nodes — see Analyze → Groups.`
        : 'No node of the network is named in that file.',
      !n
    )
  } catch (err) {
    status(err instanceof Error ? err.message : 'Bad group file format.', true)
  } finally {
    finishLoader()
  }
}

async function onUploadValues(file: File): Promise<void> {
  if (!(await precheck(file, 'values'))) return
  startLoader()
  try {
    const table = await api.uploadValues(file)
    setValues(table)
    renderValuesTable(table.columns, table.rows)
    const n = matchedNodes()
    status(
      n
        ? `Values loaded (${table.columns.length} columns, ${n} nodes matched) — colour by them in Edit → Style.`
        : 'No node of the network is named in that file.',
      !n
    )
  } catch (err) {
    status(err instanceof Error ? err.message : 'Bad values file format.', true)
  } finally {
    finishLoader()
  }
}

async function onUploadEdgeAttributes(file: File): Promise<void> {
  if (!(await precheck(file, 'edgeAttributes'))) return
  startLoader()
  try {
    const rows = await api.uploadEdgeAttributes(file)
    applyEdgeAttributes(rows)
    // keep the Edge Actions priority checkbox in sync (v2 clicked it)
    const box = document.getElementById(
      'edgeFileColorPriority'
    ) as HTMLInputElement | null
    if (box) box.checked = true
    status('Edge attributes applied.')
  } catch (err) {
    status(
      err instanceof Error ? err.message : 'Bad edge attributes file format.',
      true
    )
  } finally {
    finishLoader()
  }
}

export function initFilePanel(): void {
  const pane = document.getElementById('panel-file')
  if (!pane) return
  pane.innerHTML = FILE_HTML

  // ---- Loaded networks
  const renderWorkspace = () => {
    const list = document.getElementById('workspaceList')
    const compare = document.getElementById('compareWith') as HTMLSelectElement
    if (!list || !compare) return
    const slots = listSlots()
    const active = activeSlot()
    list.innerHTML = slots.length
      ? slots
          .map(
            (
              s
            ) => `<div class="workspace-row${s.id === active?.id ? ' is-active' : ''}">
          <button type="button" class="workspace-switch" data-id="${s.id}" ${s.id === active?.id ? 'disabled' : ''} title="Switch to this network">${escapeHtml(s.name)}</button>
          <span class="workspace-meta">${s.layers} layer${s.layers === 1 ? '' : 's'} · ${s.nodes} nodes · ${s.edges} edges${s.id === active?.id ? ' · active' : ''}</span>
          <button type="button" class="workspace-remove" data-id="${s.id}" ${s.id === active?.id ? 'disabled' : ''} title="Remove from the list" aria-label="Remove ${escapeHtml(s.name)}">×</button>
        </div>`
          )
          .join('')
      : '<div class="form-text">Nothing loaded yet.</div>'
    list.querySelectorAll<HTMLButtonElement>('.workspace-switch').forEach((b) =>
      b.addEventListener('click', () => {
        if (switchTo(Number(b.dataset.id)))
          status(`Switched to ${b.textContent ?? 'the network'}.`)
      })
    )
    list
      .querySelectorAll<HTMLButtonElement>('.workspace-remove')
      .forEach((b) =>
        b.addEventListener('click', () => removeSlot(Number(b.dataset.id)))
      )
    const others = slots.filter((s) => s.id !== active?.id)
    compare.innerHTML = others
      .map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`)
      .join('')
    compare.disabled = others.length === 0
    ;(
      document.getElementById('compareNetworks') as HTMLButtonElement
    ).disabled = others.length === 0
  }
  bus.on('workspace:changed', renderWorkspace)
  bus.on('network:loaded', renderWorkspace)
  renderWorkspace()
  document.getElementById('compareNetworks')?.addEventListener('click', () => {
    const id = Number(
      (document.getElementById('compareWith') as HTMLSelectElement).value
    )
    const other = listSlots().find((s) => s.id === id)
    const rows = other ? compareWith(other) : null
    if (!other || !rows)
      return status('Load a second network to compare.', true)
    renderCompareTable(
      activeSlot()?.name ?? 'active',
      other.name,
      rows.map((r) => [
        r.measure,
        r.a,
        r.b,
        r.both,
        r.onlyA,
        r.onlyB,
        r.jaccard === null ? '—' : r.jaccard.toFixed(3),
      ]),
      compareSets(other) ?? []
    )
    status(
      `Comparison with ${other.name} is in Data Tables → Network Comparison.`
    )
  })

  const netInput = document.getElementById(
    'input_network_file'
  ) as HTMLInputElement
  netInput.addEventListener('change', () => {
    const file = netInput.files?.[0]
    if (!file) return
    void onUploadNetwork(file).then((loaded) => {
      if (!loaded) netInput.value = '' // the same file can be picked again
    })
  })

  const sessInput = document.getElementById(
    'load_network_file'
  ) as HTMLInputElement
  sessInput.addEventListener('change', () => {
    const file = sessInput.files?.[0]
    if (!file) return
    void onLoadSession(file).then((loaded) => {
      if (!loaded) sessInput.value = '' // the same file can be picked again
    })
  })

  for (const [id, handler] of [
    ['groups_file', onUploadGroups],
    ['values_file', onUploadValues],
  ] as const) {
    const input = document.getElementById(id) as HTMLInputElement
    input.addEventListener('change', () => {
      if (input.files?.[0]) void handler(input.files[0])
    })
  }

  const nodeAttrInput = document.getElementById(
    'node_attributes_file'
  ) as HTMLInputElement
  nodeAttrInput.addEventListener('change', () => {
    if (nodeAttrInput.files?.[0])
      void onUploadNodeAttributes(nodeAttrInput.files[0])
  })

  const edgeAttrInput = document.getElementById(
    'edge_attributes_file'
  ) as HTMLInputElement
  edgeAttrInput.addEventListener('change', () => {
    if (edgeAttrInput.files?.[0])
      void onUploadEdgeAttributes(edgeAttrInput.files[0])
  })

  document
    .getElementById('save_network_object')
    ?.addEventListener('click', () => {
      void exportSession().catch((err: unknown) =>
        status(err instanceof Error ? err.message : 'Save failed.', true)
      )
    })

  document.getElementById('exampleButton')?.addEventListener('click', () => {
    void onLoadExample()
  })
}
