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
import type { Terrain } from '@catan/shared';

export const SCALE = 0.048; // Scale factor from 2D board coordinates to 3D units
export const HEX_RADIUS = 4.1;
export const HEX_HEIGHT = 1.1;
export const WELL_RADIUS = 1.35; // Sunken circular well for number tokens

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
  red: { main: 0xef4444, dark: 0x991b1b, light: 0xf87171 },
  blue: { main: 0x3b82f6, dark: 0x1e40af, light: 0x60a5fa },
  orange: { main: 0xf97316, dark: 0x9a3412, light: 0xfb923c },
  white: { main: 0xf8fafc, dark: 0x94a3b8, light: 0xffffff },
  green: { main: 0x22c55e, dark: 0x166534, light: 0x4ade80 },
  brown: { main: 0x854d0e, dark: 0x543007, light: 0xa16207 },
};

// ---------------------------------------------------------------------------
// Dynamic Canvas Texture for Number Tokens
// ---------------------------------------------------------------------------

const tokenTextureCache = new Map<number, THREE.CanvasTexture>();

export function getNumberTokenTexture(token: number, pips: number): THREE.CanvasTexture {
  const cached = tokenTextureCache.get(token);
  if (cached) return cached;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  // Background circle (parchment ivory)
  ctx.fillStyle = '#fefdfa';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 8, 0, Math.PI * 2);
  ctx.fill();

  // Outer border ring
  const isSixOrEight = token === 6 || token === 8;
  ctx.strokeStyle = isSixOrEight ? '#dc2626' : '#64748b';
  ctx.lineWidth = 12;
  ctx.stroke();

  // Inner subtle decorative circle
  ctx.strokeStyle = isSixOrEight ? 'rgba(220,38,38,0.35)' : 'rgba(100,116,139,0.35)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 20, 0, Math.PI * 2);
  ctx.stroke();

  // Number text
  ctx.font = 'bold 96px Rubik, sans-serif';
  ctx.fillStyle = isSixOrEight ? '#dc2626' : '#0f172a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(token), size / 2, size / 2 - 14);

  // Dot pips
  const dotCount = pips;
  const dotSpacing = 17;
  const startX = size / 2 - ((dotCount - 1) * dotSpacing) / 2;
  const dotY = size / 2 + 56;
  ctx.fillStyle = isSixOrEight ? '#dc2626' : '#0f172a';

  for (let i = 0; i < dotCount; i++) {
    ctx.beginPath();
    ctx.arc(startX + i * dotSpacing, dotY, 5.5, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  tokenTextureCache.set(token, texture);
  return texture;
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
    { x: -2.3, z: -1.2, s: 1.1 },
    { x: -1.8, z: 1.8, s: 0.95 },
    { x: 0, z: -2.6, s: 1.15 },
    { x: 1.8, z: -1.8, s: 1.0 },
    { x: 2.3, z: 1.2, s: 0.9 },
    { x: 0.2, z: 2.5, s: 1.05 },
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
    { x: -1.2, z: -1.6, r: 1.6, h: 2.9, s: 5 },
    { x: 0.8, z: -1.9, r: 1.4, h: 2.6, s: 5 },
    { x: 2.1, z: -0.6, r: 1.3, h: 2.2, s: 5 },
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

// ---------------------------------------------------------------------------
// 3D Playing Pieces Builders
// ---------------------------------------------------------------------------

/** Settlement: gabled cottage with roof & chimney */
export function createSettlementMesh(color: string): THREE.Group {
  const pal = PLAYER_3D_COLORS[color] ?? PLAYER_3D_COLORS.white!;
  const group = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({ color: pal.main, roughness: 0.6 });
  const roofMat = new THREE.MeshStandardMaterial({ color: pal.dark, roughness: 0.5 });
  const trimMat = new THREE.MeshStandardMaterial({ color: pal.light, roughness: 0.5 });

  // Cottage base
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.9), wallMat);
  base.position.y = 0.35;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  // Roof (prism)
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.8, 0.55, 4), roofMat);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 0.95;
  roof.castShadow = true;
  group.add(roof);

  // Chimney
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.4, 0.18), trimMat);
  chimney.position.set(0.25, 1.05, 0.15);
  chimney.castShadow = true;
  group.add(chimney);

  return group;
}

/** City: fortified castle keep with corner tower */
export function createCityMesh(color: string): THREE.Group {
  const pal = PLAYER_3D_COLORS[color] ?? PLAYER_3D_COLORS.white!;
  const group = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({ color: pal.main, roughness: 0.5 });
  const turretMat = new THREE.MeshStandardMaterial({ color: pal.dark, roughness: 0.5 });

  // Main hall
  const hall = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 0.9), wallMat);
  hall.position.set(0.2, 0.45, 0);
  hall.castShadow = true;
  hall.receiveShadow = true;
  group.add(hall);

  // High tower
  const tower = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.5, 0.7), turretMat);
  tower.position.set(-0.4, 0.75, 0);
  tower.castShadow = true;
  tower.receiveShadow = true;
  group.add(tower);

  // Battlements on tower
  const battlements = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.25, 0.8), wallMat);
  battlements.position.set(-0.4, 1.55, 0);
  battlements.castShadow = true;
  group.add(battlements);

  return group;
}

/** Road: beveled timber log between two 3D points */
export function createRoadMesh(p1: THREE.Vector3, p2: THREE.Vector3, color: string): THREE.Mesh {
  const pal = PLAYER_3D_COLORS[color] ?? PLAYER_3D_COLORS.white!;
  const mat = new THREE.MeshStandardMaterial({ color: pal.main, roughness: 0.6 });

  const dir = new THREE.Vector3().subVectors(p2, p1);
  const len = dir.length();
  const geom = new THREE.CylinderGeometry(0.22, 0.22, len * 0.92, 8);
  const mesh = new THREE.Mesh(geom, mat);

  mesh.position.addVectors(p1, p2).multiplyScalar(0.5);
  mesh.position.y += 0.24;
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
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
