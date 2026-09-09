// CATAN-STYLE 3D ASSET PACK — HIGH FIDELITY PROCEDURAL VERSION
// ==============================================================
// Ported from the supplied catanReferencePack.js reference implementation to
// match the stylized board reference images:
// - warm beveled hex frames
// - rich miniature terrain (per-biome detail props)
// - cream inset number chips with red 6/8 ink and probability pips
// - chunky toy-like player pieces (roads, settlements, cities)
// - detailed wooden harbours with boats, sails, lamps, crates and trade signs
// - dark blue water with glossy wave rings
// - cinematic warm/cool lighting rig
//
import * as THREE from 'three';
import type { Terrain } from '@catan/shared';


/* ================================================================
   MATERIALS
   ================================================================ */

const C = {
  water: 0x063a5e,
  water2: 0x0b527c,
  foam: 0x8fc5d9,

  frame: 0xe6c994,
  frameEdge: 0x8d693d,
  frameDark: 0x5a4026,

  wheat: 0xdca42d,
  wheatHi: 0xffcf45,

  forest: 0x287445,
  forestDark: 0x114d2b,
  forestHi: 0x4a9b58,

  brick: 0xb65a32,
  brickHi: 0xd97945,

  ore: 0x59636d,
  oreHi: 0x89939b,

  sheep: 0x66a95e,
  sheepHi: 0x92c96c,

  desert: 0xd6b46e,
  desertHi: 0xe4c989,
  cactus: 0x398b4a,

  token: 0xf2e3c1,
  tokenEdge: 0x737674,
  tokenInk: 0x34424a,
  tokenHot: 0xd8393b,

  wood: 0x8a512b,
  woodHi: 0xc17a3b,
  woodDark: 0x4b2a17,

  metal: 0x777b78,
  red: 0xd92d2d,
  blue: 0x2364d2,
  orange: 0xe47720,
  white: 0xc9cdd1,

  black: 0x111315,
  lamp: 0xffb943,
} as const;

const cache = new Map<string, THREE.MeshStandardMaterial>();

function M(key: string, color: number, roughness = 0.72, metalness = 0): THREE.MeshStandardMaterial {
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    cache.set(key, m);
  }
  return m;
}

function mesh(g: THREE.Object3D, geo: THREE.BufferGeometry, material: THREE.Material, name = ''): THREE.Mesh {
  const m = new THREE.Mesh(geo, material);
  m.name = name;
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  return m;
}

function box(
  g: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  material: THREE.Material,
  p: readonly [number, number, number] = [0, 0, 0],
  name = '',
): THREE.Mesh {
  const m = mesh(g, new THREE.BoxGeometry(x, y, z), material, name);
  m.position.set(p[0], p[1], p[2]);
  return m;
}

function cyl(
  g: THREE.Object3D,
  r: number,
  h: number,
  material: THREE.Material,
  p: readonly [number, number, number] = [0, 0, 0],
  radial = 16,
  name = '',
): THREE.Mesh {
  const m = mesh(g, new THREE.CylinderGeometry(r, r, h, radial), material, name);
  m.position.set(p[0], p[1], p[2]);
  return m;
}

function sphere(
  g: THREE.Object3D,
  r: number,
  material: THREE.Material,
  p: readonly [number, number, number] = [0, 0, 0],
  name = '',
): THREE.Mesh {
  const m = mesh(g, new THREE.SphereGeometry(r, 16, 10), material, name);
  m.position.set(p[0], p[1], p[2]);
  return m;
}

function cone(
  g: THREE.Object3D,
  r: number,
  h: number,
  material: THREE.Material,
  p: readonly [number, number, number] = [0, 0, 0],
  radial = 7,
  name = '',
): THREE.Mesh {
  const m = mesh(g, new THREE.ConeGeometry(r, h, radial), material, name);
  m.position.set(p[0], p[1], p[2]);
  return m;
}

function group(name: string): THREE.Group {
  const g = new THREE.Group();
  g.name = name;
  return g;
}

/* ================================================================
   TEXT / TRADE SIGN TEXTURES (canvas sprites; no font assets)
   ================================================================ */

interface TextTextureOpts {
  width?: number;
  height?: number;
  font?: string;
  color?: string;
  sub?: string;
}

