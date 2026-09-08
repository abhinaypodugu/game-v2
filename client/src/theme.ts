// Theme tokens (colonist-derived dark sea theme) as CSS custom properties
// and a TS map for SVG fills.

export const TERRAIN_FILL: Record<string, string> = {
  forest: '#3b7d3f',
  pasture: '#9bd256',
  fields: '#e9d700',
  hills: '#b06239',
  mountains: '#8d8d8d',
  desert: '#d9c98f',
};

export const TERRAIN_BORDER: Record<string, string> = {
  forest: '#2c5e2f',
  pasture: '#78a53f',
  fields: '#bfae00',
  hills: '#8a4a2a',
  mountains: '#6b6b6b',
  desert: '#b0a271',
};

export const PIECE_COLORS: Record<string, { main: string; dark: string }> = {
  red: { main: '#FF0000', dark: '#B30000' },
  blue: { main: '#00AAFF', dark: '#4D4DFF' },
  orange: { main: '#FF963B', dark: '#F27202' },
  white: { main: '#FFFFFF', dark: '#CCCCCC' },
  green: { main: '#00FF1A', dark: '#4DA45F' },
  brown: { main: '#8B5A2B', dark: '#5C3A1A' },
};

export const THEME = {
  seaDeep: '#04182a',
  sea: '#0a2e52',
  panel: '#0a4986',
  panelWell: 'rgba(0,0,0,.2)',
  text: '#f6f8fa',
  cta: '#f06800',
  ctaHover: '#d05800',
  secondary: '#1fab1c',
  danger: '#ef3f2a',
  accent: '#1e90ff',
  activeTab: '#1062b0',
  radius: '8px',
} as const;
