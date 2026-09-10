// 3D procedural geometries, materials, biome props, and token textures for Three.js Catan world.
// Inspired by iconic 3D Catan STL designs (Dakanzla / 3D Collector Edition):
// - Central recessed token wells on all tiles so tokens sit flush and clean.
// - Fields: Dutch windmill with spinning sails + wheat sheaves.
// - Mountains: Jagged peaks + timber-framed mine entrance and ore track.
// - Forest: Ring of pine trees surrounding the tile + stacked woodpile.
// - Hills: Stepped clay quarry + brick kiln with chimney and brick stacks.
// - Pasture: Grassy knolls with post-and-rail wooden fence + cute low-poly sheep.
// - Desert: Desert oasis with blue pool, palm trees, and saguaro cacti.

import * as THREE from 'three';
import type { Harbor, Terrain } from '@catan/shared';

export const SCALE = 0.048; // Scale factor from 2D board coordinates to 3D units
export const HEX_RADIUS = 4.15; // Calibrated so vertex circle nodes are fully round & unclipped
export const HEX_BASE_RADIUS = 4.18;
export const STREET_Y = 0.05; // Street base level where connector pathways, roads, and settlements sit
export const HEX_ELEVATION = 0.72; // Reduced by 60% (keeping 40% of original height: ~0.72 above road path)
export const TOP_Y = STREET_Y + HEX_ELEVATION; // 0.77 - Top deck height where biomes, tokens, and robber sit
export const HEX_HEIGHT = TOP_Y; // Elevated top deck height
export const WELL_RADIUS = 1.65; // Sunken circular well for number tokens
// ---------------------------------------------------------------------------
// Materials & Palettes
// ---------------------------------------------------------------------------

export const TERRAIN_COLORS: Record<Terrain, { top: string; side: string; rough: number }> = {
  fields: { top: '#f59e0b', side: '#b45309', rough: 0.8 }, // Rich golden harvest
  forest: { top: '#166534', side: '#14532d', rough: 0.85 }, // Deep evergreen pine
  pasture: { top: '#22c55e', side: '#15803d', rough: 0.75 }, // Vibrant meadow green
  mountains: { top: '#64748b', side: '#334155', rough: 0.9 }, // Rocky mountain slate
  hills: { top: '#c2410c', side: '#9a3412', rough: 0.8 }, // Terracotta brick clay
  desert: { top: '#fde047', side: '#ca8a04', rough: 0.95 }, // Sunlit sand dunes
};

export const PLAYER_3D_COLORS: Record<string, { main: number; dark: number; light: number }> = {
  red: { main: 0xdc2626, dark: 0x991b1b, light: 0xef4444 },
  blue: { main: 0x2563eb, dark: 0x1d4ed8, light: 0x3b82f6 },
  orange: { main: 0xea580c, dark: 0xc2410c, light: 0xf97316 },
  white: { main: 0xf8fafc, dark: 0xcbd5e1, light: 0xffffff }, // Brilliant pure white (high contrast against board!)
  green: { main: 0x16a34a, dark: 0x15803d, light: 0x22c55e },
  brown: { main: 0x78350f, dark: 0x451a03, light: 0x9a3412 },
};

// ---------------------------------------------------------------------------
// Dynamic Canvas Texture for Number Tokens
// ---------------------------------------------------------------------------

const tokenTextureCache = new Map<number, THREE.CanvasTexture>();