function textTexture(text: string, opts: TextTextureOpts = {}): THREE.CanvasTexture {
  const { width = 512, height = 256, font = 'bold 92px Arial', color = '#26333b', sub = '' } = opts;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  ctx.clearRect(0, 0, width, height);
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, width / 2, height / 2 - (sub ? 22 : 0));

  if (sub) {
    ctx.font = 'bold 45px Arial';
    ctx.fillText(sub, width / 2, height / 2 + 48);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function flatText(
  g: THREE.Object3D,
  text: string,
  size: number,
  position: readonly [number, number, number],
  rotation: readonly [number, number, number],
  opts: TextTextureOpts = {},
): THREE.Sprite {
  const material = new THREE.SpriteMaterial({
    map: textTexture(text, opts),
    transparent: true,
    depthWrite: false,
  });
  const s = new THREE.Sprite(material);
  s.position.set(position[0], position[1], position[2]);
  s.rotation.set(rotation[0], rotation[1], rotation[2]);
  s.scale.set(size, size * 0.5, 1);
  s.name = `text-${text}`;
  g.add(s);
  return s;
}

/* ================================================================
   HEX TILE
   ================================================================ */

function hexFrame(radius: number, depth = 0.26): THREE.Group {
  const g = group('hex-frame');

  mesh(g, new THREE.CylinderGeometry(radius, radius, depth, 6), M('frame', C.frame), 'beveled-hex-frame');

  // raised inner face
  const inner = mesh(
    g,
    new THREE.CylinderGeometry(radius * 0.905, radius * 0.905, depth * 0.82, 6),
    M('frame-inner', C.frameEdge),
    'inner-frame',
  );
  inner.position.y = depth * 0.2;

  const face = mesh(
    g,
    new THREE.CylinderGeometry(radius * 0.865, radius * 0.865, depth * 0.55, 6),
    M('terrain-face', C.frameDark),
    'terrain-face',
  );
  face.position.y = depth * 0.38;

  return g;
}

const TERRAIN_TO_PACK: Record<Terrain, 'wheat' | 'forest' | 'brick' | 'ore' | 'sheep' | 'desert'> = {
  fields: 'wheat',
  forest: 'forest',
  hills: 'brick',
  mountains: 'ore',
  pasture: 'sheep',
  desert: 'desert',
};

export function createTerrainTile(terrain: Terrain, radius = 2.0): THREE.Group {
  const type = TERRAIN_TO_PACK[terrain];
  const g = group(`Terrain_${type}`);
  g.add(hexFrame(radius));

  const face = new THREE.Group();
  face.position.y = 0.25;
  g.add(face);

  const terrainColor = {
    wheat: C.wheat,
    forest: C.forest,
    brick: C.brick,
    ore: C.ore,
    sheep: C.sheep,
    desert: C.desert,
  }[type];

  // Slightly smaller colored top plate.
  mesh(
    face,
    new THREE.CylinderGeometry(radius * 0.855, radius * 0.855, 0.035, 6),
    M(`terrain-${type}`, terrainColor),
    'terrain-surface',
  );

  switch (type) {
    case 'wheat':
      wheat(face, radius);
      break;
    case 'forest':
      forest(face, radius);
      break;
    case 'brick':
      bricks(face);
      break;
    case 'ore':
      ore(face, radius);
      break;
    case 'sheep':
      sheep(face, radius);
      break;
    case 'desert':
      desert(face, radius);
      break;
  }

  return g;
}

/* ---------------- terrain details ---------------- */

function wheat(g: THREE.Group, r: number): void {
  const stem = M('wheat-stem', C.wheatHi);
  const seed = M('wheat-seed', 0xf0b52e);

  for (let i = 0; i < 18; i++) {
    const a = i * 2.399;
    const rr = r * (0.4 + (i % 5) * 0.12);
    const x = Math.cos(a) * rr;
    const z = Math.sin(a) * rr;

    const s = box(g, 0.045, 0.28, 0.045, stem, [x, 0.17, z], 'wheat-stem');
    s.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.14;

    for (let j = 0; j < 3; j++) {
      const q = sphere(
        g,
        0.052,
        seed,
        [x + (j - 1) * 0.045, 0.28 + j * 0.035, z + (j % 2 === 0 ? 0.035 : -0.025)],
        'wheat-head',
      );
      q.scale.y = 1.25;
    }
  }
}

function forest(g: THREE.Group, r: number): void {
  const trunk = M('tree-trunk', 0x694126);
  const dark = M('tree-dark', C.forestDark);
  const hi = M('tree-hi', C.forestHi);

  for (let i = 0; i < 15; i++) {
    const a = i * 2.17;
    const rr = r * (0.4 + (i % 5) * 0.135);
    const x = Math.cos(a) * rr;
    const z = Math.sin(a) * rr;
    const scale = 0.72 + (i % 3) * 0.16;

    cyl(g, 0.055 * scale, 0.28 * scale, trunk, [x, 0.17 * scale, z], 7, 'tree-trunk');
    cone(g, 0.21 * scale, 0.42 * scale, dark, [x, 0.42 * scale, z], 7, 'tree-lower');
    cone(g, 0.15 * scale, 0.34 * scale, hi, [x, 0.62 * scale, z], 7, 'tree-upper');
  }
}

function bricks(g: THREE.Group): void {
  const brick = M('brick-hi', C.brickHi);
  const mortar = M('brick-mortar', 0x9b492b);

  // Pile offset to one side so the central token well stays clear.
  const ox = 0.95;
  const oz = -0.7;
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 4; i++) {
      const x = (i - 1.5) * 0.34 + (row % 2) * 0.17 + ox;
      const z = (row - 1) * 0.3 + oz;
      const b = box(g, 0.28, 0.13, 0.2, brick, [x, 0.11 + row * 0.075, z], 'brick');
      b.rotation.y = (i % 2) * 0.08;
    }
  }

  // A few darker loose bricks.
  box(g, 0.24, 0.11, 0.19, mortar, [0.95, 0.11, -0.55], 'loose-brick');
  box(g, 0.24, 0.11, 0.19, mortar, [-0.85, 0.11, 0.55], 'loose-brick');
}

