// 3D procedural asset library for Catan matching the official 3D Asset Reference Sheet.
// Assets:
// - Terrain Hex Tiles with consistent wooden/beveled hex frames.
// - Reference Biomes:
//   * Fields (Wheat): radiating curved golden wheat sheaves.
//   * Forest (Wood): dense cluster of faceted evergreen pine trees.
//   * Hills (Brick): terracotta clay quarry with two 3x2 stacked red brick cube piles.
//   * Mountains (Ore): cool slate ground with craggy faceted rock peaks and white snowcaps.
//   * Pasture (Sheep): lush green meadow with exactly 4 miniature 3D sheep.
//   * Desert: concentric rippled sand dunes, 2 saguaro cacti, and central crater.
// - Standard circular wooden vertex nodes and connecting road slots.
// - Solid player pieces (Red, Blue, Orange, White/Gray):
//   * Settlement: classic geometric wooden cottage with pitched gable roof.
//   * City: stepped L-shaped fortress building (higher tower + attached lower wing).
//   * Road: solid, clean, beveled rectangular bar lying flat in the slot.
// - Harbour / Port Assets:
//   * Wooden pier dock platform with railings and glowing warm lanterns.
//   * Moored sailboat with color-coded sails (Wheat: yellow, Wood: green, Brick: red,
//     Ore: white/gray, Sheep: light green, Generic: blue).
//   * Circular wooden trade medallion with dark rim showing 2:1 or 3:1 + silhouette icon.
// - Robber: smooth black pawn standing in a textured sandy crater base.
// - Ocean: deep royal blue water basin.

import * as THREE from 'three';
import type { Harbor, Terrain } from '@catan/shared';

export const SCALE = 0.048; // Scale factor from 2D board coordinates to 3D units
export const HEX_RADIUS = 4.74;
export const HEX_BASE_RADIUS = 4.78;
export const HEX_HEIGHT = 1.15;
export const WELL_RADIUS = 1.68; // Sunken circular well for number tokens

// 30-degree rotation so hex top and bottom edges are horizontal (matching reference image)
const COS30 = Math.cos(Math.PI / 6);
const SIN30 = Math.sin(Math.PI / 6);

export function toBoard3D(x2d: number, y2d: number): { x: number; z: number } {
  const rx = (x2d * COS30 - y2d * SIN30) * SCALE;
  const rz = (x2d * SIN30 + y2d * COS30) * SCALE;
  return { x: rx, z: rz };
}

// ---------------------------------------------------------------------------
// Materials & Palettes directly from the 3D Asset Reference Sheet
// ---------------------------------------------------------------------------

export const TERRAIN_COLORS: Record<Terrain, { top: string; side: string; rough: number }> = {
  fields: { top: '#f59e0b', side: '#b45309', rough: 0.75 }, // Golden wheat
  forest: { top: '#15803d', side: '#14532d', rough: 0.8 }, // Evergreen pine
  pasture: { top: '#22c55e', side: '#16a34a', rough: 0.7 }, // Lush meadow green
  mountains: { top: '#475569', side: '#334155', rough: 0.85 }, // Granite slate
  hills: { top: '#c2410c', side: '#9a3412', rough: 0.8 }, // Terracotta brick clay
  desert: { top: '#eab308', side: '#ca8a04', rough: 0.9 }, // Golden dune sand
};

// 4 Player Colors directly from the 3D Asset Reference Sheet
export const PLAYER_3D_COLORS: Record<string, { main: number; dark: number; light: number }> = {
  red: { main: 0xdc2626, dark: 0x991b1b, light: 0xef4444 },
  blue: { main: 0x2563eb, dark: 0x1d4ed8, light: 0x3b82f6 },
  orange: { main: 0xea580c, dark: 0xc2410c, light: 0xf97316 },
  white: { main: 0xcbd5e1, dark: 0x94a3b8, light: 0xf1f5f9 }, // White/Gray matching reference sheet
  green: { main: 0x16a34a, dark: 0x15803d, light: 0x22c55e },
  brown: { main: 0x854d0e, dark: 0x543007, light: 0xa16207 },
};

