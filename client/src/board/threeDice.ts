// Real 3D dice and rolling tray for Three.js Catan.
// Features: 6-face procedural pip textures, target Euler rotations for values 1-6,
// shadow-casting rounded cube dice, and an octagonal wooden tray with green felt.

import * as THREE from 'three';

// ---------------------------------------------------------------------------
// 6 Face Textures for Die
// Standard dice: opposite faces sum to 7!
// Face 0: +X (1)
// Face 1: -X (6)
// Face 2: +Y (2)
// Face 3: -Y (5)
// Face 4: +Z (3)
// Face 5: -Z (4)
// ---------------------------------------------------------------------------

let cachedDieMaterials: THREE.MeshStandardMaterial[] | null = null;

function createFaceCanvas(value: number): HTMLCanvasElement {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable');

  // Bone ivory background with soft corner gradient
  ctx.fillStyle = '#fefdf9';
  ctx.fillRect(0, 0, size, size);

  // Soft border shadow / bevel
  ctx.strokeStyle = '#d6d3cb';
  ctx.lineWidth = 14;
  ctx.strokeRect(7, 7, size - 14, size - 14);

  // Pips layout
  const isRedOne = value === 1;
  ctx.fillStyle = isRedOne ? '#dc2626' : '#1e293b';

  const drawPip = (cx: number, cy: number, r = 18) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    // Inner bevel
    ctx.strokeStyle = isRedOne ? 'rgba(153,27,27,0.4)' : 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 3;
    ctx.stroke();
  };

  const mid = size / 2;
  const cLow = size * 0.28;
  const cHigh = size * 0.72;

  switch (value) {
    case 1:
      drawPip(mid, mid, 26);
      break;
    case 2:
      drawPip(cLow, cLow);
      drawPip(cHigh, cHigh);
      break;
    case 3:
      drawPip(cLow, cLow);
      drawPip(mid, mid);
      drawPip(cHigh, cHigh);
      break;
    case 4:
      drawPip(cLow, cLow);
      drawPip(cHigh, cLow);
      drawPip(cLow, cHigh);
      drawPip(cHigh, cHigh);
      break;
    case 5:
      drawPip(cLow, cLow);
      drawPip(cHigh, cLow);
      drawPip(mid, mid);
      drawPip(cLow, cHigh);
      drawPip(cHigh, cHigh);
      break;
    case 6:
      drawPip(cLow, cLow);
      drawPip(cHigh, cLow);
      drawPip(cLow, mid);
      drawPip(cHigh, mid);
      drawPip(cLow, cHigh);
      drawPip(cHigh, cHigh);
      break;
  }

  return canvas;
}

export function getDieMaterials(): THREE.MeshStandardMaterial[] {
  if (cachedDieMaterials) return cachedDieMaterials;

  // Values matching the 6 cube face directions: [+X, -X, +Y, -Y, +Z, -Z]
  const faceValues = [1, 6, 2, 5, 3, 4];
  cachedDieMaterials = faceValues.map((val) => {
    const canvas = createFaceCanvas(val);
    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 4;
    return new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.25,
      metalness: 0.05,
    });
  });
  return cachedDieMaterials;
}

/** Returns the Euler rotation required for the given die value (1-6) to face UP (+Y). */
export function getDieTargetRotation(value: number): THREE.Euler {
  switch (value) {
    case 1:
      // +X is 1 -> rotate Z by +90 deg
      return new THREE.Euler(0, 0, Math.PI / 2);
    case 6:
      // -X is 6 -> rotate Z by -90 deg
      return new THREE.Euler(0, 0, -Math.PI / 2);
    case 2:
      // +Y is 2 -> already facing up
      return new THREE.Euler(0, 0, 0);
    case 5:
      // -Y is 5 -> rotate X by 180 deg
      return new THREE.Euler(Math.PI, 0, 0);
    case 3:
      // +Z is 3 -> rotate X by -90 deg
      return new THREE.Euler(-Math.PI / 2, 0, 0);
    case 4:
      // -Z is 4 -> rotate X by +90 deg
      return new THREE.Euler(Math.PI / 2, 0, 0);
    default:
      return new THREE.Euler(0, 0, 0);
  }
}

/** Creates a 3D die cube with shadow casting. */
export function createDieMesh(size = 1.3): THREE.Mesh {
  const geom = new THREE.BoxGeometry(size, size, size);
  const mats = getDieMaterials();
  const mesh = new THREE.Mesh(geom, mats);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Creates an octagonal wooden dice tray with green velvet felt bottom. */
export function createDiceTrayMesh(): THREE.Group {
  const group = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x5c3a21,
    roughness: 0.7,
  });
  const feltMat = new THREE.MeshStandardMaterial({
    color: 0x064e3b, // Rich emerald green velvet felt
    roughness: 0.9,
  });

  // Felt bottom
  const felt = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 0.2, 8), feltMat);
  felt.position.y = 0.1;
  felt.receiveShadow = true;
  group.add(felt);

  // Outer wooden rim
  const outerRim = new THREE.Mesh(new THREE.CylinderGeometry(4.0, 4.0, 0.7, 8), woodMat);
  outerRim.position.y = 0.35;
  outerRim.castShadow = true;
  group.add(outerRim);

  return group;
}
