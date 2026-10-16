// Colour palettes for the Style panel — PLAN-ROADMAP Phase 24.
//
// Categorical: the dataviz reference palette, validated with the skill's
// validator against the scene backgrounds (dark steps on black: all checks
// pass; light steps on white: pass, with three slots under 3:1 contrast, so
// nodes keep their labels/table). Hues are assigned in fixed order, never
// cycled: groups past the eighth fold into a neutral "other" grey.
// Sequential: one hue (blue), light->dark, clamped to the steps that still
// show against the background.

export const CATEGORICAL = {
  dark: [
    '#3987e5',
    '#d95926',
    '#199e70',
    '#c98500',
    '#d55181',
    '#008300',
    '#9085e9',
    '#e66767',
  ],
  light: [
    '#2a78d6',
    '#eb6834',
    '#1baf7a',
    '#eda100',
    '#e87ba4',
    '#008300',
    '#4a3aa7',
    '#e34948',
  ],
}
export const OTHER = '#8a8a86'

// Okabe & Ito (2008), the classic colour-blind-safe set (grey dropped: it
// reads as "no data"). Validator: one adjacent pair sits in the 6-8 CVD band
// for deuteranopes, so use it with a second cue (shape per group) — the
// colour-blind mode does exactly that.
export const OKABE_ITO = [
  '#0072B2',
  '#E69F00',
  '#009E73',
  '#CC79A7',
  '#56B4E9',
  '#D55E00',
  '#F0E442',
]

export type CategoricalPalette = 'distinct' | 'okabeIto'
export const CATEGORICAL_LABELS: Record<CategoricalPalette, string> = {
  distinct: 'Distinct (colour-blind checked)',
  okabeIto: 'Okabe–Ito (colour-blind safe)',
}
export type SequentialPalette = 'blue' | 'cividis'
export const SEQUENTIAL_LABELS: Record<SequentialPalette, string> = {
  blue: 'Blues',
  cividis: 'Cividis (colour-blind optimised)',
}
// cividis (Nuñez et al. 2018): perceptually uniform for normal and
// red-green colour-deficient vision; dark -> light
const CIVIDIS = [
  '#00204d',
  '#00336f',
  '#39486b',
  '#575c6d',
  '#707173',
  '#8a8779',
  '#a69d75',
  '#c4b56c',
  '#e4cf5b',
  '#ffea46',
]

// blue ramp, steps 100..700 (reference palette)
const BLUE = [
  '#cde2fb',
  '#b7d3f6',
  '#9ec5f4',
  '#86b6ef',
  '#6da7ec',
  '#5598e7',
  '#3987e5',
  '#2a78d6',
  '#256abf',
  '#1c5cab',
  '#184f95',
  '#104281',
  '#0d366b',
]

export type Surface = 'dark' | 'light'

export function surfaceOf(hex: string): Surface {
  const n = parseInt(hex.replace('#', ''), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128 ? 'dark' : 'light'
}

// Colour per group key, in first-seen order of `keys`.
export function categoricalColors(
  keys: string[],
  surface: Surface,
  palette: CategoricalPalette = 'distinct'
): Map<string, string> {
  const pal = palette === 'okabeIto' ? OKABE_ITO : CATEGORICAL[surface]
  const out = new Map<string, string>()
  for (const k of keys)
    if (!out.has(k)) out.set(k, out.size < pal.length ? pal[out.size] : OTHER)
  return out
}

// t in [0,1] -> blue step. On dark backgrounds high values are LIGHT (they
// stand out against black); on light ones high values are DARK. Steps that
// would vanish into the background are skipped (light: from 250; dark: to 600).
export function sequentialColor(
  t: number,
  surface: Surface,
  palette: SequentialPalette = 'blue'
): string {
  // cividis: high values toward the end that contrasts with the background
  const steps =
    palette === 'cividis'
      ? surface === 'light'
        ? CIVIDIS.slice(0, 8).reverse()
        : CIVIDIS.slice(2)
      : surface === 'light'
        ? BLUE.slice(3)
        : BLUE.slice(0, 11).reverse()
  const x = Math.min(1, Math.max(0, t)) * (steps.length - 1)
  return steps[Math.round(x)]
}

// ---------------------------------------------------------------- simulation
// Colour-vision-deficiency simulation matrices (Machado, Oliveira & Fernandes
// 2009, severity 1.0) for an SVG feColorMatrix (linear RGB).
export type CvdMode =
  'none' | 'protanopia' | 'deuteranopia' | 'tritanopia' | 'achromatopsia'
export const CVD_MATRICES: Record<Exclude<CvdMode, 'none'>, number[]> = {
  protanopia: [
    0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882,
    -0.048116, 1.051998,
  ],
  deuteranopia: [
    0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182,
    0.04294, 0.968881,
  ],
  tritanopia: [
    1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733,
    0.691367, 0.3039,
  ],
  achromatopsia: [
    0.2126, 0.7152, 0.0722, 0.2126, 0.7152, 0.0722, 0.2126, 0.7152, 0.0722,
  ],
}

// Apply a simulation filter to the 3D canvas and the label overlay.
export function simulateCvd(mode: CvdMode): void {
  // the 3D view, the 2D navigator and the label overlay
  const targets = [
    ...document.querySelectorAll<HTMLElement>('canvas'),
    document.getElementById('labelDiv'),
  ].filter((el): el is HTMLElement => el !== null)
  if (mode === 'none') {
    for (const el of targets) el.style.filter = ''
    return
  }
  if (!document.getElementById('cvd-filters')) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.id = 'cvd-filters'
    svg.setAttribute('width', '0')
    svg.setAttribute('height', '0')
    svg.style.position = 'absolute'
    svg.innerHTML = Object.entries(CVD_MATRICES)
      .map(([name, m]) => {
        const rows = [0, 3, 6]
          .map((r) => `${m[r]} ${m[r + 1]} ${m[r + 2]} 0 0`)
          .join(' ')
        return `<filter id="cvd-${name}"><feColorMatrix type="matrix" values="${rows} 0 0 0 1 0"/></filter>`
      })
      .join('')
    document.body.appendChild(svg)
  }
  for (const el of targets) el.style.filter = `url(#cvd-${mode})`
}