// ---------------------------------------------------------------------------
// Dynamic Canvas Texture for Number Tokens (matching reference sheet)
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

  // Outer border ring (dark wood / charcoal)
  const isSixOrEight = token === 6 || token === 8;
  ctx.strokeStyle = '#26150b';
  ctx.lineWidth = 26;
  ctx.stroke();

  // Inner subtle decorative circle
  ctx.strokeStyle = isSixOrEight ? 'rgba(220,38,38,0.3)' : 'rgba(38,21,11,0.25)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 40, 0, Math.PI * 2);
  ctx.stroke();

  // Number text: bold red for 6 and 8, bold dark black for others
  ctx.font = 'bold 160px sans-serif';
  ctx.fillStyle = isSixOrEight ? '#dc2626' : '#0f172a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(token), size / 2, size / 2 - 42);

  // Dot pips: clear probability dots
  const dotCount = pips;
  const dotSpacing = 36;
  const startX = size / 2 - ((dotCount - 1) * dotSpacing) / 2;
  const dotY = size / 2 + 96;
  ctx.fillStyle = isSixOrEight ? '#dc2626' : '#0f172a';

  for (let i = 0; i < dotCount; i++) {
    ctx.beginPath();
    ctx.arc(startX + i * dotSpacing, dotY, 12, 0, Math.PI * 2);
    ctx.fill();
    // Inner dot highlight
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(startX + i * dotSpacing - 3, dotY - 3, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = isSixOrEight ? '#dc2626' : '#0f172a';
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 16;
  tokenTextureCache.set(token, texture);
  return texture;
}

// ---------------------------------------------------------------------------
// 3D Biome Props Builders (100% Matching the 3D Asset Reference Sheet)
// ---------------------------------------------------------------------------

/** Forest: dense cluster of geometric evergreen pine trees encircling the token well */
export function createForestProps(): THREE.Group {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x452a17, roughness: 0.9 });
  const darkPineMat = new THREE.MeshStandardMaterial({ color: 0x144d28, roughness: 0.8, flatShading: true });
  const lightPineMat = new THREE.MeshStandardMaterial({ color: 0x1b5e32, roughness: 0.8, flatShading: true });

  const treePositions = [
    { x: -2.3, z: -1.2, s: 0.9 },
    { x: -1.4, z: -2.1, s: 1.0 },
    { x: 0.2, z: -2.4, s: 1.05 },
    { x: 1.8, z: -1.8, s: 0.9 },
    { x: 2.3, z: -0.2, s: 0.85 },
    { x: 2.1, z: 1.4, s: 0.95 },
    { x: 0.8, z: 2.3, s: 1.0 },
    { x: -1.2, z: 2.2, s: 0.9 },
    { x: -2.2, z: 0.8, s: 0.95 },
  ];

  for (const { x, z, s } of treePositions) {
    const tree = new THREE.Group();
    // Trunk
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * s, 0.14 * s, 0.6 * s, 6), trunkMat);
    trunk.position.y = 0.3 * s;
    trunk.castShadow = true;
    tree.add(trunk);

    // Cones tiers
    const c1 = new THREE.Mesh(new THREE.ConeGeometry(0.75 * s, 0.9 * s, 6), darkPineMat);
    c1.position.y = 0.7 * s;
    c1.castShadow = true;
    tree.add(c1);

    const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.55 * s, 0.75 * s, 6), lightPineMat);
    c2.position.y = 1.2 * s;
    c2.castShadow = true;
    tree.add(c2);

    const c3 = new THREE.Mesh(new THREE.ConeGeometry(0.38 * s, 0.55 * s, 6), lightPineMat);
    c3.position.y = 1.6 * s;
    c3.castShadow = true;
    tree.add(c3);

    tree.position.set(x, 0, z);
    group.add(tree);
  }

  return group;
}

