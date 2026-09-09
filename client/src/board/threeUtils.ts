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
export const HEX_RADIUS = 4.76;
export const HEX_BASE_RADIUS = 4.80;
export const HEX_HEIGHT = 1.15;
export const WELL_RADIUS = 1.70; // Sunken circular well for number tokens

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
  red: { main: 0xdc2626, dark: 0x7f1d1d, light: 0xf87171 },
  blue: { main: 0x2563eb, dark: 0x1e3a8a, light: 0x60a5fa },
  orange: { main: 0xea580c, dark: 0x7c2d12, light: 0xfb923c },
  white: { main: 0x94a3b8, dark: 0x475569, light: 0xcbd5e1 }, // Silver-platinum tone (distinct from white stone paths)
  green: { main: 0x16a34a, dark: 0x14532d, light: 0x4ade80 },
  brown: { main: 0x854d0e, dark: 0x451a03, light: 0xb45309 },
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

  // Outer border ring
  const isSixOrEight = token === 6 || token === 8;
  ctx.strokeStyle = isSixOrEight ? '#dc2626' : '#475569';
  ctx.lineWidth = 26;
  ctx.stroke();

  // Inner subtle decorative circle
  ctx.strokeStyle = isSixOrEight ? 'rgba(220,38,38,0.35)' : 'rgba(71,85,105,0.35)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 40, 0, Math.PI * 2);
  ctx.stroke();

  // Number text: massive, bold font!
  ctx.font = 'bold 210px Rubik, sans-serif';
  ctx.fillStyle = isSixOrEight ? '#dc2626' : '#0f172a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(token), size / 2, size / 2 - 32);

  // Dot pips: large bold probability dots!
  const dotCount = pips;
  const dotSpacing = 36;
  const startX = size / 2 - ((dotCount - 1) * dotSpacing) / 2;
  const dotY = size / 2 + 120;
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
// STL-Inspired 3D Biome Props Builders
// Props are arranged strictly OUTSIDE the central well (radius > 1.45)
// ---------------------------------------------------------------------------

/** Forest: dense cluster of evergreen pine trees encircling the token well (matching reference image) */
export function createForestProps(): THREE.Group {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x452a17, roughness: 0.9 });
  const darkPineMat = new THREE.MeshStandardMaterial({ color: 0x144d28, roughness: 0.85, flatShading: true });
  const lightPineMat = new THREE.MeshStandardMaterial({ color: 0x1b5e32, roughness: 0.85, flatShading: true });

  const treePositions = [
    { x: -2.3, z: -1.2, s: 0.95 },
    { x: -1.4, z: -2.1, s: 1.05 },
    { x: 0.2, z: -2.4, s: 1.1 },
    { x: 1.8, z: -1.8, s: 0.95 },
    { x: 2.3, z: -0.2, s: 0.9 },
    { x: 2.1, z: 1.4, s: 1.0 },
    { x: 0.8, z: 2.3, s: 1.05 },
    { x: -1.2, z: 2.2, s: 0.95 },
    { x: -2.2, z: 0.8, s: 1.0 },
  ];

  for (const { x, z, s } of treePositions) {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * s, 0.14 * s, 0.6 * s, 6), trunkMat);
    trunk.position.y = 0.3 * s;
    trunk.castShadow = true;
    tree.add(trunk);

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

/** Fields: radiating golden curved wheat sheaves sweeping around the token well (matching reference image) */
export function createFieldsProps(): THREE.Group {
  const group = new THREE.Group();
  const wheatMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.8, flatShading: true });
  const goldSheafMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.75, flatShading: true });

  // Radiating wheat sheaves curving around the perimeter
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

/** Hills: stepped stacks of red/terracotta brick blocks and clay terraces (matching reference image) */
export function createHillsProps(): THREE.Group {
  const group = new THREE.Group();
  const clayTerraceMat = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.85, flatShading: true });
  const brickMat = new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.7, flatShading: true });
  const darkBrickMat = new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.8 });

  // Terraced quarry bases
  const terraces = [
    { x: -1.8, z: -1.2, r: 1.1, h: 0.4 },
    { x: 1.8, z: 1.2, r: 1.2, h: 0.45 },
  ];

  for (const t of terraces) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(t.r * 0.7, t.r, t.h, 6), clayTerraceMat);
    m.position.set(t.x, t.h / 2, t.z);
    m.receiveShadow = true;
    group.add(m);
  }

  // Stacked brick blocks in stepped piles (exact match to reference image!)
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

/** Pasture: lush green grass with exactly 4 miniature 3D sheep grazing around the token (matching reference image) */
export function createPastureProps(): THREE.Group {
  const group = new THREE.Group();
  const woolMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.9 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.9 });
  const earMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 });

  // Exactly 4 grazing sheep positioned in 4 quadrants around the central token
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

  return group;
}

