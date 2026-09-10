// Full 3D WebGL Board for Catan using Three.js.
// Features: real-time shadows, procedural hex tiles with biome props,
// carved number tokens, wooden harbors, 3D pieces, robber pawn, raycasted
// selection beacons, and smooth orbit/pan/zoom camera controls.

import { memo, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { PersonalSnapshot } from '../types';
import { hexToPixel, parseHexId, PIPS } from '@catan/shared';
import {
  createOceanBase,
  createCityMesh,
  createDesertProps,
  createFieldsProps,
  createForestProps,
  createHarborBridge,
  createHarborPortMesh,
  createHillsProps,
  createMountainProps,
  createPastureProps,
  createRoadMesh,
  createRobberMesh,
  createSettlementMesh,
  getNumberTokenTexture,
  getRiverFlowTexture,
  getWoodPathwayTexture,
  getWoodPlazaTexture,
  HEX_BASE_RADIUS,
  HEX_ELEVATION,
  HEX_RADIUS,
  PLAYER_3D_COLORS,
  SCALE,
  STREET_Y,
  TERRAIN_COLORS,
  TOP_Y,
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

  // Stable ref holders for props accessed during mouse events/animations.
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
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Scene & Renderer setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#38bdf8'); // Liquid water lake sky blue!
    scene.fog = new THREE.FogExp2('#38bdf8', 0.0022); // Atmospheric sunlit lake haze

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.5, 800);
    camera.position.set(0, 36, 32);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    // 2. Camera Controls
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
    const ambientLight = new THREE.AmbientLight(0xf0f9ff, 1.40);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 2.6);
    sunLight.position.set(24, 45, 18);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 5;
    sunLight.shadow.camera.far = 120;
    sunLight.shadow.camera.left = -26;
    sunLight.shadow.camera.right = 26;
    sunLight.shadow.camera.top = 26;
    sunLight.shadow.camera.bottom = -26;
    sunLight.shadow.bias = -0.0003;
    scene.add(sunLight);

    // Lake sky blue ambient bounce light
    const oceanLight = new THREE.DirectionalLight(0x38bdf8, 0.65);
    oceanLight.position.set(-20, -10, -20);
    scene.add(oceanLight);

    // 4. Liquid Water Lake Basin
    const oceanGeom = new THREE.CylinderGeometry(200, 200, 2.0, 64);
    const oceanMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7, // Radiant liquid water lake sky blue
      roughness: 0.10,
      metalness: 0.28,
    });
    const ocean = new THREE.Mesh(oceanGeom, oceanMat);
    ocean.position.y = -1.15; // Water surface sits at y = -0.15, well below ground and river
    ocean.receiveShadow = true;
    scene.add(ocean);

    // River flow texture reference for animation loop
    let riverFlowTex: THREE.CanvasTexture | null = null;

    // 1. Inner River Shoreline Embankment (natural sandy/rocky bank under elevated hex cliffs)
    const innerBankGeom = new THREE.RingGeometry(18.2, 19.5, 64);
    const innerBankMat = new THREE.MeshStandardMaterial({
      color: 0x854d0e, // Warm natural earth/stone shore
      roughness: 0.9,
      side: THREE.DoubleSide,
    });
    const innerBank = new THREE.Mesh(innerBankGeom, innerBankMat);
    innerBank.rotation.x = -Math.PI / 2;
    innerBank.position.y = -0.01;
    innerBank.receiveShadow = true;
    scene.add(innerBank);

    // 2. Surrounding Flowing River Channel (bordering the entire elevated island perimeter!)
    const riverGeom = new THREE.RingGeometry(18.0, 25.5, 64);
    riverFlowTex = getRiverFlowTexture();
    const riverMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9, // Liquid flowing stream
      map: riverFlowTex,
      transparent: true,
      opacity: 0.88,
      roughness: 0.10,
      metalness: 0.25,
      side: THREE.DoubleSide,
    });
    const river = new THREE.Mesh(riverGeom, riverMat);
    river.rotation.x = -Math.PI / 2;
    river.position.y = 0.01; // Flowing river stream right at water level
    river.receiveShadow = true;
    scene.add(river);

    // 3. Outer Riverbank Embankment (natural stone barrier separating river from exterior ocean)
    const outerBankGeom = new THREE.RingGeometry(25.4, 26.8, 64);
    const outerBankMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b, // Dark natural stone embankment
      roughness: 0.85,
      side: THREE.DoubleSide,
    });
    const outerBank = new THREE.Mesh(outerBankGeom, outerBankMat);
    outerBank.rotation.x = -Math.PI / 2;
    outerBank.position.y = 0.00;
    outerBank.receiveShadow = true;
    scene.add(outerBank);
    // 5. Board Dynamic Container (Hexes, props, tokens, pieces, hit targets)
    const boardGroup = new THREE.Group();
    scene.add(boardGroup);

    // Raycast hit targets map
    const hitMeshes: Array<{
      mesh: THREE.Object3D;
      kind: 'vertex' | 'edge' | 'hex' | 'builtBuilding' | 'builtRoad';
      id: number | string;
    }> = [];

    // Solid architectural quarry stone masonry for elevated building blocks
    const hexSideMat = new THREE.MeshStandardMaterial({
      color: 0x3d3126, // Solid building foundation masonry
      roughness: 0.85,
      flatShading: true,
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
      // Clear prior board elements
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
        const hx = center2d.x * SCALE;
        const hz = center2d.y * SCALE;
        const hexObj = new THREE.Group();
        hexObj.position.set(hx, 0, hz);
        const col = TERRAIN_COLORS[hexData.terrain];
        const topMat = new THREE.MeshStandardMaterial({
          color: col.top,
          roughness: col.rough,
          flatShading: true,
        });
        const materials = [hexSideMat, topMat, hexSideMat];
        const hexGeom = new THREE.CylinderGeometry(HEX_RADIUS, HEX_BASE_RADIUS, HEX_ELEVATION, 6);
        const slab = new THREE.Mesh(hexGeom, materials);
        slab.rotation.y = 0; // True pointy-top orientation: connects by edges with NO triangle gaps!
        slab.position.y = STREET_Y + HEX_ELEVATION / 2; // Subtle elevation above road path
        slab.receiveShadow = true;
        slab.castShadow = true;
        hexObj.add(slab);

        // Hexagonal perimeter boundary frame ring (sleek thin dark walnut rim, fully opaque)
        const borderRingGeom = new THREE.RingGeometry(HEX_RADIUS * 0.96, HEX_RADIUS, 6, 1, Math.PI / 6);
        const borderRingMat = new THREE.MeshStandardMaterial({
          color: 0x2e1e14, // Dark walnut boundary frame
          roughness: 0.85,
          transparent: false,
          opacity: 1.0,
          side: THREE.DoubleSide,
        });
        const hexBorderRing = new THREE.Mesh(borderRingGeom, borderRingMat);
        hexBorderRing.rotation.x = -Math.PI / 2;
        hexBorderRing.position.y = TOP_Y + 0.005;
        hexBorderRing.receiveShadow = true;
        hexObj.add(hexBorderRing);

        // Biome props
        let props: THREE.Group | null = null;
        if (hexData.terrain === 'forest') props = createForestProps();
        else if (hexData.terrain === 'mountains') props = createMountainProps();
        else if (hexData.terrain === 'pasture') props = createPastureProps();
        else if (hexData.terrain === 'fields') props = createFieldsProps();
        else if (hexData.terrain === 'hills') props = createHillsProps();
        else if (hexData.terrain === 'desert') props = createDesertProps();

        if (props) {
          props.position.y = TOP_Y; // 3D biome miniatures sit high on top of elevated hex block!
          hexObj.add(props);
        }

        // Recessed circular token well bezel in the tile top
        if (hexData.token !== null) {
          const wellRingGeom = new THREE.RingGeometry(1.65, 1.95, 32);
          const wellRingMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.8 });
          const wellRing = new THREE.Mesh(wellRingGeom, wellRingMat);
          wellRing.rotation.x = -Math.PI / 2;
          wellRing.position.y = TOP_Y + 0.01;
          hexObj.add(wellRing);

          // Number token sitting flush inside the well (enlarged 3D disc!)
          const pips = PIPS[hexData.token] ?? 0;
          const tokenTex = getNumberTokenTexture(hexData.token, pips);
          const tokenTopMat = new THREE.MeshBasicMaterial({ map: tokenTex });
          const tokenSideMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.4 });
          const tokenGeom = new THREE.CylinderGeometry(1.65, 1.65, 0.20, 32);
          const tokenMesh = new THREE.Mesh(tokenGeom, [tokenSideMat, tokenTopMat, tokenSideMat]);
          tokenMesh.position.y = TOP_Y + 0.10;
          tokenMesh.castShadow = true;
          hexObj.add(tokenMesh);
        }

        // Invisible raycast hit-disc for hex selection (e.g. robber move)
        const hitGeom = new THREE.CylinderGeometry(HEX_RADIUS * 0.9, HEX_RADIUS * 0.9, 0.4, 6);
        const hitMat = new THREE.MeshBasicMaterial({ visible: false });
        const hexHit = new THREE.Mesh(hitGeom, hitMat);
        hexHit.position.y = TOP_Y + 0.20;
        hexObj.add(hexHit);
        hitMeshes.push({ mesh: hexHit, kind: 'hex', id: hexId });

        // Highlight ring if legal hex
        if (propsRef.current.legalHexes?.has(hexId)) {
          const ringGeom = new THREE.RingGeometry(HEX_RADIUS * 0.4, HEX_RADIUS * 0.95, 6, 1, Math.PI / 6);
          const ring = new THREE.Mesh(ringGeom, hexHighlightMat);
          ring.rotation.x = -Math.PI / 2;
          ring.position.y = TOP_Y + 0.15;
          hexObj.add(ring);
        }
        boardGroup.add(hexObj);
      }
      // --- B. 3D Miniature Harbor Ports on Extended Wooden Bridge Piers ---
      for (const [eid, harbor] of Object.entries(board.harbors)) {
        const endpoints = board.topology.edgeEndpoints[eid];
        if (!endpoints) continue;
        const [a, b] = endpoints;
        const pa = board.topology.vertexPos[a];
        const pb = board.topology.vertexPos[b];
        if (!pa || !pb) continue;

        const p1 = new THREE.Vector3(pa.x * SCALE, STREET_Y, pa.y * SCALE);
        const p2 = new THREE.Vector3(pb.x * SCALE, STREET_Y, pb.y * SCALE);
        const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);

        // Direction pointing outward into the river/sea
        const dirFromCenter = new THREE.Vector3(mid.x, 0, mid.z).normalize();

        // Extend harbor out by a bridge into the water so it NEVER overlaps settlements at vertices p1 and p2!
        const harborCenter = new THREE.Vector3().addVectors(mid, dirFromCenter.clone().multiplyScalar(3.0));
        harborCenter.y = STREET_Y;

        // Detailed wooden boardwalk footbridge on timber pilings from coastal vertex A
        const bridge1 = createHarborBridge(p1, harborCenter);
        boardGroup.add(bridge1);

        // Detailed wooden boardwalk footbridge on timber pilings from coastal vertex B
        const bridge2 = createHarborBridge(p2, harborCenter);
        boardGroup.add(bridge2);

        // 3D Wooden Pier, Moored Ship, Cargo Crates, and Trade Medallion Disc placed at the end of the bridge!
        const port = createHarborPortMesh(harbor);
        port.position.copy(harborCenter);
        port.position.y = STREET_Y - 0.02;
        port.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dirFromCenter);
        boardGroup.add(port);
      }
      // --- C. Road Path Bed Strips Along All Edges (Wooden Boardwalk Pathways) ---
      const trailBorderMat = new THREE.MeshStandardMaterial({
        color: 0x382012, // Dark walnut timber frame border
        roughness: 0.85,
        flatShading: true,
        transparent: true,
        opacity: 0.90,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
      const unbuiltTrailMat = new THREE.MeshStandardMaterial({
        color: 0xd99864, // Warm golden-amber oak wood tone
        map: getWoodPathwayTexture(),
        roughness: 0.72,
        flatShading: true,
        transparent: true,
        opacity: 0.84, // A little bit transparent as requested!
        depthWrite: true,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      });
      const legalTrailMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xd97706,
        emissiveIntensity: 0.65,
        roughness: 0.45,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      });

      for (const [eid, endpoints] of Object.entries(board.topology.edgeEndpoints)) {
        const [a, b] = endpoints;
        const pa = board.topology.vertexPos[a];
        const pb = board.topology.vertexPos[b];
        if (!pa || !pb) continue;

        const p1 = new THREE.Vector3(pa.x * SCALE, STREET_Y + 0.02, pa.y * SCALE);
        const p2 = new THREE.Vector3(pb.x * SCALE, STREET_Y + 0.02, pb.y * SCALE);
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
            roughness: 0.85,
            polygonOffset: true,
            polygonOffsetFactor: -2,
            polygonOffsetUnits: -2,
          });
        }

        const trailGroup = new THREE.Group();
        trailGroup.position.addVectors(p1, p2).multiplyScalar(0.5);
        trailGroup.position.y = STREET_Y + 0.04;
        trailGroup.rotation.set(0, angle, 0);

        // 1. Dark walnut timber outer frame (calibrated width: 0.72)
        const borderMesh = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.04, len * 0.94), trailBorderMat);
        borderMesh.receiveShadow = true;
        trailGroup.add(borderMesh);

        // 2. Warm wooden inner boardwalk pathway (calibrated width: 0.54)
        const innerTrail = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.05, len * 0.92), edgeMat);
        innerTrail.position.y = 0.01;
        innerTrail.receiveShadow = true;
        trailGroup.add(innerTrail);
        boardGroup.add(trailGroup);
      }

      // --- D. Settlement Foundation Plazas at All Vertices (Circular Wooden Decking Discs) ---
      const plazaBorderGeom = new THREE.CylinderGeometry(0.74, 0.86, 0.10, 16);
      const innerPlazaGeom = new THREE.CylinderGeometry(0.58, 0.68, 0.12, 16);
      const unbuiltPlazaMat = new THREE.MeshStandardMaterial({
        color: 0xd99864, // Warm circular timber deck
        map: getWoodPlazaTexture(),
        roughness: 0.72,
        flatShading: true,
        transparent: true,
        opacity: 0.84, // Slightly transparent wooden plaza!
        depthWrite: true,
        polygonOffset: true,
        polygonOffsetFactor: -3,
        polygonOffsetUnits: -3,
      });
      const legalPlazaMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xd97706,
        emissiveIntensity: 0.65,
        roughness: 0.4,
        polygonOffset: true,
        polygonOffsetFactor: -3,
        polygonOffsetUnits: -3,
      });

      for (const [vidStr, pos] of Object.entries(board.topology.vertexPos)) {
        const vid = Number(vidStr);
        const vx = pos.x * SCALE;
        const vz = pos.y * SCALE;
        const isLegal = propsRef.current.legalVertices?.has(vid);
        const building = buildings[vid];
        let plazaMat = isLegal ? legalPlazaMat : unbuiltPlazaMat;
        if (building !== undefined) {
          const pCol = playerColorMap.get(building.seat) ?? 'white';
          const hexCol = PLAYER_3D_COLORS[pCol]?.main ?? 0xffffff;
          plazaMat = new THREE.MeshStandardMaterial({
            color: hexCol,
            roughness: 0.85,
            polygonOffset: true,
            polygonOffsetFactor: -3,
            polygonOffsetUnits: -3,
          });
        }

        const plazaGroup = new THREE.Group();
        plazaGroup.position.set(vx, STREET_Y + 0.06, vz);

        // 1. Black outer border ring
        const borderRing = new THREE.Mesh(plazaBorderGeom, trailBorderMat);
        borderRing.receiveShadow = true;
        plazaGroup.add(borderRing);

        // 2. Soft greyish-white inner stone plaza disc (or player color if built!)
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

        const p1 = new THREE.Vector3(pa.x * SCALE, STREET_Y + 0.04, pa.y * SCALE);
        const p2 = new THREE.Vector3(pb.x * SCALE, STREET_Y + 0.04, pb.y * SCALE);
        const color = playerColorMap.get(ownerSeat) ?? 'white';
        const road = createRoadMesh(p1, p2, color);
        boardGroup.add(road);
        hitMeshes.push({ mesh: road, kind: 'builtRoad' as never, id: eid });
      }

      // --- F. Buildings (Settlements & Cities) ---
      for (const [vidStr, building] of Object.entries(buildings)) {
        const vid = Number(vidStr);
        const vPos = board.topology.vertexPos[vid];
        if (!vPos) continue;

        const vx = vPos.x * SCALE;
        const vz = vPos.y * SCALE;
        const color = playerColorMap.get(building.seat) ?? 'white';
        const piece =
          building.type === 'city' ? createCityMesh(color) : createSettlementMesh(color);
        piece.position.set(vx, STREET_Y + 0.08, vz);
        boardGroup.add(piece);
        hitMeshes.push({ mesh: piece, kind: 'builtBuilding' as never, id: vid });
      }

      const robberAxial = parseHexId(robber);
      const robberCenter = hexToPixel(robberAxial.q, robberAxial.r);
      const rx = robberCenter.x * SCALE;
      const rz = robberCenter.y * SCALE;
      const robberPawn = createRobberMesh();
      robberPawn.position.set(rx, TOP_Y + 0.18, rz);
      boardGroup.add(robberPawn);

      // --- F. Legal Edge Highlights & Raycast Targets ---
      const legalEdgesSet = propsRef.current.legalEdges;
      if (legalEdgesSet && legalEdgesSet.size > 0) {
        for (const eid of legalEdgesSet) {
          const endpoints = board.topology.edgeEndpoints[eid];
          if (!endpoints) continue;
          const [a, b] = endpoints;
          const pa = board.topology.vertexPos[a];
          const pb = board.topology.vertexPos[b];
          if (!pa || !pb) continue;

          const p1 = new THREE.Vector3(pa.x * SCALE, STREET_Y, pa.y * SCALE);
          const p2 = new THREE.Vector3(pb.x * SCALE, STREET_Y, pb.y * SCALE);
          const dx = p2.x - p1.x;
          const dz = p2.z - p1.z;
          const len = Math.hypot(dx, dz);
          const angle = Math.atan2(dx, dz);

          // Visual glowing ghost road (calibrated height matching taller road)
          const ghostGeom = new THREE.BoxGeometry(0.58, 0.74, len * 0.94);
          const ghost = new THREE.Mesh(ghostGeom, roadGhostMat);
          ghost.position.addVectors(p1, p2).multiplyScalar(0.5);
          ghost.position.y = STREET_Y + 0.41;
          ghost.rotation.set(0, angle, 0);
          boardGroup.add(ghost);

          // Raycast hit target
          const hitGeom = new THREE.BoxGeometry(0.88, 0.85, len);
          const hitMesh = new THREE.Mesh(hitGeom, new THREE.MeshBasicMaterial({ visible: false }));
          hitMesh.position.copy(ghost.position);
          hitMesh.rotation.set(0, angle, 0);
          boardGroup.add(hitMesh);
          hitMeshes.push({ mesh: hitMesh, kind: 'edge', id: eid });
        }
      }
      // --- G. Legal Vertex Beacons & Raycast Targets ---
      const legalVerticesSet = propsRef.current.legalVertices;
      if (legalVerticesSet && legalVerticesSet.size > 0) {
        for (const vid of legalVerticesSet) {
          const vPos = board.topology.vertexPos[vid];
          if (!vPos) continue;

          const vx = vPos.x * SCALE;
          const vz = vPos.y * SCALE;

          // Glowing vertical beacon
          const beaconGeom = new THREE.CylinderGeometry(0.35, 0.35, 2.2, 12);
          const beacon = new THREE.Mesh(beaconGeom, beaconMat);
          beacon.position.set(vx, STREET_Y + 1.1, vz);
          boardGroup.add(beacon);

          // Rotating white beacon ring
          const ringGeom = new THREE.RingGeometry(0.6, 0.9, 16);
          const ring = new THREE.Mesh(ringGeom, beaconRingMat);
          ring.rotation.x = -Math.PI / 2;
          ring.position.set(vx, STREET_Y + 1.8, vz);
          boardGroup.add(ring);

          // Raycast target sphere
          const hitGeom = new THREE.SphereGeometry(1.2, 8, 8);
          const hitMesh = new THREE.Mesh(hitGeom, new THREE.MeshBasicMaterial({ visible: false }));
          hitMesh.position.set(vx, STREET_Y + 1.0, vz);
          boardGroup.add(hitMesh);
          hitMeshes.push({ mesh: hitMesh, kind: 'vertex', id: vid });
        }
      }
      // --- H. Real Ocean Sea Base & Shallow Coastal Shelf ---
      const oceanBase = createOceanBase();
      boardGroup.add(oceanBase);
    }

    // Initial build
    rebuildBoard(propsRef.current.snap);

    // 6. Raycaster & Mouse Click/Move Handling
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

      // Restore prior hovered built piece if any
      if (lastHoveredPiece && (!hit || (hit.mesh !== lastHoveredPiece && !hit.mesh.children.includes(lastHoveredPiece)))) {
        lastHoveredPiece.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const m = (child as THREE.Mesh).material;
            if (m && 'emissiveIntensity' in m) {
              (m as THREE.MeshStandardMaterial).emissiveIntensity = 0.7;
            }
          }
        });
        lastHoveredPiece = null;
      }

      // Clear prior hover preview
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
            const vx = vPos.x * SCALE;
            const vz = vPos.y * SCALE;

            // Glowing holographic ghost settlement
            const ghostSettlement = createSettlementMesh(myColor);
            ghostSettlement.position.set(vx, STREET_Y + 0.14, vz);
            ghostSettlement.traverse((child) => {
              if ((child as THREE.Mesh).isMesh) {
                (child as THREE.Mesh).material = hoverGlowMat;
              }
            });
            hoverGroup.add(ghostSettlement);

            // Glowing rotating halo ring around the vertex (2x scale)
            const halo = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.55, 24), hoverRingMat);
            halo.rotation.x = -Math.PI / 2;
            halo.position.set(vx, STREET_Y + 0.16, vz);
            hoverGroup.add(halo);
          }
        } else if (hit.kind === 'edge' && typeof hit.id === 'string' && legalEdges?.has(hit.id)) {
          const endpoints = board.topology.edgeEndpoints[hit.id];
          if (endpoints) {
            const [a, b] = endpoints;
            const pa = board.topology.vertexPos[a];
            const pb = board.topology.vertexPos[b];
            if (pa && pb) {
              const p1 = new THREE.Vector3(pa.x * SCALE, STREET_Y + 0.14, pa.y * SCALE);
              const p2 = new THREE.Vector3(pb.x * SCALE, STREET_Y + 0.14, pb.y * SCALE);
              const dx = p2.x - p1.x;
              const dz = p2.z - p1.z;
              const len = Math.hypot(dx, dz);
              const angle = Math.atan2(dx, dz);

              const ghostRoad = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.74, len * 0.94), hoverGlowMat);
              ghostRoad.position.addVectors(p1, p2).multiplyScalar(0.5);
              ghostRoad.position.y = STREET_Y + 0.41;
              ghostRoad.rotation.set(0, angle, 0); // Flat on ground!
              hoverGroup.add(ghostRoad);
            }
          }
        } else if (hit.kind === 'hex' && typeof hit.id === 'string' && legalHexes?.has(hit.id)) {
          const axial = parseHexId(hit.id);
          const center2d = hexToPixel(axial.q, axial.r);
          const hx = center2d.x * SCALE;
          const hz = center2d.y * SCALE;

          const ring = new THREE.Mesh(new THREE.RingGeometry(HEX_RADIUS * 0.3, HEX_RADIUS * 0.96, 6, 1, Math.PI / 6), hoverHexMat);
          ring.rotation.x = -Math.PI / 2;
          ring.position.set(hx, TOP_Y + 0.02, hz);
          hoverGroup.add(ring);
        } else if (hit.kind === 'builtBuilding' || hit.kind === 'builtRoad') {
          // Dynamic hover glow on built piece!
          lastHoveredPiece = hit.mesh;
          hit.mesh.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const m = (child as THREE.Mesh).material;
              if (m && 'emissiveIntensity' in m) {
                (m as THREE.MeshStandardMaterial).emissiveIntensity = 1.4;
              }
            }
          });
          if (hit.kind === 'builtBuilding') {
            const halo = new THREE.Mesh(new THREE.RingGeometry(1.4, 2.0, 24), hoverRingMat);
            halo.rotation.x = -Math.PI / 2;
            halo.position.set(hit.mesh.position.x, hit.mesh.position.y + 0.04, hit.mesh.position.z);
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

    // 7. Animation Loop
    let animId = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Animate flowing river current streaming around the exterior perimeter
      if (riverFlowTex) {
        riverFlowTex.offset.x += 0.0022;
      }

      // Pulsing glow on hover preview
      if (hoverGroup.children.length > 0) {
        const pulse = 1.0 + Math.sin(elapsed * 8) * 0.25;
        hoverGlowMat.emissiveIntensity = 0.9 * pulse;
        hoverRingMat.opacity = 0.7 + Math.sin(elapsed * 8) * 0.3;
      }
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // 8. Resize Observer
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

    // Store rebuildBoard trigger for prop changes
    (container as unknown as { __rebuildBoard?: (s: PersonalSnapshot) => void }).__rebuildBoard =
      rebuildBoard;

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

  // Update scene whenever snap or legal sets change
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const trigger = (container as unknown as { __rebuildBoard?: (s: PersonalSnapshot) => void })
      .__rebuildBoard;
    trigger?.(snap);
  }, [snap, legalVertices, legalEdges, legalHexes]);

  // Camera view presets
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