/** Fields: radiating golden curved wheat sheaves sweeping around the token well */
export function createFieldsProps(): THREE.Group {
  const group = new THREE.Group();
  const wheatMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.75, flatShading: true });
  const goldSheafMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.7, flatShading: true });

  const sheaves = [
    { x: -2.1, z: -1.2, rot: 0.5, len: 1.8 },
    { x: -1.2, z: -2.2, rot: 1.1, len: 2.0 },
    { x: 0.8, z: -2.3, rot: 1.8, len: 1.9 },
    { x: 2.1, z: -1.2, rot: 2.5, len: 1.8 },
    { x: 2.2, z: 0.8, rot: -0.3, len: 2.0 },
    { x: 1.2, z: 2.2, rot: 0.4, len: 1.9 },
    { x: -0.8, z: 2.3, rot: 1.2, len: 2.0 },
    { x: -2.1, z: 1.1, rot: 2.0, len: 1.8 },
  ];

  for (let i = 0; i < sheaves.length; i++) {
    const s = sheaves[i]!;
    const mat = i % 2 === 0 ? wheatMat : goldSheafMat;
    const sheaf = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.38, s.len, 6), mat);
    sheaf.rotation.z = Math.PI / 2;
    sheaf.rotation.y = s.rot;
    sheaf.position.set(s.x, 0.16, s.z);
    sheaf.castShadow = true;
    sheaf.receiveShadow = true;
    group.add(sheaf);
  }

  return group;
}

/** Mountains: craggy faceted rock peaks with prominent white snowcaps */
export function createMountainProps(): THREE.Group {
  const group = new THREE.Group();
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.85, flatShading: true });
  const snowMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4, flatShading: true });

  const peaks = [
    { x: -1.3, z: -1.6, r: 1.4, h: 2.2, s: 5 },
    { x: 0.8, z: -1.9, r: 1.2, h: 1.9, s: 5 },
    { x: 2.1, z: -0.6, r: 1.1, h: 1.6, s: 5 },
    { x: 1.5, z: 1.6, r: 1.2, h: 1.8, s: 5 },
    { x: -1.6, z: 1.5, r: 1.3, h: 2.0, s: 5 },
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

  return group;
}

/** Hills: terracotta clay quarry with 3x2 stacked red brick cubes (exact match to reference sheet) */
export function createHillsProps(): THREE.Group {
  const group = new THREE.Group();
  const clayTerraceMat = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.85, flatShading: true });
  const brickMat = new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.7, flatShading: true });
  const darkBrickMat = new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.8 });

  // Terraced quarry bases
  const terraces = [
    { x: -1.8, z: -1.2, r: 1.1, h: 0.35 },
    { x: 1.8, z: 1.2, r: 1.2, h: 0.4 },
  ];

  for (const t of terraces) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(t.r * 0.7, t.r, t.h, 6), clayTerraceMat);
    m.position.set(t.x, t.h / 2, t.z);
    m.receiveShadow = true;
    group.add(m);
  }

  // Two clusters of stacked brick cubes (3x2 blocks neatly stacked)
  const brickClusters = [
    { cx: -1.8, cz: -1.2 },
    { cx: 1.8, cz: 1.2 },
  ];

  for (const { cx, cz } of brickClusters) {
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 2; col++) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.24, 0.32), row % 2 === 0 ? brickMat : darkBrickMat);
        b.position.set(cx + (col - 0.5) * 0.52, 0.12 + row * 0.25, cz + (row - 1) * 0.1);
        b.castShadow = true;
        b.receiveShadow = true;
        group.add(b);
      }
    }
  }

  return group;
}

/** Pasture: lush green grass with exactly 4 miniature 3D sheep grazing around the token */
export function createPastureProps(): THREE.Group {
  const group = new THREE.Group();
  const woolMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.9 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.9 });
  const earMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 });

  // Exactly 4 grazing sheep in 4 quadrants around the central token
  const sheepPositions = [
    { x: -1.6, z: -1.4, rot: 0.4 },
    { x: 1.7, z: -1.3, rot: 2.2 },
    { x: -1.5, z: 1.5, rot: -0.8 },
    { x: 1.6, z: 1.6, rot: -2.3 },
  ];

  for (const sp of sheepPositions) {
    const sheep = new THREE.Group();
    // Wool body
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.36, 10, 10), woolMat);
    body.scale.set(1, 0.85, 1.35);
    body.position.y = 0.38;
    body.castShadow = true;
    sheep.add(body);

    // Black head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), headMat);
    head.position.set(0, 0.48, 0.42);
    head.castShadow = true;
    sheep.add(head);

    // Tiny ears
    const earL = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 4), earMat);
    earL.rotation.z = Math.PI / 3;
    earL.position.set(-0.15, 0.55, 0.38);
    sheep.add(earL);

    const earR = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 4), earMat);
    earR.rotation.z = -Math.PI / 3;
    earR.position.set(0.15, 0.55, 0.38);
    sheep.add(earR);

    sheep.position.set(sp.x, 0, sp.z);
    sheep.rotation.y = sp.rot;
    group.add(sheep);
  }

  return group;
}