/** Road: completely in one player color with tonal chassis, glowing core, and light accent (zero white) */
export function createRoadMesh(p1: THREE.Vector3, p2: THREE.Vector3, color: string): THREE.Group {
  const pal = PLAYER_3D_COLORS[color] ?? PLAYER_3D_COLORS.white!;
  const group = new THREE.Group();

  const chassisMat = new THREE.MeshStandardMaterial({ color: pal.dark, roughness: 0.8 });
  const coreMat = new THREE.MeshStandardMaterial({
    color: pal.main,
    emissive: pal.main,
    emissiveIntensity: 0.7,
    roughness: 0.18,
    metalness: 0.15,
  });
  const highlightMat = new THREE.MeshStandardMaterial({
    color: pal.light, // Player light shade (NO white!)
    emissive: pal.main,
    emissiveIntensity: 0.6,
    roughness: 0.25,
  });

  const dx = p2.x - p1.x;
  const dz = p2.z - p1.z;
  const len = Math.hypot(dx, dz);
  const angle = Math.atan2(dx, dz);

  // 1. Dark chassis in deep player dark tone
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.30, len * 0.95), chassisMat);
  chassis.position.y = 0.15;
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  group.add(chassis);

  // 2. Vibrant glowing player core beam
  const core = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.26, len * 0.92), coreMat);
  core.position.y = 0.18;
  core.castShadow = true;
  group.add(core);

  // 3. Center highlight stripe in player light tone (zero white!)
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, len * 0.88), highlightMat);
  stripe.position.y = 0.32;
  group.add(stripe);

  // Position at midpoint and orient flat on ground
  group.position.addVectors(p1, p2).multiplyScalar(0.5);
  group.position.y += 0.19;
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

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');

  const isGeneric = harbor.type === 'generic';
  let title = '3:1';
  let label = 'ANY';
  let icon = '⛵';

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

  // 2. Dark walnut/charcoal beveled rim (matching reference image!)
  ctx.strokeStyle = '#26150b';
  ctx.lineWidth = 18;
  ctx.stroke();

  // Inner subtle border line
  ctx.strokeStyle = 'rgba(38,21,11,0.25)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 24, 0, Math.PI * 2);
  ctx.stroke();

  // 3. Ratio text: "2:1" or "3:1" (bold dark font matching reference image)
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
/** Creates a circular harbor trade disc matching the reference image, with a moored sailboat */
export function createHarborPortMesh(harbor: Harbor): THREE.Group {
  const port = new THREE.Group();

  const woodDark = new THREE.MeshStandardMaterial({ color: 0x26150b, roughness: 0.85 });
  const woodLight = new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.8 });
  const sailMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45, side: THREE.DoubleSide });

  // 1. Circular Wooden Harbor Token Disc (matching reference image!)
  const badgeTex = createHarborBadgeTexture(harbor);
  const topMat = new THREE.MeshBasicMaterial({ map: badgeTex });
  const sideMat = new THREE.MeshStandardMaterial({ color: 0x26150b, roughness: 0.8 });
  const discGeom = new THREE.CylinderGeometry(1.25, 1.32, 0.28, 32);
  const harborDisc = new THREE.Mesh(discGeom, [sideMat, topMat, sideMat]);
  harborDisc.position.set(0, 0.14, 0);
  harborDisc.castShadow = true;
  harborDisc.receiveShadow = true;
  port.add(harborDisc);

  // 2. Miniature 3D Merchant Trading Ship (moored beside the harbor token)
  const ship = new THREE.Group();
  ship.position.set(-1.1, -0.15, -0.6);
  ship.rotation.y = 0.4;

  // Wooden Hull
  const hull = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.35, 1.5), woodLight);
  hull.position.y = 0.17;
  hull.castShadow = true;
  ship.add(hull);

  // Mast & Sail
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.8, 6), woodDark);
  mast.position.set(0, 1.0, 0);
  mast.castShadow = true;
  ship.add(mast);

  const sail = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.1), sailMat);
  sail.position.set(0, 1.1, 0.08);
  sail.rotation.y = -0.12;
  sail.castShadow = true;
  ship.add(sail);

  port.add(ship);
  return port;
}

// ---------------------------------------------------------------------------
// 3D Solid Beveled Wooden Board Frame & Tabletop
// ---------------------------------------------------------------------------

/** Creates an expansive, seamless deep ocean water basin */
export function createOceanBase(): THREE.Group {
  const group = new THREE.Group();

  // Expansive deep turquoise/navy ocean water basin (radius 200 supports wide zoom out)
  const oceanMat = new THREE.MeshStandardMaterial({
    color: 0x052f52,
    roughness: 0.15,
    metalness: 0.35,
  });
  const ocean = new THREE.Mesh(new THREE.CylinderGeometry(200, 200, 2.0, 64), oceanMat);
  ocean.position.y = -1.0;
  ocean.receiveShadow = true;
  group.add(ocean);

  return group;
}