export function getNumberTokenTexture(token: number, pips: number): THREE.CanvasTexture {
  const cached = tokenTextureCache.get(token);
  if (cached) return cached;

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  // Background circle (parchment ivory)
  ctx.fillStyle = '#fefdfa';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 14, 0, Math.PI * 2);
  ctx.fill();

  // High-probability numbers: 6 and 8 in bold dark red; 10 and all other numbers in solid pure black!
  const isHot = token === 6 || token === 8;
  const darkRed = '#b91c1c'; // Rich dark red for 6 and 8!
  ctx.strokeStyle = isHot ? darkRed : '#000000';
  ctx.lineWidth = 26;
  ctx.stroke();

  // Inner subtle decorative circle
  ctx.strokeStyle = isHot ? 'rgba(185,28,28,0.35)' : 'rgba(0,0,0,0.20)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 40, 0, Math.PI * 2);
  ctx.stroke();

  // Number text: bold dark red for 6 and 8, bold pure black for 10 and all others!
  ctx.font = 'bold 210px Rubik, sans-serif';
  ctx.fillStyle = isHot ? darkRed : '#000000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(token), size / 2, size / 2 - 32);

  // Dot pips: dark red for 6 and 8; solid pure black for all others!
  const dotCount = pips;
  const dotSpacing = 36;
  const startX = size / 2 - ((dotCount - 1) * dotSpacing) / 2;
  const dotY = size / 2 + 120;
  ctx.fillStyle = isHot ? darkRed : '#000000';

  for (let i = 0; i < dotCount; i++) {
    ctx.beginPath();
    ctx.arc(startX + i * dotSpacing, dotY, 12, 0, Math.PI * 2);
    ctx.fill();
    // Inner dot highlight
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(startX + i * dotSpacing - 3, dotY - 3, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = isHot ? darkRed : '#000000';
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 16;
  tokenTextureCache.set(token, texture);
  return texture;
}

// ---------------------------------------------------------------------------
// Procedural Wood Pathway & River Flow Textures
// ---------------------------------------------------------------------------

let woodPathwayTex: THREE.CanvasTexture | null = null;
export function getWoodPathwayTexture(): THREE.CanvasTexture {
  if (woodPathwayTex) return woodPathwayTex;

  const w = 512;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  // 50% less woody: soft, refined warm neutral birch/sandstone base
  ctx.fillStyle = '#d2c4b2';
  ctx.fillRect(0, 0, w, h);

  // Subtle, gentle low-contrast grain lines (50% reduced intensity)
  const grainColors = ['#c4b4a0', '#bba996', '#dcd0c0', '#ab9884', '#cfc2b0'];
  for (let i = 0; i < 36; i++) {
    const y = Math.random() * h;
    const thickness = 1 + Math.random() * 2.0;
    ctx.fillStyle = grainColors[i % grainColors.length]!;
    ctx.globalAlpha = 0.08 + Math.random() * 0.16;
    ctx.fillRect(0, y, w, thickness);
  }
  ctx.globalAlpha = 1.0;

  // Transverse boardwalk planks with soft muted gap seams
  const plankWidth = 64;
  for (let x = 0; x < w; x += plankWidth) {
    // Soft plank shadow seam
    ctx.fillStyle = '#7c6854';
    ctx.fillRect(x, 0, 2.5, h);
    // Subtle plank edge highlight
    ctx.fillStyle = '#eae2d6';
    ctx.fillRect(x + 2.5, 0, 1.2, h);

    // Soft muted nail/peg fasteners on the plank ends
    ctx.fillStyle = '#604e3c';
    ctx.beginPath();
    ctx.arc(x + 12, 14, 2.2, 0, Math.PI * 2);
    ctx.arc(x + 12, h - 14, 2.2, 0, Math.PI * 2);
    ctx.arc(x + plankWidth - 12, 14, 2.2, 0, Math.PI * 2);
    ctx.arc(x + plankWidth - 12, h - 14, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 3);
  tex.anisotropy = 8;
  woodPathwayTex = tex;
  return tex;
}

let woodPlazaTex: THREE.CanvasTexture | null = null;
export function getWoodPlazaTexture(): THREE.CanvasTexture {
  if (woodPlazaTex) return woodPlazaTex;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  const center = size / 2;

  // 50% less woody: soft, refined warm neutral birch/sandstone disc
  ctx.fillStyle = '#d2c4b2';
  ctx.beginPath();
  ctx.arc(center, center, center, 0, Math.PI * 2);
  ctx.fill();

  // Subtle concentric tree rings / circular decking (soft contrast)
  const ringColors = ['#c4b4a0', '#bba996', '#ab9884', '#cfc2b0'];
  for (let r = 8; r < center - 6; r += 7) {
    ctx.strokeStyle = ringColors[Math.floor(r / 7) % ringColors.length]!;
    ctx.lineWidth = 1.8 + (r % 2);
    ctx.globalAlpha = 0.15 + (r % 3) * 0.08;
    ctx.beginPath();
    ctx.arc(center, center, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1.0;

  // 6 radial plank joints (soft muted tone)
  for (let a = 0; a < 6; a++) {
    const angle = (a * Math.PI) / 3;
    ctx.strokeStyle = '#7c6854';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(center + Math.cos(angle) * 12, center + Math.sin(angle) * 12);
    ctx.lineTo(center + Math.cos(angle) * (center - 6), center + Math.sin(angle) * (center - 6));
    ctx.stroke();
  }

  // Outer soft rim
  ctx.strokeStyle = '#5c4836';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(center, center, center - 4, 0, Math.PI * 2);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  woodPlazaTex = tex;
  return tex;
}

let riverFlowTex: THREE.CanvasTexture | null = null;
export function getRiverFlowTexture(): THREE.CanvasTexture {
  if (riverFlowTex) return riverFlowTex;

  const w = 512;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  // Vibrant clear river water base
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, '#0284c7'); // Rich azure
  gradient.addColorStop(0.5, '#0ea5e9'); // Turquoise blue
  gradient.addColorStop(1, '#0369a1'); // Deep stream
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  // Flowing water current streams & foam streaks
  const streamColors = ['rgba(186, 230, 253, 0.45)', 'rgba(125, 211, 252, 0.55)', 'rgba(240, 249, 255, 0.70)', 'rgba(56, 189, 248, 0.35)'];
  for (let i = 0; i < 64; i++) {
    const y = Math.random() * h;
    const x = Math.random() * w;
    const len = 40 + Math.random() * 120;
    const thickness = 1.2 + Math.random() * 3.2;

    ctx.strokeStyle = streamColors[i % streamColors.length]!;
    ctx.lineWidth = thickness;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + len * 0.3, y + Math.sin(x * 0.05) * 6, x + len * 0.7, y - Math.sin(x * 0.05) * 6, x + len, y);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 1);
  tex.anisotropy = 8;
  riverFlowTex = tex;
  return tex;
}

// ---------------------------------------------------------------------------
// STL-Inspired 3D Biome Props Builders
// Props are arranged strictly OUTSIDE the central well (radius > 1.45)
// ---------------------------------------------------------------------------

/** Forest: ring of pine and deciduous trees with woodcutter log piles */
export function createForestProps(): THREE.Group {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.9 });
  const darkPineMat = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.85, flatShading: true });
  const lightPineMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.85, flatShading: true });
  const logMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 });

  // 6 trees arranged around the outer perimeter of the hex
  const treePositions = [
    { x: -2.3, z: -1.2, s: 0.78 },
    { x: -1.8, z: 1.8, s: 0.7 },
    { x: 0, z: -2.6, s: 0.82 },
    { x: 1.8, z: -1.8, s: 0.75 },
    { x: 2.3, z: 1.2, s: 0.68 },
    { x: 0.2, z: 2.5, s: 0.76 },
  ];

  for (const { x, z, s } of treePositions) {
    const tree = new THREE.Group();
    // Trunk
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.16 * s, 0.7 * s, 6), trunkMat);
    trunk.position.y = 0.35 * s;
    trunk.castShadow = true;
    tree.add(trunk);

    // Cones tiers
    const c1 = new THREE.Mesh(new THREE.ConeGeometry(0.9 * s, 1.1 * s, 6), darkPineMat);
    c1.position.y = 0.85 * s;
    c1.castShadow = true;
    tree.add(c1);

    const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.7 * s, 0.9 * s, 6), lightPineMat);
    c2.position.y = 1.45 * s;
    c2.castShadow = true;
    tree.add(c2);

    const c3 = new THREE.Mesh(new THREE.ConeGeometry(0.45 * s, 0.7 * s, 6), lightPineMat);
    c3.position.y = 1.95 * s;
    c3.castShadow = true;
    tree.add(c3);

    tree.position.set(x, 0, z);
    group.add(tree);
  }

  // Stacked wood logs by the tree cluster
  const logCluster = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.8, 8), logMat);
    log.rotation.z = Math.PI / 2;
    log.position.set(-1.8, 0.12 + i * 0.14, 0);
    log.castShadow = true;
    logCluster.add(log);
  }
  group.add(logCluster);

  return group;
}