function ore(g: THREE.Group, r: number): void {
  const rock = M('ore-hi', C.oreHi);
  const dark = M('ore-dark', C.ore);

  // Rocks offset from the centre so the token well stays clear.
  const ox = 1.15;
  const oz = 0.85;
  for (let i = 0; i < 11; i++) {
    const a = i * 2.47;
    const rr = r * (0.05 + (i % 4) * 0.11);
    const m = mesh(
      g,
      new THREE.DodecahedronGeometry(0.17 + (i % 3) * 0.04, 0),
      i % 2 === 0 ? rock : dark,
      'ore-rock',
    );
    m.position.set(Math.cos(a) * rr + ox, 0.17, Math.sin(a) * rr + oz);
    m.rotation.set(i * 0.3, i * 0.7, i * 0.2);
    m.scale.y = 0.7;
  }
}

function sheep(g: THREE.Group, r: number): void {
  const wool = M('wool', 0xf0eee4);
  const head = M('sheep-head', 0x3b3a37);
  const grass = M('grass', 0x3d914d);

  for (let i = 0; i < 6; i++) {
    const a = i * 2.12;
    const rr = r * (0.4 + (i % 3) * 0.18);
    const x = Math.cos(a) * rr;
    const z = Math.sin(a) * rr;

    sphere(g, 0.17, wool, [x, 0.2, z], 'sheep-body');
    sphere(g, 0.085, wool, [x - 0.07, 0.27, z + 0.02]);
    sphere(g, 0.1, head, [x + 0.13, 0.24, z], 'sheep-head');
    sphere(g, 0.018, M('eye', 0xffffff), [x + 0.2, 0.27, z - 0.035], 'eye');

    // tiny grass tufts
    if (i < 3) {
      for (let k =  0; k < 3; k++) {
        box(g, 0.018, 0.11, 0.018, grass, [x + k * 0.05, 0.07, z + 0.04]);
      }
    }
  }
}

function desert(g: THREE.Group, r: number): void {
  const sand = M('desert-hi', C.desertHi);
  const cactus = M('cactus', C.cactus);

  for (let i = 0; i < 10; i++) {
    const a = i * 1.83;
    const rr = r * (0.32 + (i % 4) * 0.14);
    const d = mesh(g, new THREE.SphereGeometry(0.24, 12, 6, 0, Math.PI), sand, 'sand-dune');
    d.position.set(Math.cos(a) * rr, 0.055, Math.sin(a) * rr);
    d.scale.set(1.5, 0.35, 0.7);
  }

  for (const [x, z] of [
    [0.95, -0.6],
    [-0.9, 0.55],
  ] as const) {
    cyl(g, 0.055, 0.42, cactus, [x, 0.26, z], 8, 'cactus');
    box(g, 0.18, 0.055, 0.055, cactus, [x - 0.07, 0.31, z], 'cactus-arm');
  }
}

