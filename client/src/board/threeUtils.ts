// 3D procedural geometries, materials, biome props, and token textures for Three.js Catan world.

import * as THREE from 'three';
import type { Terrain } from '@catan/shared';

export const SCALE = 0.048; // Scale factor from 2D board coordinates to 3D units
export const HEX_RADIUS = 4.1;
export const HEX_HEIGHT = 1.1;

// ---------------------------------------------------------------------------
// Materials & Palettes
// ---------------------------------------------------------------------------

export const TERRAIN_COLORS: Record<Terrain, { top: string; side: string; rough: number }> = {
  fields: { top: '#eab308', side: '#ca8a04', rough: 0.85 }, // Golden wheat
  forest: { top: '#15803d', side: '#166534', rough: 0.9 }, // Deep pine green
  pasture: { top: '#4ade80', side: '#22c55e', rough: 0.75 }, // Lush meadow
  mountains: { top: '#64748b', side: '#475569', rough: 0.95 }, // Rocky slate
  hills: { top: '#c2410c', side: '#9a3412', rough: 0.8 }, // Terracotta clay
  desert: { top: '#fde047', side: '#eab308', rough: 0.95 }, // Sunlit sand dunes
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
  ctx.fillStyle = '#fbf7ee';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 8, 0, Math.PI * 2);
  ctx.fill();

  // Outer border ring
  const isSixOrEight = token === 6 || token === 8;
  ctx.strokeStyle = isSixOrEight ? '#dc2626' : '#94a3b8';
  ctx.lineWidth = 10;
  ctx.stroke();

  // Inner subtle decorative circle
  ctx.strokeStyle = isSixOrEight ? 'rgba(220,38,38,0.3)' : 'rgba(100,116,139,0.3)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 20, 0, Math.PI * 2);
  ctx.stroke();

  // Number text
  ctx.font = 'bold 94px Rubik, sans-serif';
  ctx.fillStyle = isSixOrEight ? '#dc2626' : '#1e293b';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(token), size / 2, size / 2 - 12);

  // Dot pips
  const dotCount = pips;
  const dotSpacing = 16;
  const startX = size / 2 - ((dotCount - 1) * dotSpacing) / 2;
  const dotY = size / 2 + 56;
  ctx.fillStyle = isSixOrEight ? '#dc2626' : '#1e293b';

  for (let i = 0; i < dotCount; i++) {
    ctx.beginPath();
    ctx.arc(startX + i * dotSpacing, dotY, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  tokenTextureCache.set(token, texture);
  return texture;
}

// ---------------------------------------------------------------------------
// 3D Biome Props Builders
// ---------------------------------------------------------------------------

/** Forest: cluster of 3D pine trees */
export function createForestProps(): THREE.Group {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.9 });
  const pineMatDark = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.85, flatShading: true });
  const pineMatLight = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.85, flatShading: true });

  const treePositions = [
    { x: -1.2, z: -0.9, s: 1.0 },
    { x: 1.1, z: -0.8, s: 0.85 },
    { x: -0.8, z: 1.0, s: 0.95 },
    { x: 1.0, z: 1.1, s: 0.8 },
    { x: 0, z: 0.1, s: 1.15 },
  ];

  for (const { x, z, s } of treePositions) {
    const tree = new THREE.Group();
    // Trunk
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.16 * s, 0.6 * s, 6), trunkMat);
    trunk.position.y = 0.3 * s;
    trunk.castShadow = true;
    tree.add(trunk);

    // Foliage tiers (cones)
    const b1 = new THREE.Mesh(new THREE.ConeGeometry(0.9 * s, 1.1 * s, 6), pineMatDark);
    b1.position.y = 0.8 * s;
    b1.castShadow = true;
    tree.add(b1);

    const b2 = new THREE.Mesh(new THREE.ConeGeometry(0.7 * s, 0.9 * s, 6), pineMatLight);
    b2.position.y = 1.35 * s;
    b2.castShadow = true;
    tree.add(b2);

    const b3 = new THREE.Mesh(new THREE.ConeGeometry(0.45 * s, 0.7 * s, 6), pineMatLight);
    b3.position.y = 1.8 * s;
    b3.castShadow = true;
    tree.add(b3);

    tree.position.set(x, 0, z);
    group.add(tree);
  }
  return group;
}