/** Fields: Dutch Windmill with 4 sails + curving golden wheat furrows */
export function createFieldsProps(): THREE.Group {
  const group = new THREE.Group();
  const millTowerMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.7, flatShading: true });
  const millRoofMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.6 });
  const sailMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 });
  const wheatMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.85, flatShading: true });

  // 1. Dutch Windmill in north-west corner (x: -1.9, z: -1.8)
  const windmill = new THREE.Group();
  windmill.position.set(-1.9, 0, -1.8);

  // Tower body
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.65, 1.6, 8), millTowerMat);
  tower.position.y = 0.8;
  tower.castShadow = true;
  windmill.add(tower);

  // Pitched cone roof
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.68, 0.65, 8), millRoofMat);
  roof.position.y = 1.9;
  roof.castShadow = true;
  windmill.add(roof);

  // Rotor hub
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.35, 8), woodMat);
  hub.rotation.x = Math.PI / 2;
  hub.position.set(0, 1.7, 0.45);
  windmill.add(hub);

  // 4 Windmill Sails (Cross)
  const sailGeom = new THREE.BoxGeometry(0.18, 1.8, 0.04);
  const sail1 = new THREE.Mesh(sailGeom, sailMat);
  sail1.position.set(0, 1.7, 0.55);
  sail1.rotation.z = Math.PI / 6;
  sail1.castShadow = true;
  windmill.add(sail1);

  const sail2 = new THREE.Mesh(sailGeom, sailMat);
  sail2.position.set(0, 1.7, 0.55);
  sail2.rotation.z = Math.PI / 6 + Math.PI / 2;
  sail2.castShadow = true;
  windmill.add(sail2);

  group.add(windmill);

  // 2. Curving wheat mounds surrounding the south/east side
  const wheatBeds = [
    { x: 1.8, z: -1.5, rot: -0.4, len: 1.6 },
    { x: 2.2, z: 0.4, rot: 0.3, len: 1.8 },
    { x: 1.6, z: 1.9, rot: 0.8, len: 1.6 },
    { x: -0.5, z: 2.3, rot: 1.4, len: 1.8 },
    { x: -2.0, z: 1.4, rot: 2.1, len: 1.5 },
  ];

  for (const b of wheatBeds) {
    const sheaf = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.36, b.len, 6), wheatMat);
    sheaf.rotation.z = Math.PI / 2;
    sheaf.rotation.y = b.rot;
    sheaf.position.set(b.x, 0.18, b.z);
    sheaf.castShadow = true;
    group.add(sheaf);
  }

  return group;
}

/** Mountains: High peaks + timber-framed mine entrance with rails */
export function createMountainProps(): THREE.Group {
  const group = new THREE.Group();
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.95, flatShading: true });
  const snowMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5, flatShading: true });
  const timberMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 });
  const caveMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });

  // 3 craggy mountain peaks clustered in the north
  const peaks = [
    { x: -1.2, z: -1.6, r: 1.4, h: 2.1, s: 5 },
    { x: 0.8, z: -1.9, r: 1.2, h: 1.8, s: 5 },
    { x: 2.1, z: -0.6, r: 1.1, h: 1.5, s: 5 },
  ];

  for (const p of peaks) {
    const peak = new THREE.Group();
    const rock = new THREE.Mesh(new THREE.ConeGeometry(p.r, p.h, p.s), rockMat);
    rock.position.y = p.h / 2;
    rock.castShadow = true;
    rock.receiveShadow = true;
    peak.add(rock);

    // Snowcap
    const snowH = p.h * 0.38;
    const snow = new THREE.Mesh(new THREE.ConeGeometry(p.r * 0.42, snowH, p.s), snowMat);
    snow.position.y = p.h - snowH / 2 + 0.02;
    snow.castShadow = true;
    peak.add(snow);

    peak.position.set(p.x, 0, p.z);
    group.add(peak);
  }

  // Mine entrance at south-east base of mountains (x: 1.7, z: 1.4)
  const mine = new THREE.Group();
  mine.position.set(1.7, 0, 1.4);
  mine.rotation.y = -Math.PI / 4;

  // Timber frame arch (left post, right post, lintel)
  const postGeom = new THREE.BoxGeometry(0.12, 0.75, 0.12);
  const leftPost = new THREE.Mesh(postGeom, timberMat);
  leftPost.position.set(-0.35, 0.37, 0);
  mine.add(leftPost);

  const rightPost = new THREE.Mesh(postGeom, timberMat);
  rightPost.position.set(0.35, 0.37, 0);
  mine.add(rightPost);

  const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.14, 0.14), timberMat);
  lintel.position.set(0, 0.75, 0);
  mine.add(lintel);

  // Dark cavern interior
  const cave = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.65), caveMat);
  cave.position.set(0, 0.35, -0.05);
  mine.add(cave);

  // Ore tracks
  const railGeom = new THREE.BoxGeometry(0.06, 0.04, 1.0);
  const railL = new THREE.Mesh(railGeom, timberMat);
  railL.position.set(-0.2, 0.02, 0.4);
  mine.add(railL);

  const railR = new THREE.Mesh(railGeom, timberMat);
  railR.position.set(0.2, 0.02, 0.4);
  mine.add(railR);

  group.add(mine);

  return group;
}