/* ================================================================
   NUMBER TOKEN — cream wood chip; number + probability pips drawn
   into a single canvas face sprite (red ink for 6/8).
   ================================================================ */

const tokenFaceCache = new Map<string, THREE.MeshBasicMaterial>();

/** Flat canvas plane: number over a row of probability pips (red ink 6/8). */
function tokenFacePlane(number: number, radius: number): THREE.Mesh {
  const hot = number === 6 || number === 8;
  const key = `${number}:${radius}`;
  let material = tokenFaceCache.get(key);
  if (!material) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');

    ctx.clearRect(0, 0, 256, 256);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // number (upper half)
    ctx.font = 'bold 132px Arial';
    ctx.fillStyle = hot ? '#d8393b' : '#34424a';
    ctx.fillText(String(number), 128, 92);

    // probability pips (row below the number): ways to roll / 36
    const PIP_COUNT: Record<number, number> = {
      2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1,
    };
    const pips = PIP_COUNT[number] ?? 0;
    const spacing = 26;
    const x0 = 128 - ((pips - 1) * spacing) / 2;
    ctx.fillStyle = hot ? '#d8393b' : '#34424a';
    for (let i = 0; i < pips; i++) {
      ctx.beginPath();
      ctx.arc(x0 + i * spacing, 180, 9, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    material = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
    tokenFaceCache.set(key, material);
  }

  const s = new THREE.Mesh(new THREE.PlaneGeometry(radius * 1.85, radius * 1.85), material);
  s.rotation.x = -Math.PI / 2;
  s.name = `token-face-${number}`;
  return s;
}
export function createNumberToken(number = 6, radius = 0.35): THREE.Group {
  const g = group(`NumberToken_${number}`);

  cyl(g, radius, 0.075, M('token', C.token, 0.58), [0, 0.05, 0], 32, 'token-body');
  cyl(g, radius * 0.91, 0.02, M('token-inset2', 0xe7d8b8, 0.48), [0, 0.091, 0], 32, 'token-inset');
  const face = tokenFacePlane(number, radius);
  face.position.y = 0.115;
  g.add(face);

  return g;
}

/* ================================================================
   ROBBER
   ================================================================ */

export function createRobber(scale = 1): THREE.Group {
  const g = group('Robber');
  g.scale.setScalar(scale);

  cyl(g, 0.39, 0.13, M('robber-sand', 0xb99859), [0, 0.065, 0], 12, 'sand-base');
  cyl(g, 0.18, 0.3, M('robber-black', C.black, 0.38), [0, 0.28, 0], 16, 'torso');
  sphere(g, 0.19, M('robber-black', C.black, 0.38), [0, 0.47, 0], 'body');
  sphere(g, 0.145, M('robber-black', C.black, 0.38), [0, 0.68, 0], 'head');

  // shoulder cape
  const cape = mesh(g, new THREE.ConeGeometry(0.23, 0.27, 6), M('robber-cape', 0x1d2024, 0.65), 'cape');
  cape.position.set(0, 0.43, 0);
  cape.rotation.x = Math.PI;

  return g;
}

/* ================================================================
   PLAYER ROADS
   ================================================================ */

const PLAYER_COLOR: Record<string, number> = {
  red: C.red,
  blue: C.blue,
  orange: C.orange,
  white: C.white,
};

/** Chunky rectangular road with bevel cap, lying along +Z from origin. */
export function createRoad(color = 'red', length = 1.0): THREE.Group {
  const g = group(`Road_${color}`);
  const m = M(`player-${color}`, PLAYER_COLOR[color] ?? C.red, 0.48);

  const r = mesh(g, new THREE.BoxGeometry(length, 0.14, 0.17), m, 'road');
  r.position.y = 0.07;

  box(g, length * 0.86, 0.035, 0.115, m, [0, 0.155, 0], 'road-cap');
  return g;
}

/* ================================================================
   SETTLEMENT
   ================================================================ */

export function createSettlement(color = 'red', scale = 1): THREE.Group {
  const g = group(`Settlement_${color}`);
  g.scale.setScalar(scale);
  const m = M(`player-${color}`, PLAYER_COLOR[color] ?? C.red, 0.45);

  box(g, 0.44, 0.3, 0.36, m, [0, 0.15, 0], 'house');
  const roof = cone(g, 0.3, 0.3, m, [0, 0.44, 0], 4, 'roof');
  roof.rotation.y = Math.PI / 4;

  box(g, 0.075, 0.17, 0.075, m, [0.14, 0.53, 0.02], 'chimney');

  box(g, 0.09, 0.15, 0.015, M(`door-${color}`, 0x33271f), [0, -0.01, 0.19], 'door');
  return g;
}

/* ================================================================
   CITY
   ================================================================ */

export function createCity(color = 'red', scale = 1): THREE.Group {
  const g = group(`City_${color}`);
  g.scale.setScalar(scale);
  const m = M(`player-${color}`, PLAYER_COLOR[color] ?? C.red, 0.45);

  box(g, 0.55, 0.36, 0.42, m, [0, 0.18, 0], 'city-body');

  for (const x of [-0.19, 0.19]) {
    box(g, 0.17, 0.31, 0.39, m, [x, 0.515, 0], 'city-tower');
    const roof = cone(g, 0.14, 0.16, m, [x, 0.75, 0], 4, 'tower-roof');
    roof.rotation.y = Math.PI / 4;
  }

  box(g, 0.11, 0.17, 0.02, M(`door-city-${color}`, 0x33271f), [0, 0.085, 0.22], 'city-door');
  return g;
}

/* ================================================================
   BOARD NODES
   ================================================================ */

export function createNode(type: 'standard' | 'port' = 'standard'): THREE.Group {
  const g = group(`Node_${type}`);

  cyl(g, 0.25, 0.105, M('node-cream', C.token), [0, 0.052, 0], 18, 'node');
  cyl(g, 0.19, 0.018, M('node-inner', 0xe1d2b5), [0, 0.112, 0], 18, 'node-inner');

  if (type === 'port') {
    box(g, 0.48, 0.075, 0.15, M('dock', C.woodHi), [0.27, 0.04, 0], 'dock-plank');
    box(g, 0.15,  0.075, 0.15, M('dock-dark', C.woodDark), [-0.24, 0.04, 0], 'dock-plank');
  }

  return g;
}

/* ================================================================
   HARBOUR SYSTEM
   ================================================================ */

const PORT_SAIL: Record<string, number> = {
  wheat: 0xe0a62d,
  wood: 0x5b9a61,
  brick: 0xc95b3d,
  ore: 0x697583,
  sheep: 0xe9ddc6,
  generic: 0x2d79bd,
};

export function createHarbour(resource: string | undefined, scale = 1): THREE.Group {
  const specKey = resource ?? 'generic';
  const g = group(`Harbour_${specKey}`);
  g.scale.setScalar(scale);

  createHarbourDeck(g);
  createHarbourPosts(g);
  createHarbourBoat(g, PORT_SAIL[specKey] ?? PORT_SAIL.generic!);
  createTradeSign(g, resource);
  createHarbourProps(g);

  return g;
}

function createHarbourDeck(g: THREE.Group): void {
  const deck = M('dock-wood', C.wood, 0.72);
  const deckHi = M('dock-hi', C.woodHi, 0.68);
  const dark = M('dock-dark', C.woodDark);

  // layered floating pier
  box(g, 1.55, 0.14, 0.78, deck, [0, 0.07, 0], 'pier');
  box(g, 1.28, 0.1, 0.57, deckHi, [0, 0.17, 0], 'pier-inner');

  // individual plank strips
  for (let i = -4; i <= 4; i++) {
    box(g, 0.055, 0.018, 0.55, dark, [i * 0.15, 0.225, 0], 'deck-plank-line');
  }

  // front bumper
  box(g, 1.42, 0.1, 0.1, dark, [0, 0.19, 0.39], 'front-bumper');
}

function createHarbourPosts(g: THREE.Group): void {
  const dark = M('dock-dark', C.woodDark);
  const hi = M('dock-hi', C.woodHi);

  for (const x of [-0.65, 0.65]) {
    for (const z of [-0.32, 0.32]) {
      cyl(g, 0.075, 0.62, dark, [x, 0.31, z], 10, 'mooring-post');
      cyl(g, 0.1, 0.06, hi, [x, 0.62, z], 10, 'post-cap');

      // rope collar
      const ring = mesh(g, new THREE.TorusGeometry(0.08, 0.012, 6, 12), M('rope', 0x9a7041), 'rope-collar');
      ring.position.set(x, 0.4, z);
      ring.rotation.x = Math.PI / 2;
    }
  }
}

function createHarbourBoat(g: THREE.Group, sailColor: number): void {
  const boat = createBoat(sailColor, 0.78);
  // moored in the water on the seaward (local +X) side of the pier
  boat.position.set(1.05, -0.08, -0.62);
  boat.rotation.y = 0.35;
  g.add(boat);
}

export function createBoat(sailColor = 0x2d79bd, scale = 1): THREE.Group {
  const g = group('Boat');
  g.scale.setScalar(scale);

  // stylized pointed hull
  const shape = new THREE.Shape();
  shape.moveTo(-0.62, 0);
  shape.lineTo(-0.42, -0.2);
  shape.lineTo(0.38, -0.2);
  shape.lineTo(0.62, 0);
  shape.lineTo(0.38, 0.13);
  shape.lineTo(-0.4, 0.13);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.22,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.035,
    bevelThickness: 0.035,
  });

  const hull = mesh(g, geo, M('boat-hull', C.woodDark), 'hull');
  hull.rotation.x = Math.PI / 2;
  hull.position.y = 0.11;

  // lighter top rim
  box(g, 0.78, 0.045, 0.035, M('boat-rim', C.woodHi), [0, 0.22, 0], 'gunwale');

  // mast
  cyl(g, 0.032, 0.92, M('mast', C.woodHi), [-0.02, 0.63, 0], 8, 'mast');

  // triangular sail (vertical, double-sided)
  const sailShape = new THREE.Shape();
  sailShape.moveTo(0, 0);
  sailShape.lineTo(0, 0.7);
  sailShape.lineTo(0.46, 0.13);
  sailShape.closePath();

  // solid triangular-prism sail — reads from any camera bearing
  const sailGeo = new THREE.ExtrudeGeometry(sailShape, { depth: 0.4, bevelEnabled: false });
  const sailMat = new THREE.MeshStandardMaterial({ color: sailColor, roughness: 0.85, side: THREE.DoubleSide });
  const sail = mesh(g, sailGeo, sailMat, 'sail');
  sail.position.set(-0.18, 0.29, -0.02);
  sail.rotation.y = Math.PI;

  // rope boom
  box(g, 0.52, 0.018, 0.018, M('rope', 0xc1a77c), [0.23, 0.34, 0], 'boom');
  return g;
}