/** Desert: concentric rippled sand dunes, 2 saguaro cacti, and central crater for robber */
export function createDesertProps(): THREE.Group {
  const group = new THREE.Group();
  const duneMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.9, flatShading: true });
  const cactusMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.85, flatShading: true });

  // Concentric rippled dunes
  const r1 = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.18, 8, 24), duneMat);
  r1.rotation.x = -Math.PI / 2;
  r1.position.y = 0.08;
  group.add(r1);

  const r2 = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.22, 8, 24), duneMat);
  r2.rotation.x = -Math.PI / 2;
  r2.position.y = 0.06;
  group.add(r2);

  // 2 Saguaro Cacti
  const cacti = [
    { x: -1.7, z: 0.6, h: 1.4 },
    { x: 1.7, z: -0.6, h: 1.2 },
  ];

  for (const c of cacti) {
    const cactus = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, c.h, 6), cactusMat);
    trunk.position.y = c.h / 2;
    trunk.castShadow = true;
    cactus.add(trunk);

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

// ---------------------------------------------------------------------------
// Solid Player Pieces (Matching 3D Asset Reference Sheet)
// ---------------------------------------------------------------------------

/** Settlement: clean geometric wooden cottage with pitched gable roof in solid player color */
export function createSettlementMesh(color: string): THREE.Group {
  const pal = PLAYER_3D_COLORS[color] ?? PLAYER_3D_COLORS.white!;
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: pal.main,
    emissive: pal.main,
    emissiveIntensity: 0.25,
    roughness: 0.35,
    metalness: 0.1,
  });

  // Solid rectangular base walls
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.35, 1.1, 1.35), mat);
  base.position.y = 0.55;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  // Pitched gable roof
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.4, 1.1, 4), mat);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 1.65;
  roof.castShadow = true;
  group.add(roof);

  return group;
}

/** City: stepped L-shaped fortress building (higher tower + attached lower wing) in solid player color */
export function createCityMesh(color: string): THREE.Group {
  const pal = PLAYER_3D_COLORS[color] ?? PLAYER_3D_COLORS.white!;
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: pal.main,
    emissive: pal.main,
    emissiveIntensity: 0.3,
    roughness: 0.35,
    metalness: 0.1,
  });

  // Attached lower gabled wing
  const wingBase = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 1.2), mat);
  wingBase.position.set(0.4, 0.6, 0);
  wingBase.castShadow = true;
  wingBase.receiveShadow = true;
  group.add(wingBase);

  const wingRoof = new THREE.Mesh(new THREE.ConeGeometry(1.2, 0.9, 4), mat);
  wingRoof.rotation.y = Math.PI / 4;
  wingRoof.position.set(0.4, 1.65, 0);
  wingRoof.castShadow = true;
  group.add(wingRoof);

  // Higher gabled tower (forming L-shape)
  const towerBase = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.2, 1.1), mat);
  towerBase.position.set(-0.55, 1.1, 0);
  towerBase.castShadow = true;
  towerBase.receiveShadow = true;
  group.add(towerBase);

  const towerRoof = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.2, 4), mat);
  towerRoof.rotation.y = Math.PI / 4;
  towerRoof.position.set(-0.55, 2.8, 0);
  towerRoof.castShadow = true;
  group.add(towerRoof);

  return group;
}