/** Hills: Stepped clay quarry + brick kiln with chimney and brick stack */
export function createHillsProps(): THREE.Group {
  const group = new THREE.Group();
  const clayMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.85, flatShading: true });
  const kilnMat = new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.8 });
  const chimneyMat = new THREE.MeshStandardMaterial({ color: 0x431407, roughness: 0.9 });
  const brickMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.7 });

  // 1. Terraced quarry steps in south-west
  const tiers = [
    { x: -1.7, z: 1.4, r: 1.6, h: 0.6 },
    { x: -1.4, z: 1.2, r: 1.2, h: 0.9 },
    { x: -2.1, z: -0.6, r: 1.4, h: 0.7 },
  ];

  for (const t of tiers) {
    const mound = new THREE.Mesh(new THREE.CylinderGeometry(t.r * 0.5, t.r, t.h, 7), clayMat);
    mound.position.set(t.x, t.h / 2, t.z);
    mound.castShadow = true;
    mound.receiveShadow = true;
    group.add(mound);
  }

  // 2. Brick firing kiln in north-east (x: 1.8, z: -1.5)
  const kiln = new THREE.Group();
  kiln.position.set(1.8, 0, -1.5);

  // Domed kiln base
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.65, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2), kilnMat);
  dome.position.y = 0;
  dome.castShadow = true;
  kiln.add(dome);

  // Chimney stack
  const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.2, 8), chimneyMat);
  chimney.position.y = 0.9;
  chimney.castShadow = true;
  kiln.add(chimney);

  // Stack of baked bricks
  const brickPile = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.3, 0.45), brickMat);
  brickPile.position.set(0.6, 0.15, 0.4);
  brickPile.castShadow = true;
  kiln.add(brickPile);

  group.add(kiln);

  return group;
}

/** Pasture: Grassy knoll with wooden post-and-rail fence + 3 grazing sheep */
export function createPastureProps(): THREE.Group {
  const group = new THREE.Group();
  const woolMat = new THREE.MeshStandardMaterial({ color: 0xf3f4f6, roughness: 0.9 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.9 });
  const fenceMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 });

  // 1. Post-and-rail wooden fence running along west edge
  const fence = new THREE.Group();
  const postGeom = new THREE.CylinderGeometry(0.08, 0.08, 0.7, 6);
  const railGeom = new THREE.BoxGeometry(0.06, 0.08, 1.3);

  for (let i = 0; i < 3; i++) {
    const post = new THREE.Mesh(postGeom, fenceMat);
    post.position.set(-2.2, 0.35, -1.2 + i * 1.2);
    post.castShadow = true;
    fence.add(post);
  }

  const rail1 = new THREE.Mesh(railGeom, fenceMat);
  rail1.position.set(-2.2, 0.45, -0.6);
  fence.add(rail1);

  const rail2 = new THREE.Mesh(railGeom, fenceMat);
  rail2.position.set(-2.2, 0.22, -0.6);
  fence.add(rail2);

  const rail3 = new THREE.Mesh(railGeom, fenceMat);
  rail3.position.set(-2.2, 0.45, 0.6);
  fence.add(rail3);

  const rail4 = new THREE.Mesh(railGeom, fenceMat);
  rail4.position.set(-2.2, 0.22, 0.6);
  fence.add(rail4);

  group.add(fence);

  // 2. Three low-poly grazing sheep around the pasture
  const sheepList = [
    { x: -1.3, z: 1.6, rot: 0.6 },
    { x: 1.8, z: -1.2, rot: 2.4 },
    { x: 1.6, z: 1.5, rot: -1.1 },
  ];

  for (const s of sheepList) {
    const sheep = new THREE.Group();
    // Wool body
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 8), woolMat);
    body.scale.set(1, 0.85, 1.35);
    body.position.y = 0.36;
    body.castShadow = true;
    sheep.add(body);

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 6, 6), headMat);
    head.position.set(0, 0.46, 0.4);
    head.castShadow = true;
    sheep.add(head);

    sheep.position.set(s.x, 0, s.z);
    sheep.rotation.y = s.rot;
    group.add(sheep);
  }

  return group;
}

/** Desert: Desert oasis with blue pool, date palm trees, and saguaro cacti */
export function createDesertProps(): THREE.Group {
  const group = new THREE.Group();
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x06b6d4,
    roughness: 0.2,
    metalness: 0.3,
  });
  const oasisBankMat = new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.8 });
  const palmTrunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
  const palmLeafMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.8, flatShading: true });
  const cactusMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.85, flatShading: true });

  // 1. Central Oasis Pool (desert has NO number token!)
  const pool = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 0.08, 16), waterMat);
  pool.position.y = 0.04;
  group.add(pool);

  // Grassy bank fringe
  const fringe = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.5, 16), oasisBankMat);
  fringe.rotation.x = -Math.PI / 2;
  fringe.position.y = 0.05;
  group.add(fringe);

  // 2. Palm tree leaning over the oasis
  const palm = new THREE.Group();
  palm.position.set(-1.1, 0, 0.9);

  // Curved trunk
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.9, 6), palmTrunkMat);
  trunk.position.set(0.15, 0.9, 0);
  trunk.rotation.z = -0.15;
  trunk.castShadow = true;
  palm.add(trunk);

  // Palm canopy leaves
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.5, 6), palmLeafMat);
  canopy.position.set(0.3, 1.85, 0);
  canopy.castShadow = true;
  palm.add(canopy);

  group.add(palm);

  // 3. Saguaro Cacti on the sand dunes
  const cactiPositions = [
    { x: 1.6, z: -1.2, h: 1.4 },
    { x: -1.8, z: -1.4, h: 1.1 },
  ];

  for (const c of cactiPositions) {
    const cactus = new THREE.Group();
    const trunkMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, c.h, 6), cactusMat);
    trunkMesh.position.y = c.h / 2;
    trunkMesh.castShadow = true;
    cactus.add(trunkMesh);

    // Arms
    const armH = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.35, 6), cactusMat);
    armH.rotation.z = Math.PI / 2;
    armH.position.set(0.18, c.h * 0.55, 0);
    cactus.add(armH);

    const armV = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.45, 6), cactusMat);
    armV.position.set(0.35, c.h * 0.7, 0);
    cactus.add(armV);

    cactus.position.set(c.x, 0, c.z);
    group.add(cactus);
  }

  return group;
}