function createTradeSign(g: THREE.Group, resource: string | undefined): void {
  const type = resource ?? 'generic';
  const trade = type === 'generic' ? '3:1' : '2:1';
  const sign = group('TradeSign');

  // post
  cyl(sign, 0.045, 0.48, M('sign-post', C.woodDark), [0, 0.55, 0.05], 8, 'sign-post');

  // thick round wooden medallion
  cyl(sign, 0.31, 0.075, M('trade-sign-edge', C.woodHi), [0, 0.85, 0.05], 32, 'sign-edge');
  cyl(sign, 0.285, 0.04, M('trade-sign-face', C.token), [0, 0.895, 0.05], 32, 'sign-face');

  flatText(sign, trade, 0.48, [0, 0.93, 0.075], [-Math.PI / 2, 0, 0], {
    width: 256,
    height: 128,
    font: 'bold 78px Arial',
    color: '#25333b',
  });

  flatText(sign, type === 'generic' ? 'ANY' : (RESOURCE_ICON[type] ?? RESOURCE_ICON.generic!), 0.28, [0, 0.76, 0.08], [-Math.PI / 2, 0, 0], {
    width: 256,
    height: 128,
    font: 'bold 48px Arial',
    color: '#4a5a60',
  });

  g.add(sign);
}

const RESOURCE_ICON: Record<string, string> = {
  wheat: '🌾',
  wood: '🪵',
  brick: '▰',
  ore: '◆',
  sheep: '🐑',
  generic: '⚓',
};

