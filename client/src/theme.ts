// Theme tokens: colonist-style bright sea board palette (TS maps for SVG
// fills) plus the legacy THEME object.

/** Flat tile colour per terrain. */
export const TERRAIN_FILL: Record<string, string> = {
  forest: '#2f8a3c',
  pasture: '#93cf4c',
  fields: '#f2bd2c',
  hills: '#d56a3c',
  mountains: '#8e9aa6',
  desert: '#ecd59c',
};

/** Tile rim / shadow side of the inner bevel. */
export const TERRAIN_BORDER: Record<string, string> = {
  forest: '#1d5c27',
  pasture: '#679a2c',
  fields: '#c48b10',
  hills: '#9c4322',
  mountains: '#5f6b78',
  desert: '#c2a563',
};

/** Lit side of the inner bevel. */
export const TERRAIN_LIGHT: Record<string, string> = {
  forest: '#4aa653',
  pasture: '#b0e36d',
  fields: '#fbd764',
  hills: '#ea8b5f',
  mountains: '#b3bec9',
  desert: '#f8e7bd',
};

/** Terrain that produces each resource (harbour badge colours). */
export const RESOURCE_TERRAIN: Record<string, string> = {
  wood: 'forest',
  brick: 'hills',
  sheep: 'pasture',
  wheat: 'fields',
  ore: 'mountains',
};

/**
 * Player piece colours. `main` is the body, `dark` the shaded side, `light`
 * the highlight. Every piece also gets the shared PIECE_OUTLINE stroke so
 * white stays readable on light tiles.
 */
export const PIECE_COLORS: Record<string, { main: string; dark: string; light: string }> = {
  red: { main: '#e2372f', dark: '#9a1c17', light: '#ff6a5f' },
  blue: { main: '#2b6fe0', dark: '#173f8f', light: '#679cff' },
  orange: { main: '#f28a17', dark: '#a0520a', light: '#ffb356' },
  white: { main: '#f7f4ec', dark: '#6f6b64', light: '#ffffff' },
  green: { main: '#2fa84a', dark: '#1a6a2c', light: '#6bd47f' },
  brown: { main: '#8c5a2b', dark: '#553312', light: '#b8834f' },
  purple: { main: '#8c45cc', dark: '#4f2178', light: '#b67ce9' },
  pink: { main: '#ee5aa6', dark: '#a02467', light: '#ff92c8' },
};

/** Dark outline shared by every player piece. */
export const PIECE_OUTLINE = '#1c1a18';

/** Board-level colours: sea, beach, number tokens, highlights, harbours. */
export const BOARD_COLORS = {
  ocean: '#49b4ea',
  oceanShallow: '#7fd0f4',
  oceanFoam: '#d8f2fd',
  wave: '#ffffff',
  sand: '#f3dca0',
  sandShade: '#dcbd76',
  tokenCream: '#fbf1d5',
  tokenEdge: '#cdb98a',
  tokenText: '#2a2622',
  tokenRed: '#d3302a',
  legal: '#ffffff',
  legalShade: 'rgba(28,26,24,0.5)',
  pulse: '#fff3a8',
  robber: '#4a5058',
  robberDark: '#1f2328',
  robberLight: '#79808a',
  wood: '#8b5a2e',
  woodDark: '#4e3016',
  woodLight: '#c38a52',
  sail: '#fbf6ea',
} as const;

export const THEME = {
  seaDeep: '#2f9ad3',
  sea: BOARD_COLORS.ocean,
  panel: '#ffffff',
  panelWell: 'rgba(0,0,0,.06)',
  text: '#1f2430',
  cta: '#f06800',
  ctaHover: '#d05800',
  secondary: '#1fab1c',
  danger: '#ef3f2a',
  accent: '#1e90ff',
  activeTab: '#1062b0',
  radius: '8px',
} as const;