/** Settlement: monochromatic in player color tonal shades (zero white), glowing roof and plinth */
export function createSettlementMesh(color: string): THREE.Group {
  const pal = PLAYER_3D_COLORS[color] ?? PLAYER_3D_COLORS.white!;
  const group = new THREE.Group();

  const plinthMat = new THREE.MeshStandardMaterial({ color: pal.dark, roughness: 0.75 });
  const playerRingMat = new THREE.MeshStandardMaterial({
    color: pal.main,
    emissive: pal.main,
    emissiveIntensity: 0.7,
    roughness: 0.2,
  });
  const wallMat = new THREE.MeshStandardMaterial({
    color: pal.main,
    emissive: pal.main,
    emissiveIntensity: 0.25,
    roughness: 0.35,
  });
  const timberMat = new THREE.MeshStandardMaterial({ color: pal.dark, roughness: 0.8 });
  const roofMat = new THREE.MeshStandardMaterial({
    color: pal.dark,
    emissive: pal.main,
    emissiveIntensity: 0.65,
    roughness: 0.2,
    metalness: 0.15,
  });
  const chimneyMat = new THREE.MeshStandardMaterial({ color: pal.dark, roughness: 0.6 });
  const smokeMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.9, transparent: true, opacity: 0.75 });

  // 1. Base plinth in deep player dark shade
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.30, 1.48, 0.32, 16), plinthMat);
  plinth.position.y = 0.16;
  plinth.receiveShadow = true;
  group.add(plinth);

  // Glowing player color ring around plinth
  const playerRing = new THREE.Mesh(new THREE.RingGeometry(1.05, 1.40, 16), playerRingMat);
  playerRing.rotation.x = -Math.PI / 2;
  playerRing.position.y = 0.33;
  group.add(playerRing);

  // 2. Cottage walls in vibrant player primary color (no white!)
  const walls = new THREE.Mesh(new THREE.BoxGeometry(1.35, 1.35, 1.35), wallMat);
  walls.position.y = 1.0;
  walls.castShadow = true;
  walls.receiveShadow = true;
  group.add(walls);

  // Corner timber framing in deep player shade
  const cornerTrim = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.10, 1.42), timberMat);
  cornerTrim.position.y = 1.68;
  group.add(cornerTrim);

  // 3. Steep gable roof in rich darker player shade with emissive glow
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.40, 1.50, 4), roofMat);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 2.40;
  roof.castShadow = true;
  group.add(roof);

  // 4. Chimney stack in deep player shade
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.95, 0.26), chimneyMat);
  chimney.position.set(0.44, 2.60, 0.28);
  chimney.castShadow = true;
  group.add(chimney);

  const smoke = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), smokeMat);
  smoke.position.set(0.44, 3.20, 0.28);
  group.add(smoke);

  const smoke2 = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), smokeMat);
  smoke2.position.set(0.50, 3.65, 0.28);
  group.add(smoke2);
  group.scale.setScalar(0.74); // Calibrated to 1x base scale (down from 1.35x)
  return group;
}

/** City: monochromatic in player color tonal shades (zero white), double-tower fortress with battlements */
export function createCityMesh(color: string): THREE.Group {
  const pal = PLAYER_3D_COLORS[color] ?? PLAYER_3D_COLORS.white!;
  const group = new THREE.Group();

  const plinthMat = new THREE.MeshStandardMaterial({ color: pal.dark, roughness: 0.8 });
  const wallMat = new THREE.MeshStandardMaterial({
    color: pal.main,
    emissive: pal.main,
    emissiveIntensity: 0.25,
    roughness: 0.35,
  });
  const battlementsMat = new THREE.MeshStandardMaterial({
    color: pal.dark,
    emissive: pal.main,
    emissiveIntensity: 0.7,
    roughness: 0.2,
    metalness: 0.15,
  });
  const flagMat = new THREE.MeshStandardMaterial({
    color: pal.light,
    emissive: pal.main,
    emissiveIntensity: 0.5,
    side: THREE.DoubleSide,
  });
  const goldPoleMat = new THREE.MeshStandardMaterial({ color: pal.dark, roughness: 0.3, metalness: 0.6 });

  // 1. Plinth foundation in deep player dark shade
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.34, 1.9), plinthMat);
  plinth.position.y = 0.17;
  plinth.receiveShadow = true;
  group.add(plinth);

  // Glowing player-colored border
  const playerBorder = new THREE.Mesh(new THREE.BoxGeometry(2.30, 0.40, 1.75), battlementsMat);
  playerBorder.position.y = 0.20;
  group.add(playerBorder);

  // 2. Main castle keep in vibrant player primary color (no white!)
  const keep = new THREE.Mesh(new THREE.BoxGeometry(1.75, 1.9, 1.35), wallMat);
  keep.position.set(0.30, 1.22, 0);
  keep.castShadow = true;
  keep.receiveShadow = true;
  group.add(keep);

  // Keep battlements in deep player shade with glow
  const keepBattlements = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.42, 1.48), battlementsMat);
  keepBattlements.position.set(0.30, 2.25, 0);
  keepBattlements.castShadow = true;
  group.add(keepBattlements);

  // 3. Tall observation watchtower in player primary color
  const tower = new THREE.Mesh(new THREE.BoxGeometry(1.1, 3.4, 1.1), wallMat);
  tower.position.set(-0.68, 1.85, 0);
  tower.castShadow = true;
  tower.receiveShadow = true;
  group.add(tower);

  // Tower battlements in deep player shade with glow
  const towerBattlements = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.48, 1.26), battlementsMat);
  towerBattlements.position.set(-0.68, 3.70, 0);
  towerBattlements.castShadow = true;
  group.add(towerBattlements);

  // Conical turret roof in deep player shade
  const turretRoof = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.1, 8), battlementsMat);
  turretRoof.position.set(-0.68, 4.40, 0);
  turretRoof.castShadow = true;
  group.add(turretRoof);

  // 4. Flagpole with heraldic pennant in player light shade
  const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.3, 6), goldPoleMat);
  flagPole.position.set(-0.68, 5.10, 0);
  group.add(flagPole);

  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.50), flagMat);
  flag.position.set(-0.25, 5.35, 0);
  group.add(flag);
  group.scale.setScalar(0.74); // Calibrated to 1x base scale (down from 1.35x)
  return group;
}

