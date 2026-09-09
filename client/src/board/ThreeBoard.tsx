// Full 3D WebGL Board for Catan matching the official 3D Asset Reference Sheet.
// Features:
// - All hexes aligned with horizontal top/bottom edges via toBoard3D.
// - Standard circular wooden nodes at every vertex (ivory top face, dark walnut bevel).
// - Cream birch road slots with dark walnut grooves along all edges.
// - Solid single-color wooden player pieces (cottages, stepped castle cities, flat road bars).
// - 3D Harbour ports with dual angled bridge piers, dock lanterns, color-coded sailboats, and trade medallions.
// - Robber on textured sandy crater base.
// - Deep royal blue ocean water with smooth OrbitControls camera.

import { memo, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { PersonalSnapshot } from '../types';
import { hexToPixel, parseHexId, PIPS } from '@catan/shared';
import {
  createCityMesh,
  createDesertProps,
  createFieldsProps,
  createForestProps,
  createHarborPortMesh,
  createHillsProps,
  createMountainProps,
  createOceanBase,
  createPastureProps,
  createRoadMesh,
  createRobberMesh,
  createSettlementMesh,
  getNumberTokenTexture,
  HEX_BASE_RADIUS,
  HEX_HEIGHT,
  HEX_RADIUS,
  PLAYER_3D_COLORS,
  TERRAIN_COLORS,
  toBoard3D,
} from './threeUtils';

export interface ThreeBoardProps {
  snap: PersonalSnapshot;
  legalVertices?: Set<number>;
  legalEdges?: Set<string>;
  legalHexes?: Set<string>;
  pulseHexes?: Set<string>;
  rolling?: boolean;
  onVertexClick?: (vertex: number) => void;
  onEdgeClick?: (edge: string) => void;
  onHexClick?: (hex: string) => void;
}

export const ThreeBoard = memo(function ThreeBoard({
  snap,
  legalVertices,
  legalEdges,
  legalHexes,
  rolling,
  onVertexClick,
  onEdgeClick,
  onHexClick,
}: ThreeBoardProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cameraMode, setCameraMode] = useState<'3d' | 'top'>('3d');

  const propsRef = useRef({
    snap,
    legalVertices,
    legalEdges,
    legalHexes,
    rolling,
    onVertexClick,
    onEdgeClick,
    onHexClick,
  });
  propsRef.current = {
    snap,
    legalVertices,
    legalEdges,
    legalHexes,
    rolling,
    onVertexClick,
    onEdgeClick,
    onHexClick,
  };

  const rebuildBoardRef = useRef<((s: PersonalSnapshot) => void) | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Scene & Renderer setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#071828');
    scene.fog = new THREE.FogExp2('#071828', 0.0035);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.5, 800);
    camera.position.set(0, 36, 32);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      logarithmicDepthBuffer: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    // 2. Orbit Camera Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 8;
    controls.maxDistance = 180;
    controls.minPolarAngle = Math.PI / 10;
    controls.maxPolarAngle = Math.PI / 2.25;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    // 3. Lighting
    const ambientLight = new THREE.AmbientLight(0xfff8ee, 1.25);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfff5e6, 2.4);
    sunLight.position.set(24, 45, 18);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 5;
    sunLight.shadow.camera.far = 140;
    sunLight.shadow.camera.left = -28;
    sunLight.shadow.camera.right = 28;
    sunLight.shadow.camera.top = 28;
    sunLight.shadow.camera.bottom = -28;
    sunLight.shadow.bias = -0.0003;
    scene.add(sunLight);

    const oceanLight = new THREE.DirectionalLight(0x38bdf8, 0.45);
    oceanLight.position.set(-20, -10, -20);
    scene.add(oceanLight);

    // 4. Board Container
    const boardGroup = new THREE.Group();
    scene.add(boardGroup);

    // Hit targets map for raycasting
    const hitMeshes: Array<{
      mesh: THREE.Object3D;
      kind: 'vertex' | 'edge' | 'hex' | 'builtBuilding' | 'builtRoad';
      id: number | string;
    }> = [];

    // Reusable Materials matching 3D Asset Reference Sheet
    const hexWoodSideMat = new THREE.MeshStandardMaterial({
      color: 0x26150b, // Dark walnut wood base
      roughness: 0.85,
    });
    const hexRimMat = new THREE.MeshStandardMaterial({
      color: 0xded2ba, // Light-wood / cream beveled rim
      roughness: 0.65,
    });

    const trailBorderMat = new THREE.MeshStandardMaterial({
      color: 0x26150b, // Dark walnut outer slot groove
      roughness: 0.85,
      flatShading: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const unbuiltTrailMat = new THREE.MeshStandardMaterial({
      color: 0xe2d9c8, // Cream birch road slot
      roughness: 0.7,
      flatShading: true,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const legalTrailMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xca8a04,
      emissiveIntensity: 0.5,
      roughness: 0.4,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });

    const unbuiltNodeMat = new THREE.MeshStandardMaterial({
      color: 0xe2d9c8, // Cream birch Standard Node top face
      roughness: 0.7,
      flatShading: true,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    const legalNodeMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xca8a04,
      emissiveIntensity: 0.5,
      roughness: 0.4,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });

    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.85 });
    const beaconRingMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
    const roadGhostMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.85,
      roughness: 0.3,
    });
    const hexHighlightMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
    });

    function rebuildBoard(currentSnap: PersonalSnapshot): void {
      while (boardGroup.children.length > 0) {
        const obj = boardGroup.children[0]!;
        boardGroup.remove(obj);
      }
      hitMeshes.length = 0;

      const { board, buildings, roads, robber, players } = currentSnap;
      const playerColorMap = new Map<number, string>();
      for (const p of players) playerColorMap.set(p.seat, p.color);

      // --- A. Hexes, Biome Props, and Number Tokens ---
      for (const [hexId, hexData] of Object.entries(board.hexes)) {
        const { q, r } = parseHexId(hexId);
        const center2d = hexToPixel(q, r);
        const center3d = toBoard3D(center2d.x, center2d.y);

        const hexObj = new THREE.Group();
        hexObj.position.set(center3d.x, 0, center3d.z);

        // Outer wooden frame chassis
        const hexGeom = new THREE.CylinderGeometry(HEX_RADIUS, HEX_BASE_RADIUS, HEX_HEIGHT, 6);
        const slab = new THREE.Mesh(hexGeom, [hexWoodSideMat, hexRimMat, hexWoodSideMat]);
        slab.rotation.y = 0; // Flat horizontal edges matching reference sheet!
        slab.position.y = HEX_HEIGHT / 2;
        slab.receiveShadow = true;
        slab.castShadow = true;
        hexObj.add(slab);

        // Recessed inner terrain slab
        const col = TERRAIN_COLORS[hexData.terrain];
        const terrainMat = new THREE.MeshStandardMaterial({
          color: col.top,
          roughness: col.rough,
          flatShading: true,
        });
        const innerTerrainGeom = new THREE.CylinderGeometry(HEX_RADIUS * 0.94, HEX_RADIUS * 0.94, HEX_HEIGHT + 0.04, 6);
        const innerSlab = new THREE.Mesh(innerTerrainGeom, [hexWoodSideMat, terrainMat, hexWoodSideMat]);
        innerSlab.rotation.y = 0;
        innerSlab.position.y = HEX_HEIGHT / 2;
        innerSlab.receiveShadow = true;
        hexObj.add(innerSlab);

        // Biome props
        let props: THREE.Group | null = null;
        if (hexData.terrain === 'forest') props = createForestProps();
        else if (hexData.terrain === 'mountains') props = createMountainProps();
        else if (hexData.terrain === 'pasture') props = createPastureProps();
        else if (hexData.terrain === 'fields') props = createFieldsProps();
        else if (hexData.terrain === 'hills') props = createHillsProps();
        else if (hexData.terrain === 'desert') props = createDesertProps();

        if (props) {
          props.position.y = HEX_HEIGHT;
          hexObj.add(props);
        }

        // Recessed circular token well bezel in the tile top
        if (hexData.token !== null) {
          const wellRingGeom = new THREE.RingGeometry(1.68, 1.95, 32);
          const wellRingMat = new THREE.MeshStandardMaterial({ color: 0x26150b, roughness: 0.85 });
          const wellRing = new THREE.Mesh(wellRingGeom, wellRingMat);
          wellRing.rotation.x = -Math.PI / 2;
          wellRing.position.y = HEX_HEIGHT + 0.02;
          hexObj.add(wellRing);

          // Number token sitting flush inside the well
          const pips = PIPS[hexData.token] ?? 0;
          const tokenTex = getNumberTokenTexture(hexData.token, pips);
          const tokenTopMat = new THREE.MeshBasicMaterial({ map: tokenTex });
          const tokenSideMat = new THREE.MeshStandardMaterial({ color: 0x26150b, roughness: 0.8 });
          const tokenGeom = new THREE.CylinderGeometry(1.68, 1.68, 0.20, 32);
          const tokenMesh = new THREE.Mesh(tokenGeom, [tokenSideMat, tokenTopMat, tokenSideMat]);
          tokenMesh.position.y = HEX_HEIGHT + 0.10;
          tokenMesh.castShadow = true;
          hexObj.add(tokenMesh);
        }

        // Raycast hit target for hex selection
        const hitGeom = new THREE.CylinderGeometry(HEX_RADIUS * 0.9, HEX_RADIUS * 0.9, 0.4, 6);
        const hitMat = new THREE.MeshBasicMaterial({ visible: false });
        const hexHit = new THREE.Mesh(hitGeom, hitMat);
        hexHit.position.y = HEX_HEIGHT + 0.2;
        hexObj.add(hexHit);
        hitMeshes.push({ mesh: hexHit, kind: 'hex', id: hexId });

        // Highlight ring if legal hex
        if (propsRef.current.legalHexes?.has(hexId)) {
          const ringGeom = new THREE.RingGeometry(HEX_RADIUS * 0.3, HEX_RADIUS * 0.96, 6);
          const ring = new THREE.Mesh(ringGeom, hexHighlightMat);
          ring.rotation.x = -Math.PI / 2;
          ring.position.y = HEX_HEIGHT + 0.18;
          hexObj.add(ring);
        }

        boardGroup.add(hexObj);
      }

      // --- B. 3D Harbour Ports with Dual Angled Bridge Piers (Matching Reference Sheet) ---
      const bridgeMat = new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.8 });

      for (const [eid, harbor] of Object.entries(board.harbors)) {
        const endpoints = board.topology.edgeEndpoints[eid];
        if (!endpoints) continue;
        const [a, b] = endpoints;
        const pa = board.topology.vertexPos[a];
        const pb = board.topology.vertexPos[b];
        if (!pa || !pb) continue;

        const p1_3d = toBoard3D(pa.x, pa.y);
        const p2_3d = toBoard3D(pb.x, pb.y);
        const p1 = new THREE.Vector3(p1_3d.x, HEX_HEIGHT, p1_3d.z);
        const p2 = new THREE.Vector3(p2_3d.x, HEX_HEIGHT, p2_3d.z);
        const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
        const dirFromCenter = new THREE.Vector3(mid.x, 0, mid.z).normalize();
        const harborCenter = new THREE.Vector3().addVectors(mid, dirFromCenter.clone().multiplyScalar(2.6));

        // Dual angled wooden bridge piers extending from vertex A and vertex B to harborCenter
        const dir1 = new THREE.Vector3().subVectors(harborCenter, p1);
        const len1 = dir1.length();
        const pier1 = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.22, len1 * 0.95), bridgeMat);
        pier1.position.addVectors(p1, harborCenter).multiplyScalar(0.5);
        pier1.position.y = HEX_HEIGHT + 0.04;
        pier1.rotation.set(0, Math.atan2(dir1.x, dir1.z), 0);
        pier1.castShadow = true;
        boardGroup.add(pier1);

        const dir2 = new THREE.Vector3().subVectors(harborCenter, p2);
        const len2 = dir2.length();
        const pier2 = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.22, len2 * 0.95), bridgeMat);
        pier2.position.addVectors(p2, harborCenter).multiplyScalar(0.5);
        pier2.position.y = HEX_HEIGHT + 0.04;
        pier2.rotation.set(0, Math.atan2(dir2.x, dir2.z), 0);
        pier2.castShadow = true;
        boardGroup.add(pier2);

        // Circular Harbor Disc and Moored Boat at harborCenter
        const port = createHarborPortMesh(harbor);
        port.position.copy(harborCenter);
        port.position.y = HEX_HEIGHT + 0.04;
        port.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dirFromCenter);
        boardGroup.add(port);
      }

      // --- C. Road Tracks Along All Edges (Dark Walnut Border + Cream Birch Slot) ---
      for (const [eid, endpoints] of Object.entries(board.topology.edgeEndpoints)) {
        const [a, b] = endpoints;
        const pa = board.topology.vertexPos[a];
        const pb = board.topology.vertexPos[b];
        if (!pa || !pb) continue;

        const p1_3d = toBoard3D(pa.x, pa.y);
        const p2_3d = toBoard3D(pb.x, pb.y);
        const p1 = new THREE.Vector3(p1_3d.x, HEX_HEIGHT + 0.02, p1_3d.z);
        const p2 = new THREE.Vector3(p2_3d.x, HEX_HEIGHT + 0.02, p2_3d.z);
        const dx = p2.x - p1.x;
        const dz = p2.z - p1.z;
        const len = Math.hypot(dx, dz);
        const angle = Math.atan2(dx, dz);

        const isLegal = propsRef.current.legalEdges?.has(eid);
        const ownerSeat = roads[eid];
        let edgeMat = isLegal ? legalTrailMat : unbuiltTrailMat;
        if (ownerSeat !== undefined) {
          const pCol = playerColorMap.get(ownerSeat) ?? 'white';
          const hexCol = PLAYER_3D_COLORS[pCol]?.main ?? 0xffffff;
          edgeMat = new THREE.MeshStandardMaterial({
            color: hexCol,
            roughness: 0.3,
            polygonOffset: true,
            polygonOffsetFactor: -2,
            polygonOffsetUnits: -2,
          });
        }

        const trailGroup = new THREE.Group();
        trailGroup.position.addVectors(p1, p2).multiplyScalar(0.5);
        trailGroup.position.y = HEX_HEIGHT + 0.04;
        trailGroup.rotation.set(0, angle, 0);

        // Dark walnut outer border frame
        const borderMesh = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.05, len * 0.94), trailBorderMat);
        borderMesh.receiveShadow = true;
        trailGroup.add(borderMesh);

        // Cream birch inner road slot
        const innerTrail = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.07, len * 0.92), edgeMat);
        innerTrail.position.y = 0.01;
        innerTrail.receiveShadow = true;
        trailGroup.add(innerTrail);

        boardGroup.add(trailGroup);
      }

      // --- D. Standard Circular Wooden Nodes at All Vertices (Matching Reference Sheet) ---
      const plazaBorderGeom = new THREE.CylinderGeometry(1.15, 1.35, 0.16, 24);
      const innerPlazaGeom = new THREE.CylinderGeometry(0.96, 1.15, 0.20, 24);

      for (const [vidStr, pos] of Object.entries(board.topology.vertexPos)) {
        const vid = Number(vidStr);
        const v3d = toBoard3D(pos.x, pos.y);
        const vx = v3d.x;
        const vz = v3d.z;
        const isLegal = propsRef.current.legalVertices?.has(vid);
        const building = buildings[vid];
        let plazaMat = isLegal ? legalNodeMat : unbuiltNodeMat;
        if (building !== undefined) {
          const pCol = playerColorMap.get(building.seat) ?? 'white';
          const hexCol = PLAYER_3D_COLORS[pCol]?.main ?? 0xffffff;
          plazaMat = new THREE.MeshStandardMaterial({
            color: hexCol,
            roughness: 0.3,
            polygonOffset: true,
            polygonOffsetFactor: -3,
            polygonOffsetUnits: -3,
          });
        }

        const plazaGroup = new THREE.Group();
        plazaGroup.position.set(vx, HEX_HEIGHT + 0.06, vz);

        // Dark walnut outer border ring
        const borderRing = new THREE.Mesh(plazaBorderGeom, trailBorderMat);
        borderRing.receiveShadow = true;
        plazaGroup.add(borderRing);

        // Cream birch inner node disc (Standard Node)
        const innerPlaza = new THREE.Mesh(innerPlazaGeom, plazaMat);
        innerPlaza.position.y = 0.02;
        innerPlaza.receiveShadow = true;
        plazaGroup.add(innerPlaza);

        boardGroup.add(plazaGroup);
      }

      // --- E. Roads ---
      for (const [eid, ownerSeat] of Object.entries(roads)) {
        const endpoints = board.topology.edgeEndpoints[eid];
        if (!endpoints) continue;
        const [a, b] = endpoints;
        const pa = board.topology.vertexPos[a];
        const pb = board.topology.vertexPos[b];
        if (!pa || !pb) continue;

        const p1_3d = toBoard3D(pa.x, pa.y);
        const p2_3d = toBoard3D(pb.x, pb.y);
        const p1 = new THREE.Vector3(p1_3d.x, HEX_HEIGHT + 0.04, p1_3d.z);
        const p2 = new THREE.Vector3(p2_3d.x, HEX_HEIGHT + 0.04, p2_3d.z);
        const color = playerColorMap.get(ownerSeat) ?? 'white';
        const road = createRoadMesh(p1, p2, color);
        boardGroup.add(road);
        hitMeshes.push({ mesh: road, kind: 'builtRoad', id: eid });
      }

      // --- F. Buildings (Settlements & Cities) ---
      for (const [vidStr, building] of Object.entries(buildings)) {
        const vid = Number(vidStr);
        const vPos = board.topology.vertexPos[vid];
        if (!vPos) continue;

        const v3d = toBoard3D(vPos.x, vPos.y);
        const vx = v3d.x;
        const vz = v3d.z;
        const color = playerColorMap.get(building.seat) ?? 'white';
        const piece =
          building.type === 'city' ? createCityMesh(color) : createSettlementMesh(color);
        piece.position.set(vx, HEX_HEIGHT + 0.12, vz);
        boardGroup.add(piece);
        hitMeshes.push({ mesh: piece, kind: 'builtBuilding', id: vid });
      }

      // --- G. Robber on Crater Base ---
      const robberAxial = parseHexId(robber);
      const robberCenter = hexToPixel(robberAxial.q, robberAxial.r);
      const rob3d = toBoard3D(robberCenter.x, robberCenter.y);
      const robberPawn = createRobberMesh();
      robberPawn.position.set(rob3d.x, HEX_HEIGHT + 0.08, rob3d.z);
      boardGroup.add(robberPawn);

      // --- H. Legal Edge Highlights & Raycast Targets ---
      const legalEdgesSet = propsRef.current.legalEdges;
      if (legalEdgesSet && legalEdgesSet.size > 0) {
        for (const eid of legalEdgesSet) {
          const endpoints = board.topology.edgeEndpoints[eid];
          if (!endpoints) continue;
          const [a, b] = endpoints;
          const pa = board.topology.vertexPos[a];
          const pb = board.topology.vertexPos[b];
          if (!pa || !pb) continue;

          const p1_3d = toBoard3D(pa.x, pa.y);
          const p2_3d = toBoard3D(pb.x, pb.y);
          const p1 = new THREE.Vector3(p1_3d.x, HEX_HEIGHT, p1_3d.z);
          const p2 = new THREE.Vector3(p2_3d.x, HEX_HEIGHT, p2_3d.z);
          const dx = p2.x - p1.x;
          const dz = p2.z - p1.z;
          const len = Math.hypot(dx, dz);
          const angle = Math.atan2(dx, dz);

          // Visual glowing ghost road
          const ghostGeom = new THREE.BoxGeometry(0.85, 0.32, len * 0.94);
          const ghost = new THREE.Mesh(ghostGeom, roadGhostMat);
          ghost.position.addVectors(p1, p2).multiplyScalar(0.5);
          ghost.position.y = HEX_HEIGHT + 0.22;
          ghost.rotation.set(0, angle, 0);
          boardGroup.add(ghost);

          // Raycast target
          const hitGeom = new THREE.BoxGeometry(1.2, 0.65, len);
          const hitMesh = new THREE.Mesh(hitGeom, new THREE.MeshBasicMaterial({ visible: false }));
          hitMesh.position.copy(ghost.position);
          hitMesh.rotation.set(0, angle, 0);
          boardGroup.add(hitMesh);
          hitMeshes.push({ mesh: hitMesh, kind: 'edge', id: eid });
        }
      }

      // --- I. Legal Vertex Beacons & Raycast Targets ---
      const legalVerticesSet = propsRef.current.legalVertices;
      if (legalVerticesSet && legalVerticesSet.size > 0) {
        for (const vid of legalVerticesSet) {
          const vPos = board.topology.vertexPos[vid];
          if (!vPos) continue;

          const v3d = toBoard3D(vPos.x, vPos.y);
          const vx = v3d.x;
          const vz = v3d.z;

          // Glowing vertical beacon
          const beaconGeom = new THREE.CylinderGeometry(0.35, 0.35, 2.2, 12);
          const beacon = new THREE.Mesh(beaconGeom, beaconMat);
          beacon.position.set(vx, HEX_HEIGHT + 1.1, vz);
          boardGroup.add(beacon);

          // Rotating white beacon ring
          const ringGeom = new THREE.RingGeometry(0.6, 0.9, 16);
          const ring = new THREE.Mesh(ringGeom, beaconRingMat);
          ring.rotation.x = -Math.PI / 2;
          ring.position.set(vx, HEX_HEIGHT + 1.8, vz);
          boardGroup.add(ring);

          // Raycast target sphere
          const hitGeom = new THREE.SphereGeometry(1.2, 8, 8);
          const hitMesh = new THREE.Mesh(hitGeom, new THREE.MeshBasicMaterial({ visible: false }));
          hitMesh.position.set(vx, HEX_HEIGHT + 1.0, vz);
          boardGroup.add(hitMesh);
          hitMeshes.push({ mesh: hitMesh, kind: 'vertex', id: vid });
        }
      }

      // --- J. Deep Royal Blue Ocean Water ---
      const oceanBase = createOceanBase();
      boardGroup.add(oceanBase);
    }

    rebuildBoard(propsRef.current.snap);

    // 5. Raycaster & Mouse Handling
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const getRaycastHit = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);

      const targetObjects = hitMeshes.map((h) => h.mesh);
      const intersects = raycaster.intersectObjects(targetObjects, true);
      if (intersects.length === 0) return null;

      const hitObj = intersects[0]!.object;
      return (
        hitMeshes.find((h) => {
          if (h.mesh === hitObj) return true;
          let curr: THREE.Object3D | null = hitObj;
          while (curr) {
            if (curr === h.mesh) return true;
            curr = curr.parent;
          }
          return false;
        }) ?? null
      );
    };

    const hoverGroup = new THREE.Group();
    scene.add(hoverGroup);

    const hoverGlowMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.1,
      transparent: true,
      opacity: 0.88,
      roughness: 0.2,
    });
    const hoverRingMat = new THREE.MeshBasicMaterial({
      color: 0xfffbeb,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });
    const hoverHexMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });

    let lastHoveredPiece: THREE.Object3D | null = null;

    const onPointerMove = (event: MouseEvent) => {
      const hit = getRaycastHit(event);
      container.style.cursor = hit ? 'pointer' : 'default';

      if (lastHoveredPiece && (!hit || (hit.mesh !== lastHoveredPiece && !hit.mesh.children.includes(lastHoveredPiece)))) {
        lastHoveredPiece.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const m = (child as THREE.Mesh).material;
            if (m && 'emissiveIntensity' in m) {
              (m as THREE.MeshStandardMaterial).emissiveIntensity = 0.35;
            }
          }
        });
        lastHoveredPiece = null;
      }

      while (hoverGroup.children.length > 0) {
        hoverGroup.remove(hoverGroup.children[0]!);
      }

      if (hit) {
        const { snap, legalVertices, legalEdges, legalHexes } = propsRef.current;
        const { board, you } = snap;
        const myColor = snap.players[you.seat]?.color ?? 'red';

        if (hit.kind === 'vertex' && typeof hit.id === 'number' && legalVertices?.has(hit.id)) {
          const vPos = board.topology.vertexPos[hit.id];
          if (vPos) {
            const v3d = toBoard3D(vPos.x, vPos.y);

            const ghostSettlement = createSettlementMesh(myColor);
            ghostSettlement.position.set(v3d.x, HEX_HEIGHT + 0.14, v3d.z);
            ghostSettlement.traverse((child) => {
              if ((child as THREE.Mesh).isMesh) {
                (child as THREE.Mesh).material = hoverGlowMat;
              }
            });
            hoverGroup.add(ghostSettlement);

            const halo = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.55, 24), hoverRingMat);
            halo.rotation.x = -Math.PI / 2;
            halo.position.set(v3d.x, HEX_HEIGHT + 0.16, v3d.z);
            hoverGroup.add(halo);
          }
        } else if (hit.kind === 'edge' && typeof hit.id === 'string' && legalEdges?.has(hit.id)) {
          const endpoints = board.topology.edgeEndpoints[hit.id];
          if (endpoints) {
            const [a, b] = endpoints;
            const pa = board.topology.vertexPos[a];
            const pb = board.topology.vertexPos[b];
            if (pa && pb) {
              const p1_3d = toBoard3D(pa.x, pa.y);
              const p2_3d = toBoard3D(pb.x, pb.y);
              const dx = p2_3d.x - p1_3d.x;
              const dz = p2_3d.z - p1_3d.z;
              const len = Math.hypot(dx, dz);
              const angle = Math.atan2(dx, dz);

              const ghostRoad = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.34, len * 0.94), hoverGlowMat);
              ghostRoad.position.set((p1_3d.x + p2_3d.x) * 0.5, HEX_HEIGHT + 0.24, (p1_3d.z + p2_3d.z) * 0.5);
              ghostRoad.rotation.set(0, angle, 0);
              hoverGroup.add(ghostRoad);
            }
          }
        } else if (hit.kind === 'hex' && typeof hit.id === 'string' && legalHexes?.has(hit.id)) {
          const axial = parseHexId(hit.id);
          const center2d = hexToPixel(axial.q, axial.r);
          const h3d = toBoard3D(center2d.x, center2d.y);

          const ring = new THREE.Mesh(new THREE.RingGeometry(HEX_RADIUS * 0.3, HEX_RADIUS * 0.96, 6), hoverHexMat);
          ring.rotation.x = -Math.PI / 2;
          ring.position.set(h3d.x, HEX_HEIGHT + 0.2, h3d.z);
          hoverGroup.add(ring);
        } else if (hit.kind === 'builtBuilding' || hit.kind === 'builtRoad') {
          lastHoveredPiece = hit.mesh;
          hit.mesh.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const m = (child as THREE.Mesh).material;
              if (m && 'emissiveIntensity' in m) {
                (m as THREE.MeshStandardMaterial).emissiveIntensity = 1.1;
              }
            }
          });
          if (hit.kind === 'builtBuilding') {
            const halo = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.7, 24), hoverRingMat);
            halo.rotation.x = -Math.PI / 2;
            halo.position.set(hit.mesh.position.x, HEX_HEIGHT + 0.14, hit.mesh.position.z);
            hoverGroup.add(halo);
          }
        }
      }
    };

    const onClick = (event: MouseEvent) => {
      const hit = getRaycastHit(event);
      if (!hit) return;

      const { onVertexClick, onEdgeClick, onHexClick } = propsRef.current;
      if (hit.kind === 'vertex' && typeof hit.id === 'number') {
        onVertexClick?.(hit.id);
      } else if (hit.kind === 'edge' && typeof hit.id === 'string') {
        onEdgeClick?.(hit.id);
      } else if (hit.kind === 'hex' && typeof hit.id === 'string') {
        onHexClick?.(hit.id);
      }
    };

    renderer.domElement.addEventListener('mousemove', onPointerMove);
    renderer.domElement.addEventListener('click', onClick);

    // 6. Animation Loop
    let animId = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      if (hoverGroup.children.length > 0) {
        const pulse = 1.0 + Math.sin(elapsed * 8) * 0.25;
        hoverGlowMat.emissiveIntensity = 0.9 * pulse;
        hoverRingMat.opacity = 0.7 + Math.sin(elapsed * 8) * 0.3;
      }
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // 7. Resize Observer
    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    rebuildBoardRef.current = rebuildBoard;

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('mousemove', onPointerMove);
      renderer.domElement.removeEventListener('click', onClick);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  useEffect(() => {
    rebuildBoardRef.current?.(snap);
  }, [snap, legalVertices, legalEdges, legalHexes]);

  const setTopDownView = () => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    camera.position.set(0, 58, 0.1);
    controls.target.set(0, 0, 0);
    controls.update();
    setCameraMode('top');
  };

  const setIsometricView = () => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    camera.position.set(0, 36, 32);
    controls.target.set(0, 0, 0);
    controls.update();
    setCameraMode('3d');
  };

  return (
    <div className="relative h-full w-full select-none" data-testid="three-board">
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />

      {/* Camera View Preset Controls */}
      <div className="pointer-events-auto absolute top-4 right-4 flex items-center gap-1.5 rounded-xl border border-sky-500/30 bg-[#071828]/85 p-1.5 shadow-xl backdrop-blur-md">
        <button
          type="button"
          onClick={setIsometricView}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
            cameraMode === '3d'
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'bg-sky-950/70 text-sky-200 hover:bg-sky-800'
          }`}
          title="3D Isometric Perspective"
        >
          🎮 3D View
        </button>
        <button
          type="button"
          onClick={setTopDownView}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
            cameraMode === 'top'
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'bg-sky-950/70 text-sky-200 hover:bg-sky-800'
          }`}
          title="Top-Down Tactical View"
        >
          🧭 2D Map
        </button>
        <button
          type="button"
          onClick={setIsometricView}
          className="rounded-lg bg-sky-950/70 px-2.5 py-1.5 text-xs font-bold text-sky-300 hover:bg-sky-800"
          title="Reset Camera"
        >
          ⛶ Reset
        </button>
      </div>
    </div>
  );
});
