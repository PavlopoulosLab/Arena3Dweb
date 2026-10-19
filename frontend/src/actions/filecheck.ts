// Client-side checks before a file is uploaded — PLAN-ROADMAP Phase 22.
// They catch the common mistakes (wrong file, CSV instead of TSV, missing
// columns, ragged rows, broken JSON) with a message that names the line, so
// users don't wait for an upload to learn the file was wrong. The backend
// still validates everything.

export type FileKind =
  | 'network'
  | 'session'
  | 'nodeAttributes'
  | 'edgeAttributes'
  | 'groups'
  | 'values'

export const MAX_FILE_BYTES = 20 * 1024 * 1024 // backend ARENA_MAX_UPLOAD_BYTES default

const EXTENSIONS: Record<FileKind, string[]> = {
  network: ['.tsv', '.txt', '.graphml', '.xml', '.gml', '.sif', '.cx2', '.cx'],
  session: ['.json'],
  nodeAttributes: ['.tsv', '.txt'],
  edgeAttributes: ['.tsv', '.txt'],
  groups: ['.tsv', '.txt'],
  values: ['.tsv', '.txt'],
}

const REQUIRED: Partial<Record<FileKind, string[][]>> = {
  // any one of these header sets
  network: [
    ['SourceNode', 'SourceLayer', 'TargetNode', 'TargetLayer'],
    ['SourceNode', 'TargetNode'],
  ],
  nodeAttributes: [['Node', 'Layer']],
  edgeAttributes: [
    ['SourceNode', 'SourceLayer', 'TargetNode', 'TargetLayer', 'Color'],
  ],
}

const ext = (name: string) => {
  const i = name.lastIndexOf('.')
  return i < 0 ? '' : name.slice(i).toLowerCase()
}

// Size/extension only — cheap, before reading the file.
export function checkFileMeta(
  name: string,
  size: number,
  kind: FileKind
): string | null {
  if (size === 0) return `${name} is empty.`
  if (size > MAX_FILE_BYTES)
    return `${name} is ${(size / 1024 / 1024).toFixed(1)} MB; the limit is ${MAX_FILE_BYTES / 1024 / 1024} MB.`
  const allowed = EXTENSIONS[kind]
  if (!allowed.includes(ext(name)))
    return `${name}: expected a ${allowed.join(', ')} file.`
  return null
}

// Content checks on the text. Returns a message naming the line at fault.
export function checkFileText(
  name: string,
  text: string,
  kind: FileKind
): string | null {
  const e = ext(name)
  if (kind === 'session' || e === '.cx2' || e === '.cx') {
    try {
      const data: unknown = JSON.parse(text)
      if (kind === 'session') {
        const keys = ['layers', 'nodes', 'edges']
        const missing = keys.filter(
          (k) => !Array.isArray((data as Record<string, unknown>)?.[k])
        )
        if (missing.length)
          return `${name}: a session needs ${missing.join(', ')} lists.`
      }
    } catch (err) {
      return `${name} is not valid JSON (${(err as Error).message}).`
    }
    return null
  }
  if (e === '.graphml' || e === '.xml')
    return text.trimStart().startsWith('<')
      ? null
      : `${name} does not look like XML/GraphML.`
  if (e === '.gml')
    return /\bgraph\s*\[/.test(text)
      ? null
      : `${name}: no "graph [ ... ]" block found.`
  if (e === '.sif') return null
  // group files: one group per line (name, TAB, members) or Node/Group rows —
  // a TAB on every non-empty line is all that can be checked here
  if (kind === 'groups') {
    const bad = text
      .split(/\r?\n/)
      .findIndex(
        (l) => l.trim() !== '' && !l.startsWith('#') && !l.includes('\t')
      )
    return bad < 0
      ? null
      : `${name}: line ${bad + 1} has no TAB — expected a group name, a TAB, then its members.`
  }

  // tab-separated tables
  const lines = text.split(/\r?\n/)
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop()
  if (lines.length < 2) return `${name} has a header but no rows.`
  const header = lines[0].split('\t').map((h) => h.trim())
  if (header.length === 1) {
    if (lines[0].includes(',') || lines[0].includes(';'))
      return `${name} looks comma/semicolon-separated — Arena3D needs TAB-separated columns.`
    return `${name}: line 1 has a single column — columns must be separated by TABs.`
  }
  const sets = REQUIRED[kind]
  if (sets && !sets.some((set) => set.every((c) => header.includes(c)))) {
    const best = sets[0]
    const missing = best.filter((c) => !header.includes(c))
    const near = missing
      .map((m) => header.find((h) => h.toLowerCase() === m.toLowerCase()))
      .filter(Boolean)
    return (
      `${name}: missing column${missing.length > 1 ? 's' : ''} ${missing.join(', ')} in line 1.` +
      (near.length
        ? ` Column names are case-sensitive (found ${near.join(', ')}).`
        : '')
    )
  }
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '') continue
    const cells = lines[i].split('\t').length
    if (cells < header.length && cells < (sets?.[sets.length - 1].length ?? 1))
      return `${name}: line ${i + 1} has ${cells} column${cells === 1 ? '' : 's'}, the header has ${header.length}.`
  }
  const w = header.indexOf('Weight')
  if (w >= 0)
    for (let i = 1; i < lines.length; i++) {
      const cell = lines[i].split('\t')[w]?.trim()
      if (cell && !Number.isFinite(Number(cell)))
        return `${name}: line ${i + 1} has a non-numeric Weight "${cell}".`
    }
  return null
}