/** Road: 100% solid player color (pure monolithic bar, no white or contrasting lines) */
export function createRoadMesh(p1: THREE.Vector3, p2: THREE.Vector3, color: string): THREE.Group {
  const pal = PLAYER_3D_COLORS[color] ?? PLAYER_3D_COLORS.white!;
  const group = new THREE.Group();

  const solidMat = new THREE.MeshStandardMaterial({
    color: pal.main, // Pure solid player color (solid blue for blue, solid red for red!)
    roughness: 0.85, // Matte finish: completely eliminates any white specular reflection lines!
    metalness: 0.0, // Zero metallic specular sheen!
  });

  const dx = p2.x - p1.x;
  const dz = p2.z - p1.z;
  const len = Math.hypot(dx, dz);
  const angle = Math.atan2(dx, dz);

  // Solid monolithic rectangular road bar rising from street to a bit above the hex tiles
  const roadHeight = 0.78;
  const road = new THREE.Mesh(new THREE.BoxGeometry(0.62, roadHeight, len * 0.96), solidMat);
  road.position.y = roadHeight / 2;
  road.castShadow = true;
  road.receiveShadow = true;
  group.add(road);

  // Position at midpoint and orient flat on ground at street level
  group.position.addVectors(p1, p2).multiplyScalar(0.5);
  group.rotation.set(0, angle, 0); // Flat on ground!
  return group;
}

/** Robber: classic wooden pawn silhouette */
export function createRobberMesh(): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.4,
    metalness: 0.2,
  });

  // Base pedestal
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.85, 0.35, 16), mat);
  base.position.y = 0.17;
  base.castShadow = true;
  group.add(base);

  // Body waist
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.65, 1.4, 16), mat);
  body.position.y = 0.95;
  body.castShadow = true;
  group.add(body);

  // Collar
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.4, 0.15, 16), mat);
  collar.position.y = 1.68;
  collar.castShadow = true;
  group.add(collar);

  // Head sphere
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.48, 16, 16), mat);
  head.position.y = 2.15;
  head.castShadow = true;
  group.add(head);

  return group;
}

// ---------------------------------------------------------------------------
// 3D Harbor Ports (Wooden Pier, Pilings, Moored Sloop with Sail, Cargo & Badge)
// ---------------------------------------------------------------------------

const harborTextureCache = new Map<string, THREE.CanvasTexture>();

export function createHarborBadgeTexture(harbor: Harbor): THREE.CanvasTexture {
  const key = `${harbor.type}:${harbor.resource ?? 'any'}`;
  const cached = harborTextureCache.get(key);
  if (cached) return cached;

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');

  const isGeneric = harbor.type === 'generic';
  let bgColor = '#0284c7'; // Oceanic azure for 3:1 generic harbor
  let borderColor = '#38bdf8';
  let title = '3:1';
  let label = 'ANY';
  let icon = '⚓';

  if (!isGeneric) {
    title = '2:1';
    switch (harbor.resource) {
      case 'wood':
        bgColor = TERRAIN_COLORS.forest.top; // Exact match to forest tile
        borderColor = TERRAIN_COLORS.forest.side;
        label = 'WOOD';
        icon = '🌲';
        break;
      case 'brick':
        bgColor = TERRAIN_COLORS.hills.top; // Exact match to hills tile
        borderColor = TERRAIN_COLORS.hills.side;
        label = 'BRICK';
        icon = '🧱';
        break;
      case 'sheep':
        bgColor = TERRAIN_COLORS.pasture.top; // Exact match to pasture tile
        borderColor = TERRAIN_COLORS.pasture.side;
        label = 'SHEEP';
        icon = '🐑';
        break;
      case 'wheat':
        bgColor = TERRAIN_COLORS.fields.top; // Exact match to fields tile
        borderColor = TERRAIN_COLORS.fields.side;
        label = 'WHEAT';
        icon = '🌾';
        break;
      case 'ore':
        bgColor = TERRAIN_COLORS.mountains.top; // Exact match to mountains tile
        borderColor = TERRAIN_COLORS.mountains.side;
        label = 'ORE';
        icon = '⛰';
        break;
    }
  }

  // 1. Outer circular badge background in exact tile color with soft shadow
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 18;
  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // 2. Beveled border ring in tile side shade
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 26;
  ctx.stroke();

  // 3. Inner cream parchment disc
  ctx.fillStyle = '#fefdf8';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 42, 0, Math.PI * 2);
  ctx.fill();

  // Subtle inner accent ring
  ctx.strokeStyle = bgColor;
  ctx.lineWidth = 8;
  ctx.stroke();

  // 4. Large bold ratio text in pure solid black: "2:1" or "3:1"!
  ctx.font = 'bold 140px Rubik, sans-serif';
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, size / 2, size / 2 - 82);

  // 5. Center icon emblem matching resource
  ctx.font = '100px Rubik, sans-serif';
  ctx.fillText(icon, size / 2, size / 2 + 34);

  // 6. Bottom resource name label
  ctx.font = 'bold 48px Rubik, sans-serif';
  ctx.fillStyle = '#0f172a';
  ctx.fillText(label, size / 2, size / 2 + 124);

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 16;
  harborTextureCache.set(key, texture);
  return texture;
}