function createHarbourProps(g: THREE.Group): void {
  const crate = createCrate(0.65);
  crate.position.set(-0.42, 0.27, 0.16);
  crate.rotation.y = -0.18;
  g.add(crate);

  const barrel = createBarrel(0.68);
  barrel.position.set(0.42, 0.28, 0.16);
  g.add(barrel);

  for (const x of [-0.55, 0.55]) {
    const lamp = createLantern(0.62);
    lamp.position.set(x, 0.68, 0.2);
    g.add(lamp);
  }
}

/* ================================================================
   LANTERN / CRATE / BARREL
   ================================================================ */

export function createLantern(scale = 1): THREE.Group {
  const g = group('Lantern');
  g.scale.setScalar(scale);

  const brass = M('brass', 0xb8883d, 0.32, 0.35);
  const glow = M('lamp-glow', C.lamp, 0.24);

  cyl(g, 0.1, 0.055, brass, [0, 0.03, 0], 10, 'base');
  box(g, 0.13, 0.2, 0.13, brass, [0, 0.15, 0], 'frame');
  sphere(g, 0.052, glow, [0, 0.15, 0], 'glow');
  cyl(g, 0.05, 0.035, brass, [0, 0.27, 0], 10, 'cap');

  return g;
}

export function createCrate(scale = 1): THREE.Group {
  const g = group('Crate');
  g.scale.setScalar(scale);
  const wood = M('crate-wood', C.woodHi);
  const slat = M('crate-slat', C.woodDark);

  box(g, 0.34, 0.34, 0.34, wood, [0, 0.17, 0], 'body');
  for (const z of [-0.175, 0.175]) box(g, 0.37, 0.045, 0.045, slat, [0, 0.17, z], 'slat');
  for (const x of [-0.175, 0.175]) box(g, 0.045, 0.045, 0.37, slat, [x, 0.17, 0], 'slat');
  return g;
}