/** Mountains: jagged faceted peaks with snowcaps */
export function createMountainProps(): THREE.Group {
  const group = new THREE.Group();
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.95, flatShading: true });
  const snowMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5, flatShading: true });

  const peaks = [
    { x: 0, z: 0.1, r: 1.7, h: 2.8, s: 5 },
    { x: -1.3, z: -0.9, r: 1.2, h: 2.0, s: 5 },
    { x: 1.2, z: 0.8, r: 1.3, h: 2.2, s: 5 },
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

/** Pasture: rolling knoll with low-poly sheep */
export function createPastureProps(): THREE.Group {
  const group = new THREE.Group();
  const woolMat = new THREE.MeshStandardMaterial({ color: 0xf3f4f6, roughness: 0.9 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.9 });

  const sheepPositions = [
    { x: -1.0, z: -0.6, rot: 0.4 },
    { x: 0.9, z: 0.7, rot: 2.2 },
    { x: -0.2, z: 1.0, rot: -1.2 },
  ];

  for (const sp of sheepPositions) {
    const sheep = new THREE.Group();
    // Wool body
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 8), woolMat);
    body.scale.set(1, 0.85, 1.3);
    body.position.y = 0.35;
    body.castShadow = true;
    sheep.add(body);

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 6), headMat);
    head.position.set(0, 0.48, 0.38);
    head.castShadow = true;
    sheep.add(head);

    sheep.position.set(sp.x, 0, sp.z);
    sheep.rotation.y = sp.rot;
    group.add(sheep);
  }
  return group;
}

/** Fields: undulating golden wheat sheaves / mounds */
export function createFieldsProps(): THREE.Group {
  const group = new THREE.Group();
  const wheatMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.8, flatShading: true });

  const rows = [-1.3, -0.4, 0.5, 1.4];
  for (const z of rows) {
    const furrow = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.35, 2.4, 6), wheatMat);
    furrow.rotation.z = Math.PI / 2;
    furrow.position.set(0, 0.16, z);
    furrow.castShadow = true;
    furrow.receiveShadow = true;
    group.add(furrow);
  }
  return group;
}

/** Hills: terracotta clay quarry tiers */
export function createHillsProps(): THREE.Group {
  const group = new THREE.Group();
  const clayMat1 = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.85, flatShading: true });
  const clayMat2 = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.9, flatShading: true });

  const mounds = [
    { x: -0.8, z: -0.5, r: 1.4, h: 0.9, mat: clayMat1 },
    { x: 0.8, z: 0.5, r: 1.2, h: 0.75, mat: clayMat2 },
    { x: 0, z: -0.2, r: 1.0, h: 1.2, mat: clayMat1 },
  ];

  for (const m of mounds) {
    const mound = new THREE.Mesh(new THREE.CylinderGeometry(m.r * 0.4, m.r, m.h, 7), m.mat);
    mound.position.set(m.x, m.h / 2, m.z);
    mound.castShadow = true;
    mound.receiveShadow = true;
    group.add(mound);
  }
  return group;
}

/** Desert: sand dunes and saguaro cacti */
export function createDesertProps(): THREE.Group {
  const group = new THREE.Group();
  const cactusMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.85, flatShading: true });

  const cacti = [
    { x: -0.9, z: 0.6, h: 1.4 },
    { x: 1.0, z: -0.5, h: 1.1 },
  ];

  for (const c of cacti) {
    const cactus = new THREE.Group();
    // Main trunk
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, c.h, 6), cactusMat);
    trunk.position.y = c.h / 2;
    trunk.castShadow = true;
    cactus.add(trunk);

    // Arm 1
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
  const geom = new THREE.CylinderGeometry(0.2, 0.2, len * 0.92, 8);
  const mesh = new THREE.Mesh(geom, mat);

  // Align cylinder along dir
  mesh.position.addVectors(p1, p2).multiplyScalar(0.5);
  mesh.position.y += 0.22; // Lift slightly above tile surface
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