/** Creates a full 3D miniature harbor port: wooden pier on stilts, moored sailboat, cargo, and signpost */
export function createHarborPortMesh(harbor: Harbor): THREE.Group {
  const port = new THREE.Group();

  const woodDark = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 });
  const woodLight = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 });
  const plankMat = new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.75 });
  const sailMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45, side: THREE.DoubleSide });

  // 1. Wide and spacious wooden pier boardwalk (width 2.6, length 4.0)
  const pierDeck = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.28, 4.0), plankMat);
  pierDeck.position.set(0, 0.28, 2.0);
  pierDeck.castShadow = true;
  pierDeck.receiveShadow = true;
  port.add(pierDeck);

  // Dark walnut border trim around the pier edges
  const rimL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.32, 4.0), woodDark);
  rimL.position.set(-1.3, 0.30, 2.0);
  port.add(rimL);
  const rimR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.32, 4.0), woodDark);
  rimR.position.set(1.3, 0.30, 2.0);
  port.add(rimR);
  const rimEnd = new THREE.Mesh(new THREE.BoxGeometry(2.68, 0.32, 0.08), woodDark);
  rimEnd.position.set(0, 0.30, 4.0);
  port.add(rimEnd);

  // 6 Vertical Timber Pilings under the pier into the water
  const pilingGeom = new THREE.CylinderGeometry(0.10, 0.10, 1.2, 8);
  const pilingPositions = [
    { x: -1.1, z: 0.6 },
    { x: 1.1, z: 0.6 },
    { x: -1.1, z: 2.0 },
    { x: 1.1, z: 2.0 },
    { x: -1.1, z: 3.6 },
    { x: 1.1, z: 3.6 },
  ];
  for (const pos of pilingPositions) {
    const piling = new THREE.Mesh(pilingGeom, woodDark);
    piling.position.set(pos.x, -0.3, pos.z);
    piling.castShadow = true;
    port.add(piling);
  }

  // 2. Zone A: Dedicated Elevated Trade Medallion Disc (Center-Outer Dock)
  // Placed on an angled plinth tilted toward camera so the ratio is clearly legible!
  const plinthGeom = new THREE.CylinderGeometry(1.40, 1.45, 0.12, 32);
  const plinth = new THREE.Mesh(plinthGeom, woodDark);
  plinth.position.set(0, 0.44, 2.6);
  plinth.rotation.x = -0.20; // Tilted toward the island & camera!
  port.add(plinth);

  const badgeTex = createHarborBadgeTexture(harbor);
  const badgeTopMat = new THREE.MeshBasicMaterial({ map: badgeTex });
  const badgeSideMat = new THREE.MeshStandardMaterial({ color: 0x3d2415, roughness: 0.8 });
  const badgeGeom = new THREE.CylinderGeometry(1.30, 1.35, 0.18, 32);
  const badgeDisc = new THREE.Mesh(badgeGeom, [badgeSideMat, badgeTopMat, badgeSideMat]);
  badgeDisc.position.set(0, 0.54, 2.6);
  badgeDisc.rotation.x = -0.20; // Tilted toward camera for direct readability!
  badgeDisc.castShadow = true;
  badgeDisc.receiveShadow = true;
  port.add(badgeDisc);

  // 3. Zone B: Moored Trading Sailboat in Water (on left berth, completely off the pier!)
  const ship = new THREE.Group();
  ship.position.set(-2.1, -0.15, 2.0); // Floating in open water alongside the pier
  ship.rotation.y = 0.05;

  // Wooden Hull
  const hull = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.44, 2.1), woodLight);
  hull.position.y = 0.22;
  hull.castShadow = true;
  ship.add(hull);

  const shipDeck = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.08, 2.0), plankMat);
  shipDeck.position.y = 0.46;
  ship.add(shipDeck);

  // Mast
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.4, 8), woodDark);
  mast.position.set(0, 1.5, -0.1);
  mast.castShadow = true;
  ship.add(mast);

  // Yardarm spar
  const spar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.0, 8), woodDark);
  spar.rotation.z = Math.PI / 2;
  spar.position.set(0, 2.2, -0.05);
  ship.add(spar);

  // Canvas Sail
  const sail = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.4), sailMat);
  sail.position.set(0, 1.55, 0.05);
  sail.rotation.y = -0.15;
  sail.castShadow = true;
  ship.add(sail);

  port.add(ship);

  // 4. Zone C: Cargo Wharf on Right Side (neatly stacked away from medallion)
  const cargoGroup = new THREE.Group();
  cargoGroup.position.set(0.85, 0.42, 1.0);

  if (harbor.resource === 'wood') {
    const logMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 });
    for (let i = 0; i < 4; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.9, 8), logMat);
      log.rotation.z = Math.PI / 2;
      log.position.set(0, 0.1 + (i > 2 ? 0.16 : 0), (i % 3) * 0.28 - 0.28);
      log.castShadow = true;
      cargoGroup.add(log);
    }
  } else if (harbor.resource === 'brick') {
    const brickMat = new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.8 });
    for (let i = 0; i < 4; i++) {
      const brick = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.20), brickMat);
      brick.position.set(0, 0.08 + (i >= 2 ? 0.14 : 0), (i % 2) * 0.24 - 0.12);
      brick.castShadow = true;
      cargoGroup.add(brick);
    }
  } else if (harbor.resource === 'sheep') {
    const woolMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.9 });
    for (let i = 0; i < 2; i++) {
      const sack = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), woolMat);
      sack.scale.set(1, 0.8, 1.2);
      sack.position.set(0, 0.16, (i - 0.5) * 0.40);
      sack.castShadow = true;
      cargoGroup.add(sack);
    }
  } else if (harbor.resource === 'wheat') {
    const grainMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.85 });
    for (let i = 0; i < 2; i++) {
      const sack = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.22, 0.48, 8), grainMat);
      sack.position.set(0, 0.24, (i - 0.5) * 0.38);
      sack.castShadow = true;
      cargoGroup.add(sack);
    }
  } else if (harbor.resource === 'ore') {
    const oreMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.4, metalness: 0.6 });
    for (let i = 0; i < 3; i++) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22), oreMat);
      rock.position.set(0, 0.16, (i - 1) * 0.32);
      rock.castShadow = true;
      cargoGroup.add(rock);
    }
  } else {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.32, 0.45), woodDark);
    crate.position.set(0, 0.16, 0);
    crate.castShadow = true;
    cargoGroup.add(crate);
  }
  port.add(cargoGroup);

  // 5. Zone D: Illuminated Brass Lantern Posts on Pier Outer Corners
  const lanternPostGeom = new THREE.CylinderGeometry(0.04, 0.05, 0.7, 8);
  const lanternBoxGeom = new THREE.BoxGeometry(0.14, 0.18, 0.14);
  const lanternGlowMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.4,
  });

  for (const lx of [-1.15, 1.15]) {
    const post = new THREE.Mesh(lanternPostGeom, woodDark);
    post.position.set(lx, 0.65, 3.8);
    port.add(post);

    const box = new THREE.Mesh(lanternBoxGeom, lanternGlowMat);
    box.position.set(lx, 1.05, 3.8);
    port.add(box);
  }

  return port;
}