export function createBarrel(scale = 1): THREE.Group {
  const g = group('Barrel');
  g.scale.setScalar(scale);

  cyl(g, 0.17, 0.31, M('barrel-body', C.wood), [0, 0.155, 0], 18, 'body');

  for (const y of [0.065, 0.245]) {
    const ring = mesh(g, new THREE.TorusGeometry(0.175, 0.018, 6, 18), M('barrel-band', C.woodDark), 'band');
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
  }

  return g;
}

/* ================================================================
   WATER
   ================================================================ */

export function createWaterTile(radius = 2.25): THREE.Group {
  const g = group('WaterTile');

  // no opaque disc: only ripple rings live on the open water

  const waveMat = M('wave', C.water2, 0.22);

  // rings distributed in the open water outside the island footprint
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + 0.35;
    const rr = radius * (0.68 + (i % 5) * 0.065);
    const w = mesh(g, new THREE.TorusGeometry(0.16, 0.014, 5, 12), waveMat, 'wave');
    w.rotation.x = Math.PI / 2;
    w.position.set(Math.cos(a) * rr, 0.025, Math.sin(a) * rr);
    w.scale.x = 1.8;
  }

  return g;
}
/* ================================================================
   DICE
   ================================================================ */

export function createDie(color = 0xe9d9b5, size = 0.38): THREE.Group {
  const g = group('Die');
  const m = M(`die-${color}`, color, 0.48);

  mesh(g, new THREE.BoxGeometry(size, size, size), m, 'die');

  // Rounded-looking corner caps
  for (const x of [-1, 1]) {
    for (const y of [-1, 1]) {
      for (const z of [-1, 1]) {
        sphere(g, size * 0.055, m, [x * size * 0.47, y * size * 0.47, z * size * 0.47], 'corner');
      }
    }
  }

  return g;
}

/* ================================================================
   CINEMATIC LIGHTING / RENDER SETTINGS
   ================================================================ */

export function setupReferenceLighting(scene: THREE.Scene, renderer: THREE.WebGLRenderer): void {
  scene.background = new THREE.Color(0x031b2d);

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  const hemi = new THREE.HemisphereLight(0xbad8f3, 0x061522, 1.35);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffdfb1, 3.4);
  key.position.set(8, 13, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -15;
  key.shadow.camera.right = 15;
  key.shadow.camera.top = 15;
  key.shadow.camera.bottom = -15;
  scene.add(key);

  const cool = new THREE.DirectionalLight(0x65b7ed, 1.0);
  cool.position.set(-9, 7, -6);
  scene.add(cool);

  const rim = new THREE.PointLight(0x2b82b5, 0.8, 18);
  rim.position.set(-3, 4, -5);
  scene.add(rim);
}
