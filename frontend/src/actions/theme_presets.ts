// The scene themes of the top bar's picker (actions/themes.ts): background,
// floor, edge, label and container colours, and the theme's palettes — a
// distinct colour per layer's nodes and per channel, every one readable on the
// background (WCAG 3:1) and far enough from the others (CIE76 ΔE 15;
// actions/palette.test.ts checks both). Grouped in the picker as dark, light
// and colour-blind safe. Ids are stable: sessions and specs name them.

export interface Theme {
  label: string // shown in the theme picker
  group: 'dark' | 'light' | 'cb'
  background: string
  floor: string
  edge: string // edges without a channel colour, intra- and inter-layer
  text: string // node and layer labels
  container: string // cube / sphere / fog-cloud default, contrasting with the background
  nodes: string[] // layer i's nodes take nodes[i] (more layers: actions/palette.ts)
  channels: string[] // one per channel, ten at least (the most a network has)
}

export const THEME_GROUPS: [Theme['group'], string][] = [
  ['dark', 'Dark'],
  ['light', 'Light'],
  ['cb', 'Colour-blind safe'],
]

// prettier-ignore
export const THEMES: Record<string, Theme> = {
  // the default: black, as Arena3D always was
  dark: {
    label: 'Dark', group: 'dark',
    background: '#000000', floor: '#777777', edge: '#ffffff', text: '#ffffff', container: '#5b8def',
    nodes: ['#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00', '#ffff33', '#a65628', '#f781bf', '#14a9ad', '#4ca2f9', '#a4e43f', '#d298e2'],
    channels: ['#8dd3c7', '#ffffb3', '#bebada', '#fb8072', '#80b1d3', '#fdb462', '#b3de69', '#fccde5', '#d9d9d9', '#bc80bd'],
  },
  midnight: {
    label: 'Midnight', group: 'dark',
    background: '#0b1426', floor: '#2b4a7a', edge: '#9fb7d9', text: '#e8eefa', container: '#7fb3ff',
    nodes: ['#ff6b6b', '#4dabf7', '#69db7c', '#ffd43b', '#da77f2', '#ffa94d', '#3bc9db', '#f783ac', '#a9e34b', '#9775fa'],
    channels: ['#4dabf7', '#ff8787', '#69db7c', '#ffd43b', '#da77f2', '#ffa94d', '#3bc9db', '#f783ac', '#a9e34b', '#e9ecef'],
  },
  blueprint: {
    label: 'Blueprint', group: 'dark',
    background: '#0d2b52', floor: '#3d6fae', edge: '#d6e6ff', text: '#ffffff', container: '#ffd166',
    nodes: ['#ffd166', '#06d6a0', '#ef476f', '#9be7ff', '#f78c6b', '#c3f584', '#e0aaff', '#ffffff'],
    channels: ['#ffd166', '#06d6a0', '#ff7096', '#9be7ff', '#f78c6b', '#c3f584', '#e0aaff', '#ffffff', '#ffb3c6', '#f9a03f'],
  },
  solarized: {
    label: 'Solarized', group: 'dark',
    background: '#002b36', floor: '#586e75', edge: '#93a1a1', text: '#eee8d5', container: '#b58900',
    nodes: ['#b58900', '#cb4b16', '#dc322f', '#d33682', '#6c71c4', '#268bd2', '#2aa198', '#859900'],
    channels: ['#b58900', '#cb4b16', '#dc322f', '#d33682', '#6c71c4', '#268bd2', '#2aa198', '#859900', '#eee8d5', '#f5a97f'],
  },
  forest: {
    label: 'Forest', group: 'dark',
    background: '#0f1f17', floor: '#3e6b4f', edge: '#c8e0b4', text: '#f1f7ea', container: '#9ccc65',
    nodes: ['#9ccc65', '#ffb74d', '#4fc3f7', '#e57373', '#ba68c8', '#fff176', '#4db6ac', '#f06292', '#a1887f', '#e0e0e0'],
    channels: ['#9ccc65', '#ffb74d', '#4fc3f7', '#e57373', '#ba68c8', '#fff176', '#4db6ac', '#f06292', '#a1887f', '#e0e0e0'],
  },
  contrast: {
    label: 'High Contrast', group: 'dark',
    background: '#000000', floor: '#3a3a3a', edge: '#ffd400', text: '#ffffff', container: '#ffd400',
    nodes: ['#ff3b3b', '#00e676', '#2f9bff', '#ffd400', '#ff40ff', '#00e5ff', '#ff9100', '#ffffff'],
    channels: ['#ff3b3b', '#00e676', '#2f9bff', '#ffd400', '#ff40ff', '#00e5ff', '#ff9100', '#ffffff', '#b388ff', '#c6ff00'],
  },
  // after Cytoscape's dark Universe style
  universe: {
    label: 'Universe', group: 'dark',
    background: '#0a0a23', floor: '#2c2c54', edge: '#8395a7', text: '#f5f6fa', container: '#9c88ff',
    nodes: ['#9c88ff', '#00d2d3', '#ff9ff3', '#feca57', '#ff6b6b', '#1dd1a1', '#ff9f43', '#c8d6e5'],
    channels: ['#9c88ff', '#00d2d3', '#ff9ff3', '#feca57', '#ff6b6b', '#1dd1a1', '#ff9f43', '#c8d6e5', '#54a0ff', '#f368e0'],
  },
  // after Cytoscape's Marquee style: warm lights on a dark stage
  marquee: {
    label: 'Marquee', group: 'dark',
    background: '#1b1410', floor: '#5a4632', edge: '#e8c07d', text: '#fff4e0', container: '#ffb000',
    nodes: ['#ffb000', '#ff5a5f', '#06d6a0', '#9381ff', '#ff8c42', '#f7f7ff', '#4cc9f0', '#c9f299'],
    channels: ['#ffb000', '#ff5a5f', '#06d6a0', '#9381ff', '#ff8c42', '#f7f7ff', '#4cc9f0', '#c9f299', '#ff99c8', '#fff07c'],
  },
  // after Cytoscape's Ripple style
  ripple: {
    label: 'Ripple', group: 'dark',
    background: '#04202c', floor: '#2e6171', edge: '#8fd3e8', text: '#e6f7fb', container: '#56cfe1',
    nodes: ['#56cfe1', '#ffbe0b', '#ff006e', '#8ac926', '#ff9e6d', '#c77dff', '#ffd6a5', '#f15bb5'],
    channels: ['#56cfe1', '#ffbe0b', '#ff4d94', '#8ac926', '#ff9e6d', '#c77dff', '#ffd6a5', '#80ffdb', '#e9ff70', '#ffffff'],
  },
  light: {
    label: 'Light', group: 'light',
    background: '#ffffff', floor: '#8aa185', edge: '#5c5c5c', text: '#000000', container: '#2f6fcf',
    nodes: ['#c92a2a', '#1864ab', '#2b8a3e', '#d9480f', '#862e9c', '#0b7285', '#c2255c', '#5c940d', '#364fc7', '#7a4a1f'],
    channels: ['#c92a2a', '#1864ab', '#2b8a3e', '#d9480f', '#862e9c', '#0b7285', '#c2255c', '#5c940d', '#364fc7', '#7a4a1f'],
  },
  gray: {
    label: 'Gray', group: 'light',
    background: '#999999', floor: '#1d4991', edge: '#6e2a5a', text: '#000000', container: '#ffd166',
    nodes: ['#7a0000', '#00306e', '#004d00', '#4b0082', '#5c2a00', '#003d3d', '#6b0045', '#2b2b2b'],
    channels: ['#7a0000', '#00306e', '#004d00', '#4b0082', '#5c2a00', '#003d3d', '#6b0045', '#000000', '#4c4c00', '#00004d'],
  },
  paper: {
    label: 'Paper', group: 'light',
    background: '#f6f1e7', floor: '#c9b99a', edge: '#5a4a3a', text: '#2b2118', container: '#8a4b1f',
    nodes: ['#9b2226', '#005f73', '#3a5a40', '#bb3e03', '#5f0f40', '#0a9396', '#7f5539', '#3d405b'],
    channels: ['#9b2226', '#005f73', '#3a5a40', '#bb3e03', '#5f0f40', '#0a7f82', '#7f5539', '#3d405b', '#b5179e', '#65914a'],
  },
  pastel: {
    label: 'Pastel', group: 'light',
    background: '#fbf7ff', floor: '#c8b6e2', edge: '#6c5b7b', text: '#2d2340', container: '#6c4fb3',
    nodes: ['#7b5ea7', '#2a9d8f', '#db694d', '#457b9d', '#c44569', '#6a994e', '#b07d2b', '#8e5572'],
    channels: ['#7b5ea7', '#2a9d8f', '#db694d', '#457b9d', '#c44569', '#6a994e', '#b07d2b', '#8e5572', '#264653', '#9c6644'],
  },
  // Cytoscape's default style: white, blue-grey nodes, grey edges
  cytoscape: {
    label: 'Cytoscape', group: 'light',
    background: '#ffffff', floor: '#c8d6e5', edge: '#848484', text: '#000000', container: '#4d6a8a',
    nodes: ['#3c6e9f', '#b5523b', '#5f8a3a', '#7d5ba6', '#2f8f8f', '#b07c1f', '#a8466e', '#6b6b47'],
    channels: ['#3c6e9f', '#b5523b', '#5f8a3a', '#7d5ba6', '#2f8f8f', '#b07c1f', '#a8466e', '#6b6b47', '#2b2d42', '#8f5a3c'],
  },
  // after Cytoscape's Sample styles
  sample: {
    label: 'Sample', group: 'light',
    background: '#eceff4', floor: '#d8dee9', edge: '#4c566a', text: '#2e3440', container: '#5e81ac',
    nodes: ['#bf616a', '#5e81ac', '#4f7a3a', '#9a6b94', '#c06a2b', '#2f7f7a', '#8a6d1e', '#4c566a'],
    channels: ['#bf616a', '#5e81ac', '#4f7a3a', '#9a6b94', '#c06a2b', '#2f7f7a', '#8a6d1e', '#4c566a', '#b0306a', '#5d3a6b'],
  },
  // after Cytoscape's Directed style: strong edges for arrows
  directed: {
    label: 'Directed', group: 'light',
    background: '#fafafa', floor: '#bdbdbd', edge: '#455a64', text: '#212121', container: '#1565c0',
    nodes: ['#1565c0', '#c62828', '#2e7d32', '#6a1b9a', '#e36700', '#00838f', '#ad1457', '#4e342e'],
    channels: ['#1565c0', '#c62828', '#2e7d32', '#6a1b9a', '#e36700', '#00838f', '#ad1457', '#4e342e', '#827717', '#283593'],
  },
  // after Cytoscape's Nested Network style
  nested: {
    label: 'Nested', group: 'light',
    background: '#fffdf7', floor: '#e9d8a6', edge: '#6b705c', text: '#283618', container: '#bc6c25',
    nodes: ['#bc6c25', '#2a6f97', '#606c38', '#9d0208', '#7209b7', '#386641', '#b5838d', '#014f86'],
    channels: ['#bc6c25', '#2a6f97', '#606c38', '#9d0208', '#7209b7', '#2d6a4f', '#9c6644', '#014f86', '#c9184a', '#5a189a'],
  },
  // after Cytoscape's Minimal style: quiet greys
  minimal: {
    label: 'Minimal', group: 'light',
    background: '#ffffff', floor: '#e0e0e0', edge: '#8a8a8a', text: '#424242', container: '#757575',
    nodes: ['#546e7a', '#8d6e63', '#5c6bc0', '#249e92', '#ab47bc', '#70a13b', '#ef5350', '#cc861e'],
    channels: ['#546e7a', '#8d6e63', '#5c6bc0', '#249e92', '#ab47bc', '#70a13b', '#ef5350', '#cc861e', '#239bd1', '#ec407a'],
  },
  // after Cytoscape's Solid style: saturated, solid colours
  solid: {
    label: 'Solid', group: 'light',
    background: '#f2f2f2', floor: '#9e9e9e', edge: '#212121', text: '#000000', container: '#000000',
    nodes: ['#d32f2f', '#1976d2', '#388e3c', '#7b1fa2', '#d06900', '#0097a7', '#c2185b', '#5d4037'],
    channels: ['#d32f2f', '#1976d2', '#388e3c', '#7b1fa2', '#d06900', '#0097a7', '#c2185b', '#5d4037', '#303f9f', '#827717'],
  },
  // Okabe & Ito (2008), safe for every colour vision
  okabe: {
    label: 'Okabe–Ito', group: 'cb',
    background: '#1c1c1c', floor: '#555555', edge: '#bbbbbb', text: '#ffffff', container: '#56b4e9',
    nodes: ['#e69f00', '#56b4e9', '#009e73', '#f0e442', '#0072b2', '#d55e00', '#cc79a7', '#ffffff'],
    channels: ['#e69f00', '#56b4e9', '#009e73', '#f0e442', '#0072b2', '#d55e00', '#cc79a7', '#ffffff', '#999999', '#f7c6dd'],
  },
  // Paul Tol's bright scheme
  tolBright: {
    label: 'Tol bright', group: 'cb',
    background: '#141414', floor: '#4a4a4a', edge: '#bbbbbb', text: '#ffffff', container: '#66ccee',
    nodes: ['#4477aa', '#ee6677', '#228833', '#ccbb44', '#66ccee', '#aa3377', '#bbbbbb', '#ffffff'],
    channels: ['#4477aa', '#ee6677', '#228833', '#ccbb44', '#66ccee', '#aa3377', '#bbbbbb', '#ffffff', '#ee8866', '#ffaabb'],
  },
  // Paul Tol's muted scheme, darkened to read on white
  tolMuted: {
    label: 'Tol muted', group: 'cb',
    background: '#ffffff', floor: '#cccccc', edge: '#555555', text: '#000000', container: '#332288',
    nodes: ['#cc6677', '#332288', '#9b8f53', '#117733', '#6699b2', '#882255', '#41a291', '#999933'],
    channels: ['#cc6677', '#332288', '#9b8f53', '#117733', '#6699b2', '#882255', '#41a291', '#999933', '#aa4499', '#909090'],
  },
  // Paul Tol's vibrant scheme
  tolVibrant: {
    label: 'Tol vibrant', group: 'cb',
    background: '#121212', floor: '#4a4a4a', edge: '#bbbbbb', text: '#ffffff', container: '#33bbee',
    nodes: ['#ee7733', '#0077bb', '#33bbee', '#ee3377', '#cc3311', '#009988', '#bbbbbb', '#ffffff'],
    channels: ['#ee7733', '#0077bb', '#33bbee', '#ee3377', '#cc3311', '#009988', '#bbbbbb', '#ffffff', '#ffcc66', '#99ddff'],
  },
  // ColorBrewer Set2 (Harrower & Brewer)
  set2: {
    label: 'Set2', group: 'cb',
    background: '#1e1e1e', floor: '#555555', edge: '#bdbdbd', text: '#ffffff', container: '#8da0cb',
    nodes: ['#66c2a5', '#fc8d62', '#8da0cb', '#e78ac3', '#a6d854', '#ffd92f', '#e5c494', '#b3b3b3'],
    channels: ['#66c2a5', '#fc8d62', '#8da0cb', '#e78ac3', '#a6d854', '#ffd92f', '#e5c494', '#b3b3b3', '#ffffff', '#ccebc5'],
  },
  // ColorBrewer Dark2
  dark2: {
    label: 'Dark2', group: 'cb',
    background: '#ffffff', floor: '#d0d0d0', edge: '#555555', text: '#000000', container: '#7570b3',
    nodes: ['#1b9e77', '#d95f02', '#7570b3', '#e7298a', '#619e1c', '#b88902', '#6b3e26', '#666666'],
    channels: ['#1b9e77', '#d95f02', '#7570b3', '#e7298a', '#619e1c', '#b88902', '#6b3e26', '#666666', '#1f78b4', '#6a3d9a'],
  },
  // ColorBrewer Paired: light and dark of each hue
  paired: {
    label: 'Paired', group: 'cb',
    background: '#15171a', floor: '#4a4f57', edge: '#c0c4ca', text: '#ffffff', container: '#a6cee3',
    nodes: ['#a6cee3', '#1f78b4', '#b2df8a', '#33a02c', '#fb9a99', '#e31a1c', '#fdbf6f', '#ff7f00', '#cab2d6', '#805aa9', '#ffff99', '#b15928'],
    channels: ['#a6cee3', '#1f78b4', '#b2df8a', '#33a02c', '#fb9a99', '#e31a1c', '#fdbf6f', '#ff7f00', '#cab2d6', '#805aa9'],
  },
  // viridis (van der Walt & Smith), perceptually uniform
  viridis: {
    label: 'Viridis', group: 'cb',
    background: '#14101e', floor: '#3b3354', edge: '#b8b3c9', text: '#ffffff', container: '#21918c',
    nodes: ['#4f6397', '#21918c', '#5ec962', '#fde725', '#2c728e', '#90d743', '#6c5795', '#27ad81'],
    channels: ['#4f6397', '#2c728e', '#21918c', '#27ad81', '#5ec962', '#90d743', '#c8e020', '#fde725', '#6c5795', '#ffffff'],
  },
}