/** Creates a detailed wooden connecting footbridge on timber pilings with railings */
export function createHarborBridge(p1: THREE.Vector3, p2: THREE.Vector3): THREE.Group {
  const bridge = new THREE.Group();
  const timberMat = new THREE.MeshStandardMaterial({ color: 0x452b1a, roughness: 0.82 });
  const plankMat = new THREE.MeshStandardMaterial({
    color: 0x8a552e, // Warm oak boardwalk planking
    map: getWoodPathwayTexture(),
    roughness: 0.75,
  });
  const pilingMat = new THREE.MeshStandardMaterial({ color: 0x2e1b0f, roughness: 0.9 });

  const dx = p2.x - p1.x;
  const dz = p2.z - p1.z;
  const len = Math.hypot(dx, dz);
  const angle = Math.atan2(dx, dz);

  // 1. Longitudinal timber stringer beams
  const stringer1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, len * 0.98), timberMat);
  stringer1.position.set(-0.20, 0.08, 0);
  stringer1.castShadow = true;
  bridge.add(stringer1);

  const stringer2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, len * 0.98), timberMat);
  stringer2.position.set(0.20, 0.08, 0);
  stringer2.castShadow = true;
  bridge.add(stringer2);

  // 2. Wooden boardwalk plank deck
  const deck = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.08, len * 0.98), plankMat);
  deck.position.set(0, 0.16, 0);
  deck.castShadow = true;
  deck.receiveShadow = true;
  bridge.add(deck);

  // 3. Vertical wooden stilt pilings driving down into the water
  const pilingGeom = new THREE.CylinderGeometry(0.06, 0.07, 0.55, 8);
  const pCount = Math.max(2, Math.floor(len / 1.4));
  for (let i = 0; i <= pCount; i++) {
    const t = (i / pCount - 0.5) * len * 0.88;
    const postL = new THREE.Mesh(pilingGeom, pilingMat);
    postL.position.set(-0.22, -0.12, t);
    postL.castShadow = true;
    bridge.add(postL);

    const postR = new THREE.Mesh(pilingGeom, pilingMat);
    postR.position.set(0.22, -0.12, t);
    postR.castShadow = true;
    bridge.add(postR);

    // Guardrail upright posts
    const railPostL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.28, 0.05), timberMat);
    railPostL.position.set(-0.22, 0.32, t);
    bridge.add(railPostL);

    const railPostR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.28, 0.05), timberMat);
    railPostR.position.set(0.22, 0.32, t);
    bridge.add(railPostR);
  }

  // 4. Side handrails
  const railL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, len * 0.96), timberMat);
  railL.position.set(-0.22, 0.44, 0);
  bridge.add(railL);

  const railR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, len * 0.96), timberMat);
  railR.position.set(0.22, 0.44, 0);
  bridge.add(railR);

  bridge.position.addVectors(p1, p2).multiplyScalar(0.5);
  bridge.position.y += 0.02;
  bridge.rotation.set(0, angle, 0);
  return bridge;
}

// ---------------------------------------------------------------------------
// 3D Solid Beveled Wooden Board Frame & Tabletop
// ---------------------------------------------------------------------------

/** Creates an expansive, seamless deep ocean water basin */
export function createOceanBase(): THREE.Group {
  const group = new THREE.Group();

  // Expansive sunny liquid water lake basin
  const oceanMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7, // Radiant liquid water lake sky blue
    roughness: 0.10,
    metalness: 0.28,
  });
  const ocean = new THREE.Mesh(new THREE.CylinderGeometry(240, 240, 2.0, 64), oceanMat);
  ocean.position.y = -0.90;
  ocean.receiveShadow = true;
  group.add(ocean);

  return group;
}