/** Road: solid, clean, beveled rectangular bar in player color, lying flat between nodes */
export function createRoadMesh(p1: THREE.Vector3, p2: THREE.Vector3, color: string): THREE.Group {
  const pal = PLAYER_3D_COLORS[color] ?? PLAYER_3D_COLORS.white!;
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: pal.main,
    emissive: pal.main,
    emissiveIntensity: 0.35,
    roughness: 0.3,
    metalness: 0.1,
  });

  const dx = p2.x - p1.x;
  const dz = p2.z - p1.z;
  const len = Math.hypot(dx, dz);
  const angle = Math.atan2(dx, dz);

  // Clean, solid, beveled rectangular wooden road bar
  const road = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.38, len * 0.94), mat);
  road.position.y = 0.19;
  road.castShadow = true;
  road.receiveShadow = true;
  group.add(road);

  group.position.addVectors(p1, p2).multiplyScalar(0.5);
  group.position.y += 0.22;
  group.rotation.set(0, angle, 0); // Flat on ground!
  return group;
}

/** Robber: smooth black pawn standing in a textured sandy crater base */
export function createRobberMesh(): THREE.Group {
  const group = new THREE.Group();
  const pawnMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.35,
    metalness: 0.2,
  });
  const craterMat = new THREE.MeshStandardMaterial({
    color: 0xd4a373,
    roughness: 0.9,
    flatShading: true,
  });

  // Textured crater / rock base
  const crater = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.45, 0.35, 12), craterMat);
  crater.position.y = 0.17;
  crater.castShadow = true;
  group.add(crater);

  // Black pawn body
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.8, 0.3, 16), pawnMat);
  base.position.y = 0.45;
  base.castShadow = true;
  group.add(base);

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.6, 1.3, 16), pawnMat);
  body.position.y = 1.25;
  body.castShadow = true;
  group.add(body);

  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.38, 0.14, 16), pawnMat);
  collar.position.y = 1.95;
  collar.castShadow = true;
  group.add(collar);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.46, 16, 16), pawnMat);
  head.position.y = 2.45;
  head.castShadow = true;
  group.add(head);

  return group;
}

// ---------------------------------------------------------------------------
// 3D Harbour / Port Assets (Matching 3D Asset Reference Sheet)
// ---------------------------------------------------------------------------

const harborTextureCache = new Map<string, THREE.CanvasTexture>();

export function createHarborBadgeTexture(harbor: Harbor): THREE.CanvasTexture {
  const key = `${harbor.type}:${harbor.resource ?? 'any'}`;
  const cached = harborTextureCache.get(key);
  if (cached) return cached;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');

  const isGeneric = harbor.type === 'generic';
  let title = '3:1';
  let label = 'ANY';
  let icon = '⚓';

  if (!isGeneric) {
    title = '2:1';
    switch (harbor.resource) {
      case 'wood':
        label = 'WOOD';
        icon = '🪵';
        break;
      case 'brick':
        label = 'BRICK';
        icon = '🧱';
        break;
      case 'sheep':
        label = 'SHEEP';
        icon = '🐑';
        break;
      case 'wheat':
        label = 'WHEAT';
        icon = '🌾';
        break;
      case 'ore':
        label = 'ORE';
        icon = '🪨';
        break;
    }
  }

  // 1. Cream parchment circular disc background
  ctx.fillStyle = '#fefdf8';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 8, 0, Math.PI * 2);
  ctx.fill();

  // 2. Dark walnut/charcoal beveled rim (matching reference sheet)
  ctx.strokeStyle = '#26150b';
  ctx.lineWidth = 18;
  ctx.stroke();

  // Inner subtle border line
  ctx.strokeStyle = 'rgba(38,21,11,0.25)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 24, 0, Math.PI * 2);
  ctx.stroke();

  // 3. Ratio text: "2:1" or "3:1"
  ctx.font = 'bold 84px Rubik, sans-serif';
  ctx.fillStyle = '#0f172a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, size / 2, size / 2 - 46);

  // 4. Center resource emblem icon
  ctx.font = '64px Rubik, sans-serif';
  ctx.fillText(icon, size / 2, size / 2 + 20);

  // 5. Bottom label for 3:1 ("ANY")
  if (isGeneric) {
    ctx.font = 'bold 26px Rubik, sans-serif';
    ctx.fillStyle = '#475569';
    ctx.fillText(label, size / 2, size / 2 + 66);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  harborTextureCache.set(key, texture);
  return texture;
}

