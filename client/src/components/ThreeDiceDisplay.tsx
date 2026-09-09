// 3D Animated Dice Display for the top turn bar.
// Renders two real 3D bone-white dice with indented pips using Three.js.
// When rolling, the dice vigorously tumble, bounce, and settle with physics.
// Includes realistic Web Audio dice rattle sound on roll!

import { memo, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createDieMesh, getDieTargetRotation } from '../board/threeDice';

export interface ThreeDiceDisplayProps {
  die1: number | null;
  die2: number | null;
  rolling: boolean;
}

/** Synthesize a realistic dice rattle & clack sound via Web Audio API */
function playDiceRattleSound(): void {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const now = ctx.currentTime;

    // 4 rapid clacking bounces
    [0, 0.08, 0.18, 0.28, 0.42].forEach((delay, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320 - idx * 25 + Math.random() * 40, now + delay);
      osc.frequency.exponentialRampToValueAtTime(140, now + delay + 0.05);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(800 + Math.random() * 200, now + delay);

      gain.gain.setValueAtTime(0.35 / (idx + 1), now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.06);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + delay);
      osc.stop(now + delay + 0.07);
    });
  } catch {
    // AudioContext blocked by browser policy before user interaction
  }
}

export const ThreeDiceDisplay = memo(function ThreeDiceDisplay({
  die1,
  die2,
  rolling,
}: ThreeDiceDisplayProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const diceRef = useRef<{ die1: THREE.Mesh; die2: THREE.Mesh } | null>(null);
  const stateRef = useRef({ die1, die2, rolling });
  stateRef.current = { die1, die2, rolling };

  // Play sound when rolling starts
  useEffect(() => {
    if (rolling) {
      playDiceRattleSound();
    }
  }, [rolling]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = 110;
    const height = 48;

    // 1. Scene & Mini Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 50);
    camera.position.set(0, 5.2, 0.1);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 2. Lighting
    const ambient = new THREE.AmbientLight(0xfff8ee, 1.8);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xfffaed, 2.2);
    sun.position.set(5, 10, 4);
    sun.castShadow = true;
    scene.add(sun);

    // 3. Two 3D Dice
    const mesh1 = createDieMesh(1.15);
    const mesh2 = createDieMesh(1.15);
    mesh1.position.set(-1.1, 0, 0);
    mesh2.position.set(1.1, 0, 0);
    scene.add(mesh1);
    scene.add(mesh2);
    diceRef.current = { die1: mesh1, die2: mesh2 };

    // 4. Animation loop
    let animId = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();
      const { die1: val1, die2: val2, rolling: isRolling } = stateRef.current;

      const v1 = val1 ?? 4;
      const v2 = val2 ?? 2;
      const target1 = getDieTargetRotation(v1);
      const target2 = getDieTargetRotation(v2);

      if (isRolling) {
        // Tumble
        mesh1.rotation.x += 0.38;
        mesh1.rotation.y += 0.46;
        mesh1.rotation.z += 0.28;
        mesh1.position.y = Math.abs(Math.sin(elapsed * 22)) * 0.4;

        mesh2.rotation.x += 0.44;
        mesh2.rotation.y += 0.36;
        mesh2.rotation.z += 0.34;
        mesh2.position.y = Math.abs(Math.cos(elapsed * 20)) * 0.4;
      } else {
        // Smoothly settle into exact target faces
        mesh1.rotation.x = THREE.MathUtils.lerp(mesh1.rotation.x, target1.x, 0.2);
        mesh1.rotation.y = THREE.MathUtils.lerp(mesh1.rotation.y, target1.y, 0.2);
        mesh1.rotation.z = THREE.MathUtils.lerp(mesh1.rotation.z, target1.z, 0.2);
        mesh1.position.y = THREE.MathUtils.lerp(mesh1.position.y, 0, 0.2);

        mesh2.rotation.x = THREE.MathUtils.lerp(mesh2.rotation.x, target2.x, 0.2);
        mesh2.rotation.y = THREE.MathUtils.lerp(mesh2.rotation.y, target2.y, 0.2);
        mesh2.rotation.z = THREE.MathUtils.lerp(mesh2.rotation.z, target2.z, 0.2);
        mesh2.position.y = THREE.MathUtils.lerp(mesh2.position.y, 0, 0.2);
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  const sum = (die1 ?? 0) + (die2 ?? 0);

  return (
    <div className="flex items-center gap-1.5" data-testid="dice-display">
      <div
        ref={containerRef}
        className="h-12 w-28 overflow-hidden rounded-xl border border-sky-500/25 bg-[#031422]/80 shadow-inner"
      />
      {sum > 0 ? (
        <span className="font-mono text-sm font-extrabold text-amber-300 drop-shadow">
          = {sum}
        </span>
      ) : null}
    </div>
  );
});
