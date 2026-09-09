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
  createHarborPortMesh,
  createHillsProps,
  createMountainProps,
  createPastureProps,
  createRoadMesh,
  createRobberMesh,
  createSettlementMesh,
  getNumberTokenTexture,
  HEX_BASE_RADIUS,
  HEX_HEIGHT,
  HEX_RADIUS,
  SCALE,
  TERRAIN_COLORS,
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
    scene.background = new THREE.Color('#071828');
    scene.fog = new THREE.FogExp2('#071828', 0.012);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.5, 300);
    camera.position.set(0, 32, 28);
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
    controls.minDistance = 12;
    controls.maxDistance = 65;
    controls.minPolarAngle = Math.PI / 10; // Allow looking almost straight down
    controls.maxPolarAngle = Math.PI / 2.3; // Prevent dipping under water
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    // 3. Lighting
    const ambientLight = new THREE.AmbientLight(0xfff8ee, 1.2);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfff5e6, 2.4);
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

    // Ocean cyan bounce light
    const oceanLight = new THREE.DirectionalLight(0x38bdf8, 0.5);
    oceanLight.position.set(-20, -10, -20);
    scene.add(oceanLight);

    // 4. Ocean
    const oceanGeom = new THREE.CylinderGeometry(75, 75, 1.2, 64);
    const oceanMat = new THREE.MeshStandardMaterial({
      color: 0x093354,
      roughness: 0.15,
      metalness: 0.35,
    });
    const ocean = new THREE.Mesh(oceanGeom, oceanMat);
    ocean.position.y = -0.6;
    ocean.receiveShadow = true;
    scene.add(ocean);

    // Subtle foam ring around island
    const foamGeom = new THREE.RingGeometry(18, 20.5, 48);
    const foamMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
    });
    const foam = new THREE.Mesh(foamGeom, foamMat);
    foam.rotation.x = -Math.PI / 2;
    foam.position.y = 0.02;
    scene.add(foam);

    // 5. Board Dynamic Container (Hexes, props, tokens, pieces, hit targets)
    const boardGroup = new THREE.Group();
    scene.add(boardGroup);

    // Raycast hit targets map
    const hitMeshes: Array<{
      mesh: THREE.Object3D;
      kind: 'vertex' | 'edge' | 'hex';
      id: number | string;
    }> = [];

    // Reusable Materials
    const hexSideMat = new THREE.MeshStandardMaterial({ color: 0x947250, roughness: 0.9 });
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.85 });
    const beaconRingMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
    const roadGhostMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.75,
      roughness: 0.4,
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

        // Hex slab cylinder
        const col = TERRAIN_COLORS[hexData.terrain];
        const topMat = new THREE.MeshStandardMaterial({
          color: col.top,
          roughness: col.rough,
          flatShading: true,
        });
        const materials = [hexSideMat, topMat, hexSideMat];
        const hexGeom = new THREE.CylinderGeometry(HEX_RADIUS, HEX_BASE_RADIUS, HEX_HEIGHT, 6);
        const slab = new THREE.Mesh(hexGeom, materials);
        slab.rotation.y = Math.PI / 6; // Orient points/edges to match 2D layout
        slab.position.y = HEX_HEIGHT / 2;
        slab.receiveShadow = true;
        slab.castShadow = true;
        hexObj.add(slab);

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
          const wellRingGeom = new THREE.RingGeometry(1.24, 1.48, 32);
          const wellRingMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.8 });
          const wellRing = new THREE.Mesh(wellRingGeom, wellRingMat);
          wellRing.rotation.x = -Math.PI / 2;
          wellRing.position.y = HEX_HEIGHT + 0.01;
          hexObj.add(wellRing);

          // Number token sitting flush inside the well
          const pips = PIPS[hexData.token] ?? 0;
          const tokenTex = getNumberTokenTexture(hexData.token, pips);
          const tokenTopMat = new THREE.MeshBasicMaterial({ map: tokenTex });
          const tokenSideMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.4 });
          const tokenGeom = new THREE.CylinderGeometry(1.24, 1.24, 0.16, 32);
          const tokenMesh = new THREE.Mesh(tokenGeom, [tokenSideMat, tokenTopMat, tokenSideMat]);
          tokenMesh.position.y = HEX_HEIGHT + 0.08;
          tokenMesh.castShadow = true;
          hexObj.add(tokenMesh);
        }

        // Invisible raycast hit-disc for hex selection (e.g. robber move)
        const hitGeom = new THREE.CylinderGeometry(HEX_RADIUS * 0.9, HEX_RADIUS * 0.9, 0.4, 6);
        const hitMat = new THREE.MeshBasicMaterial({ visible: false });
        const hexHit = new THREE.Mesh(hitGeom, hitMat);
        hexHit.position.y = HEX_HEIGHT + 0.2;
        hexObj.add(hexHit);
        hitMeshes.push({ mesh: hexHit, kind: 'hex', id: hexId });

        // Highlight ring if legal hex
        if (propsRef.current.legalHexes?.has(hexId)) {
          const ringGeom = new THREE.RingGeometry(HEX_RADIUS * 0.4, HEX_RADIUS * 0.95, 6);
          const ring = new THREE.Mesh(ringGeom, hexHighlightMat);
          ring.rotation.x = -Math.PI / 2;
          ring.rotation.z = Math.PI / 6;
          ring.position.y = HEX_HEIGHT + 0.15;
          hexObj.add(ring);
        }

        boardGroup.add(hexObj);
      }

      // --- B. Harbors ---
      for (const [eid, harbor] of Object.entries(board.harbors)) {
        const endpoints = board.topology.edgeEndpoints[eid];
        if (!endpoints) continue;
        const [a, b] = endpoints;
        const pa = board.topology.vertexPos[a];
        const pb = board.topology.vertexPos[b];
        if (!pa || !pb) continue;

        const p1 = new THREE.Vector3(pa.x * SCALE, HEX_HEIGHT, pa.y * SCALE);
        const p2 = new THREE.Vector3(pb.x * SCALE, HEX_HEIGHT, pb.y * SCALE);
        const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);

        // Direction pointing outward into the sea
        const dirFromCenter = new THREE.Vector3(mid.x, 0, mid.z).normalize();
        const port = createHarborPortMesh(harbor);
        port.position.copy(mid);
        port.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dirFromCenter);
        boardGroup.add(port);
      }
      // --- C. Road Path Bed Strips Along All Edges ---
      const trailMat = new THREE.MeshStandardMaterial({
        color: 0x57534e,
        roughness: 0.95,
        flatShading: true,
      });
      const legalTrailMat = new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xca8a04,
        emissiveIntensity: 0.4,
        roughness: 0.5,
      });

      for (const [eid, endpoints] of Object.entries(board.topology.edgeEndpoints)) {
        const [a, b] = endpoints;
        const pa = board.topology.vertexPos[a];
        const pb = board.topology.vertexPos[b];
        if (!pa || !pb) continue;

        const p1 = new THREE.Vector3(pa.x * SCALE, HEX_HEIGHT + 0.02, pa.y * SCALE);
        const p2 = new THREE.Vector3(pb.x * SCALE, HEX_HEIGHT + 0.02, pb.y * SCALE);
        const dir = new THREE.Vector3().subVectors(p2, p1);
        const len = dir.length();

        const isLegal = propsRef.current.legalEdges?.has(eid);
        const trailGeom = new THREE.BoxGeometry(0.38, 0.06, len * 0.92);
        const trail = new THREE.Mesh(trailGeom, isLegal ? legalTrailMat : trailMat);
        trail.position.addVectors(p1, p2).multiplyScalar(0.5);
        trail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.normalize());
        trail.receiveShadow = true;
        boardGroup.add(trail);
      }

      // --- D. Settlement Foundation Plazas at All Vertices ---
      const plazaGeom = new THREE.CylinderGeometry(0.72, 0.82, 0.12, 16);
      const unbuiltPlazaMat = new THREE.MeshStandardMaterial({
        color: 0x64748b,
        roughness: 0.85,
        flatShading: true,
      });
      const legalPlazaMat = new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xca8a04,
        emissiveIntensity: 0.45,
        roughness: 0.4,
      });

      for (const [vidStr, pos] of Object.entries(board.topology.vertexPos)) {
        const vid = Number(vidStr);
        const vx = pos.x * SCALE;
        const vz = pos.y * SCALE;
        const isLegal = propsRef.current.legalVertices?.has(vid);
        const plaza = new THREE.Mesh(plazaGeom, isLegal ? legalPlazaMat : unbuiltPlazaMat);
        plaza.position.set(vx, HEX_HEIGHT + 0.06, vz);
        plaza.receiveShadow = true;
        boardGroup.add(plaza);
      }

      // --- E. Roads ---
      for (const [eid, ownerSeat] of Object.entries(roads)) {
        const endpoints = board.topology.edgeEndpoints[eid];
        if (!endpoints) continue;
        const [a, b] = endpoints;
        const pa = board.topology.vertexPos[a];
        const pb = board.topology.vertexPos[b];
        if (!pa || !pb) continue;

        const p1 = new THREE.Vector3(pa.x * SCALE, HEX_HEIGHT + 0.04, pa.y * SCALE);
        const p2 = new THREE.Vector3(pb.x * SCALE, HEX_HEIGHT + 0.04, pb.y * SCALE);
        const color = playerColorMap.get(ownerSeat) ?? 'white';
        const road = createRoadMesh(p1, p2, color);
        boardGroup.add(road);
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
        piece.position.set(vx, HEX_HEIGHT + 0.12, vz);
        boardGroup.add(piece);
      }

      const robberAxial = parseHexId(robber);
      const robberCenter = hexToPixel(robberAxial.q, robberAxial.r);
      const rx = robberCenter.x * SCALE;
      const rz = robberCenter.y * SCALE;
      const robberPawn = createRobberMesh();
      robberPawn.position.set(rx, HEX_HEIGHT + 0.18, rz);
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

          const p1 = new THREE.Vector3(pa.x * SCALE, HEX_HEIGHT, pa.y * SCALE);
          const p2 = new THREE.Vector3(pb.x * SCALE, HEX_HEIGHT, pb.y * SCALE);
          const dir = new THREE.Vector3().subVectors(p2, p1);
          const len = dir.length();

          // Visual glowing ghost road
          const ghostGeom = new THREE.CylinderGeometry(0.32, 0.32, len * 0.9, 8);
          const ghost = new THREE.Mesh(ghostGeom, roadGhostMat);
          ghost.position.addVectors(p1, p2).multiplyScalar(0.5);
          ghost.position.y += 0.28;
          ghost.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
          boardGroup.add(ghost);

          // Fat raycast hit target
          const hitGeom = new THREE.CylinderGeometry(0.7, 0.7, len, 6);
          const hitMesh = new THREE.Mesh(hitGeom, new THREE.MeshBasicMaterial({ visible: false }));
          hitMesh.position.copy(ghost.position);
          hitMesh.quaternion.copy(ghost.quaternion);
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
      return hitMeshes.find((h) => h.mesh === hitObj) ?? null;
    };

    const onPointerMove = (event: MouseEvent) => {
      const hit = getRaycastHit(event);
      if (hit) {
        container.style.cursor = 'pointer';
      } else {
        container.style.cursor = 'default';
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

      // Gentle water ripple rotation
      foam.rotation.z = elapsed * 0.05;

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
    camera.position.set(0, 48, 0.1);
    controls.target.set(0, 0, 0);
    controls.update();
    setCameraMode('top');
  };

  const setIsometricView = () => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    camera.position.set(0, 32, 28);
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