/** Creates a 3D harbor port matching the reference sheet: wooden dock, warm lanterns, color-coded sailboat, and medallion */
export function createHarborPortMesh(harbor: Harbor): THREE.Group {
  const port = new THREE.Group();

  const woodDark = new THREE.MeshStandardMaterial({ color: 0x26150b, roughness: 0.85 });
  const woodPlank = new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.75 });
  const lanternGlowMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.2,
  });

  // Color-coded sail according to resource from reference sheet:
  // Wheat: yellow sail; Wood: green sail; Brick: red sail; Ore: white/gray sail; Sheep: light green sail; Generic: blue sail
  let sailColor = 0x2563eb;
  if (harbor.type === 'specialty') {
    switch (harbor.resource) {
      case 'wheat': sailColor = 0xeab308; break;
      case 'wood': sailColor = 0x16a34a; break;
      case 'brick': sailColor = 0xdc2626; break;
      case 'ore': sailColor = 0xcbd5e1; break;
      case 'sheep': sailColor = 0x4ade80; break;
    }
  }
  const sailMat = new THREE.MeshStandardMaterial({ color: sailColor, roughness: 0.4, side: THREE.DoubleSide });

  // 1. Circular Wooden Harbor Trade Token Disc
  const badgeTex = createHarborBadgeTexture(harbor);
  const topMat = new THREE.MeshBasicMaterial({ map: badgeTex });
  const sideMat = new THREE.MeshStandardMaterial({ color: 0x26150b, roughness: 0.8 });
  const discGeom = new THREE.CylinderGeometry(1.25, 1.32, 0.28, 32);
  const harborDisc = new THREE.Mesh(discGeom, [sideMat, topMat, sideMat]);
  harborDisc.position.set(0, 0.14, 0);
  harborDisc.castShadow = true;
  harborDisc.receiveShadow = true;
  port.add(harborDisc);

  // 2. Wooden Dock Platform with Pilings & Railing
  const dock = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.24, 2.4), woodPlank);
  dock.position.set(0, 0.12, 1.4);
  dock.castShadow = true;
  port.add(dock);

  // 2 Glowing Lantern Posts on the dock corners (Dock Props)
  const postGeom = new THREE.CylinderGeometry(0.06, 0.06, 0.7, 8);
  const lanternBoxGeom = new THREE.BoxGeometry(0.18, 0.22, 0.18);

  const post1 = new THREE.Mesh(postGeom, woodDark);
  post1.position.set(-0.7, 0.45, 2.4);
  port.add(post1);
  const lantern1 = new THREE.Mesh(lanternBoxGeom, lanternGlowMat);
  lantern1.position.set(-0.7, 0.85, 2.4);
  port.add(lantern1);

  const post2 = new THREE.Mesh(postGeom, woodDark);
  post2.position.set(0.7, 0.45, 2.4);
  port.add(post2);
  const lantern2 = new THREE.Mesh(lanternBoxGeom, lanternGlowMat);
  lantern2.position.set(0.7, 0.85, 2.4);
  port.add(lantern2);

  // 3. Moored Sailboat with color-coded sail
  const ship = new THREE.Group();
  ship.position.set(-1.2, -0.15, 1.2);
  ship.rotation.y = 0.35;

  const hull = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.35, 1.6), woodDark);
  hull.position.y = 0.17;
  hull.castShadow = true;
  ship.add(hull);

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.9, 6), woodDark);
  mast.position.set(0, 1.05, 0);
  mast.castShadow = true;
  ship.add(mast);

  const sail = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 1.2), sailMat);
  sail.position.set(0, 1.15, 0.08);
  sail.rotation.y = -0.12;
  sail.castShadow = true;
  ship.add(sail);

  port.add(ship);
  return port;
}

// ---------------------------------------------------------------------------
// Deep Royal Blue Ocean Water
// ---------------------------------------------------------------------------

export function createOceanBase(): THREE.Group {
  const group = new THREE.Group();

  // Deep royal/navy blue ocean water basin matching reference sheet
  const oceanMat = new THREE.MeshStandardMaterial({
    color: 0x0a2647, // Deep royal blue sea
    roughness: 0.15,
    metalness: 0.35,
  });
  const ocean = new THREE.Mesh(new THREE.CylinderGeometry(200, 200, 2.0, 64), oceanMat);
  ocean.position.y = -1.0;
  ocean.receiveShadow = true;
  group.add(ocean);

  return group;
}
