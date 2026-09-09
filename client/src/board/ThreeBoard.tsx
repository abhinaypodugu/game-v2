// Full 3D WebGL Board for Catan — assembled from the reference asset pack
// (threeUtils.ts) to match the stylized reference images:
// - warm beveled hex frames with rich miniature terrain
// - cream number chips (red 6/8 ink + probability pips)
// - cream wooden nodes at every vertex + chunky roads
// - detailed wooden harbours (piers, boats, sails, lamps, crates, trade signs)
// - deep blue water with wave rings
// - cinematic warm/cool lighting rig

import { memo, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { PersonalSnapshot } from '../types';
import { hexToPixel, parseHexId } from '@catan/shared';
import {
  createCity,
  createHarbour,
  createNode,
  createNumberToken,
  createRobber,
  createRoad,
  createSettlement,
  createTerrainTile,
  createWaterTile,
  setupReferenceLighting,
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

/** Tile radius in reference (pack) units. */
const TILE_R = 2.0;
/** Uniform scale from shared pixel space (HEX_SIZE=100, pointy-top) to pack
 *  units, combined with a 30° rotation so the pointy-top lattice becomes the
 *  flat-top lattice the pack's hex frames are built for. */
const K = TILE_R / 100;
const COS30 = Math.cos(Math.PI / 6);
const SIN30 = Math.sin(Math.PI / 6);

function toBoard3D(x2d: number, y2d: number): { x: number; z: number } {
  const rx = (x2d * COS30 - y2d * SIN30) * K;
  const rz = (x2d * SIN30 + y2d * COS30) * K;
  return { x: rx, z: rz };
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

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 500);
    camera.position.set(0, 18, 16);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      logarithmicDepthBuffer: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    setupReferenceLighting(scene, renderer);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 6;
    controls.maxDistance = 60;
    controls.minPolarAngle = Math.PI / 10;
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    const boardGroup = new THREE.Group();
    scene.add(boardGroup);

    const hitMeshes: Array<{
      mesh: THREE.Object3D;
      kind: 'vertex' | 'edge' | 'hex' | 'builtBuilding' | 'builtRoad';
      id: number | string;
    }> = [];

    function rebuildBoard(currentSnap: PersonalSnapshot): void {
      while (boardGroup.children.length > 0) {
        boardGroup.remove(boardGroup.children[0]!);
      }
      hitMeshes.length = 0;

      const { board, buildings, roads, robber, players } = currentSnap;
      const playerColorMap = new Map<number, string>();
      for (const p of players) playerColorMap.set(p.seat, p.color);

      // --- A. Terrain tiles + number tokens + hex hit targets ---
      for (const [hexId, hexData] of Object.entries(board.hexes)) {
        const { q, r } = parseHexId(hexId);
        const c2d = hexToPixel(q, r);
        const c3d = toBoard3D(c2d.x, c2d.y);

        const tile = createTerrainTile(hexData.terrain, TILE_R);
        tile.position.set(c3d.x, 0, c3d.z);
        tile.rotation.y = Math.PI / 6; // align faces to neighbor directions
        boardGroup.add(tile);

        if (hexData.token !== null) {
          const token = createNumberToken(hexData.token, 0.55);
          token.position.set(c3d.x, 0.3, c3d.z);
          boardGroup.add(token);
        }

        const hexHit = new THREE.Mesh(
          new THREE.CylinderGeometry(TILE_R * 0.94, TILE_R * 0.94, 0.5, 6),
          new THREE.MeshBasicMaterial({ visible: false }),
        );
        hexHit.position.set(c3d.x, 0.3, c3d.z);
        hexHit.rotation.y = Math.PI / 6;
        boardGroup.add(hexHit);
        hitMeshes.push({ mesh: hexHit, kind: 'hex', id: hexId });
      }

      // --- B. Island base slab (cream wood, fills junction seams) ---
      let islandR = 8;
      for (const pos of Object.values(board.topology.vertexPos)) {
        const p = toBoard3D(pos.x, pos.y);
        islandR = Math.max(islandR, Math.hypot(p.x, p.z));
      }
      const slab = new THREE.Mesh(
        new THREE.CylinderGeometry(islandR + 0.55, islandR + 0.7, 0.5, 48),
        new THREE.MeshStandardMaterial({ color: 0xd9c8a4, roughness: 0.8 }),
      );
      slab.position.y = -0.27;
      // --- C. Harbour piers beyond occupied border edges ---
      for (const [eid, harbor] of Object.entries(board.harbors)) {
        const endpoints = board.topology.edgeEndpoints[eid];
        if (!endpoints) continue;
        const [a, b] = endpoints;
        const pa = board.topology.vertexPos[a];
        const pb = board.topology.vertexPos[b];
        if (!pa || !pb) continue;

        const pa3 = toBoard3D(pa.x, pa.y);
        const pb3 = toBoard3D(pb.x, pb.y);
        const mx = (pa3.x + pb3.x) / 2;
        const mz = (pa3.z + pb3.z) / 2;
        const ox = mx;
        const oz = mz;
        const len = Math.hypot(ox, oz);
        const outX = len > 0.001 ? ox / len : 0;
        const outZ = len > 0.001 ? oz / len : 1;

        // Pier's long axis (local +X) runs radially from the shore outward.
        const harbour = createHarbour(harbor.type === 'specialty' ? harbor.resource : undefined, 1.1);
        harbour.position.set(mx + outX * 0.85, -0.02, mz + outZ * 0.85);
        harbour.rotation.y = Math.atan2(-outZ, outX);
        boardGroup.add(harbour);
      }

      // --- C. Nodes at every vertex + edge hit targets ---
      for (const [vidStr, pos] of Object.entries(board.topology.vertexPos)) {
        const vid = Number(vidStr);
        const v3d = toBoard3D(pos.x, pos.y);
        const node = createNode('standard');
        node.position.set(v3d.x, 0.12, v3d.z);
        boardGroup.add(node);

        const nodeHit = new THREE.Mesh(
          new THREE.CylinderGeometry(0.45, 0.45, 0.6, 12),
          new THREE.MeshBasicMaterial({ visible: false }),
        );
        nodeHit.position.set(v3d.x, 0.5, v3d.z);
        boardGroup.add(nodeHit);
        hitMeshes.push({ mesh: nodeHit, kind: 'vertex', id: vid });
      }

      for (const [eid, endpoints] of Object.entries(board.topology.edgeEndpoints)) {
        const [a, b] = endpoints;
        const pa = board.topology.vertexPos[a];
        const pb = board.topology.vertexPos[b];
        if (!pa || !pb) continue;

        const pa3 = toBoard3D(pa.x, pa.y);
        const pb3 = toBoard3D(pb.x, pb.y);
        const dx = pb3.x - pa3.x;
        const dz = pb3.z - pa3.z;
        const len = Math.hypot(dx, dz);

        const edgeHit = new THREE.Mesh(
          new THREE.BoxGeometry(len * 0.9, 0.5, 0.55),
          new THREE.MeshBasicMaterial({ visible: false }),
        );
        edgeHit.position.set((pa3.x + pb3.x) / 2, 0.4, (pa3.z + pb3.z) / 2);
        edgeHit.rotation.y = -Math.atan2(dz, dx);
        boardGroup.add(edgeHit);
        hitMeshes.push({ mesh: edgeHit, kind: 'edge', id: eid });
      }

      // --- D. Roads ---
      for (const [eid, ownerSeat] of Object.entries(roads)) {
        const endpoints = board.topology.edgeEndpoints[eid];
        if (!endpoints) continue;
        const [a, b] = endpoints;
        const pa = board.topology.vertexPos[a];
        const pb = board.topology.vertexPos[b];
        if (!pa || !pb) continue;

        const pa3 = toBoard3D(pa.x, pa.y);
        const pb3 = toBoard3D(pb.x, pb.y);
        const dx = pb3.x - pa3.x;
        const dz = pb3.z - pa3.z;
        const len = Math.hypot(dx, dz);

        const road = createRoad(playerColorMap.get(ownerSeat) ?? 'red', len * 0.97);
        road.position.set((pa3.x + pb3.x) / 2, 0.13, (pa3.z + pb3.z) / 2);
        road.rotation.y = -Math.atan2(dz, dx);
        boardGroup.add(road);
        hitMeshes.push({ mesh: road, kind: 'builtRoad', id: eid });
      }

      // --- E. Settlements & cities ---
      for (const [vidStr, building] of Object.entries(buildings)) {
        const vid = Number(vidStr);
        const pos = board.topology.vertexPos[vid];
        if (!pos) continue;

        const v3d = toBoard3D(pos.x, pos.y);
        const color = playerColorMap.get(building.seat) ?? 'red';
        const piece = building.type === 'city' ? createCity(color, 1.5) : createSettlement(color, 1.7);
        piece.position.set(v3d.x, 0.12, v3d.z);
        boardGroup.add(piece);
        hitMeshes.push({ mesh: piece, kind: 'builtBuilding', id: vid });
      }

      // --- F. Robber ---
      const robberAxial = parseHexId(robber);
      const rc2d = hexToPixel(robberAxial.q, robberAxial.r);
      const rc3 = toBoard3D(rc2d.x, rc2d.y);
      const robberPawn = createRobber(1.1);
      robberPawn.position.set(rc3.x, 0.28, rc3.z);
      boardGroup.add(robberPawn);

      // --- G. Water ---
      const waterR = islandR + 9;
      const water = new THREE.Mesh(
        new THREE.CylinderGeometry(waterR, waterR, 0.6, 64),
        new THREE.MeshStandardMaterial({ color: 0x063a5e, roughness: 0.23 }),
      );
      water.position.y = -0.32;
      water.receiveShadow = true;
      boardGroup.add(water);

      const waterTile = createWaterTile(waterR - 2);
      waterTile.position.y = -0.02;
      boardGroup.add(waterTile);
    }

    rebuildBoard(propsRef.current.snap);

    // --- Raycasting ---
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const getHit = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);

      const targets = hitMeshes.map((h) => h.mesh);
      const intersects = raycaster.intersectObjects(targets, true);
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

    const onPointerMove = (event: MouseEvent) => {
      const hit = getHit(event);
      container.style.cursor = hit ? 'pointer' : 'default';
    };

    const onClick = (event: MouseEvent) => {
      const hit = getHit(event);
      if (!hit) return;

      const { onVertexClick: vcb, onEdgeClick: ecb, onHexClick: hcb } = propsRef.current;
      if (hit.kind === 'vertex' && typeof hit.id === 'number') vcb?.(hit.id);
      else if (hit.kind === 'edge' && typeof hit.id === 'string') ecb?.(hit.id);
      else if (hit.kind === 'hex' && typeof hit.id === 'string') hcb?.(hit.id);
    };

    renderer.domElement.addEventListener('mousemove', onPointerMove);
    renderer.domElement.addEventListener('click', onClick);

    // --- Animation loop ---
    let animId = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const resizeObserver = new ResizeObserver(() => {
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
    camera.position.set(0, 30, 0.01);
    controls.target.set(0, 0, 0);
    controls.update();
    setCameraMode('top');
  };

  const setIsometricView = () => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    camera.position.set(0, 18, 16);
    controls.target.set(0, 0, 0);
    controls.update();
    setCameraMode('3d');
  };

  return (
    <div className="relative h-full w-full select-none" data-testid="three-board">
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />

      <div className="pointer-events-auto absolute top-4 right-4 flex items-center gap-1.5 rounded-xl border border-sky-500/30 bg-[#071828]/85 p-1.5 shadow-xl backdrop-blur-md">
        <button
          type="button"
          onClick={setIsometricView}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
            cameraMode === '3d'
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'bg-sky-950/70 text-sky-200 hover:bg-sky-800'
          }`}
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
        >
          🧭 2D Map
        </button>
      </div>
    </div>
  );
});
