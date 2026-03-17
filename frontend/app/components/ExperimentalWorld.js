"use client";

import { useEffect, useRef, useState, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text, Billboard } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

import { API, WS } from "@/app/lib/config";

// ── Neon palette ──────────────────────────────────────────────────────────────
const NEON = {
  trading:   "#FF6B35",  // fire orange
  analysis:  "#A855F7",  // electric purple
  data:      "#06B6D4",  // cyber cyan
  risk:      "#F43F5E",  // alarm red
  composite: "#EAB308",  // gold
  default:   "#10B981",  // neon green
};
const neon = (c) => NEON[c] ?? NEON.default;

// ── Deterministic pseudo-random ───────────────────────────────────────────────
const rng = (seed) => ((Math.sin(seed * 127.1 + 311.7) * 43758.5453) % 1 + 1) % 1;

// ── Star field ────────────────────────────────────────────────────────────────
const STAR_DATA = Array.from({ length: 320 }, (_, i) => ({
  x: (rng(i)       - 0.5) * 380,
  y:  rng(i + 100) * 90  + 18,
  z: (rng(i + 200) - 0.5) * 380,
  s:  rng(i + 300) * 0.28 + 0.08,
}));

function StarField() {
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const ref   = useRef();
  const twinkleRef = useRef(0);
  useEffect(() => {
    const m = ref.current; if (!m) return;
    STAR_DATA.forEach((s, i) => {
      dummy.position.set(s.x, s.y, s.z);
      dummy.scale.setScalar(s.s);
      dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [dummy]);
  useFrame((state) => {
    const m = ref.current; if (!m) return;
    twinkleRef.current = state.clock.elapsedTime;
    // Slowly pulse overall star brightness
    m.material.opacity = 0.7 + Math.sin(twinkleRef.current * 0.4) * 0.2;
  });
  return (
    <instancedMesh ref={ref} args={[null, null, STAR_DATA.length]}>
      <sphereGeometry args={[1, 4, 4]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
    </instancedMesh>
  );
}

// ── Playa floor — Black Rock Desert: flat white alkaline lake bed ─────────────
// Cracked hexagonal mud pattern via instanced thin boxes
const CRACK_DATA = (() => {
  const cracks = [];
  for (let xi = -18; xi <= 18; xi++) {
    for (let zi = -18; zi <= 18; zi++) {
      const x = xi * 5.5 + (zi % 2 === 0 ? 0 : 2.75);
      const z = zi * 4.8;
      if (x * x + z * z > 210 * 210) continue;
      // 3 crack lines per hex cell
      cracks.push({ x, z, r: 0,           l: 5.2 });
      cracks.push({ x, z, r: Math.PI / 3, l: 5.2 });
      cracks.push({ x, z, r: Math.PI * 2 / 3, l: 5.2 });
    }
  }
  return cracks;
})();

function PlayaFloor() {
  const dummy  = useMemo(() => new THREE.Object3D(), []);
  const ref    = useRef();
  useEffect(() => {
    const m = ref.current; if (!m) return;
    CRACK_DATA.forEach((c, i) => {
      dummy.position.set(c.x, 0.02, c.z);
      dummy.rotation.set(-Math.PI / 2, 0, c.r);
      dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [dummy]);

  return (
    <>
      {/* Base playa — white alkaline surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[500, 500]} />
        <meshLambertMaterial color="#d4cdc0" />
      </mesh>
      {/* Crack lines */}
      {CRACK_DATA.length > 0 && (
        <instancedMesh ref={ref} args={[null, null, CRACK_DATA.length]}>
          <planeGeometry args={[0.08, CRACK_DATA[0]?.l ?? 5] } />
          <meshBasicMaterial color="#b0a898" transparent opacity={0.55} side={THREE.DoubleSide} />
        </instancedMesh>
      )}
      {/* 5-sided Man platform base (pentagon) */}
      <mesh rotation={[-Math.PI / 2, 0, Math.PI / 10]} position={[0, 0.03, 0]}>
        <circleGeometry args={[9.5, 5]} />
        <meshLambertMaterial color="#c8c0b0" />
      </mesh>
      {/* Raised platform steps — scaled up to support bigger Man */}
      <mesh position={[0, 0.15, 0]}><cylinderGeometry args={[7.0, 7.6, 0.3, 5]} /><meshLambertMaterial color="#bfb8a8" /></mesh>
      <mesh position={[0, 0.35, 0]}><cylinderGeometry args={[5.2, 5.6, 0.3, 5]} /><meshLambertMaterial color="#b8b0a0" /></mesh>
      <mesh position={[0, 0.55, 0]}><cylinderGeometry args={[3.2, 3.6, 0.4, 5]} /><meshLambertMaterial color="#b0a898" /></mesh>
      <mesh position={[0, 0.82, 0]}><cylinderGeometry args={[2.0, 2.4, 0.4, 5]} /><meshLambertMaterial color="#a8a090" /></mesh>
      {/* Concentric Esplanade rings — the streets */}
      {[12, 18, 24].map((r, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <ringGeometry args={[r - 0.18, r + 0.18, 72]} />
          <meshBasicMaterial color="#c0b8a8" transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* Radial streets (like spokes of a clock) */}
      {Array.from({ length: 10 }, (_, i) => {
        const a = ((i / 10) * Math.PI * 1.4) - Math.PI * 0.2; // horseshoe, 10–2 o'clock open
        return (
          <mesh key={i} rotation={[-Math.PI / 2, 0, a]} position={[0, 0.015, 0]}>
            <planeGeometry args={[0.35, 26]} />
            <meshBasicMaterial color="#c0b8a8" transparent opacity={0.5} />
          </mesh>
        );
      })}
    </>
  );
}

// ── The Man — iconic Burning Man humanoid figure on tall wooden scaffold ───────
const TOWER_H  = 7.0;   // scaffold tower height
const MAN_Y    = 1.02;  // top of platform steps (4-step platform now)
const MAN_BASE = MAN_Y + TOWER_H; // ~8.02 — where Man figure stands

function TheMan({ anyActive }) {
  const fireRef = useRef([]);
  const beamRef = useRef();
  const glowRef = useRef();
  const lArmRef = useRef();
  const rArmRef = useRef();
  const NUM_FIRE = 16;

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    fireRef.current.forEach((m, i) => {
      if (!m) return;
      const phase = t * (1.1 + i * 0.1) + i * 0.85;
      m.position.y = MAN_Y + 0.4 + Math.sin(phase) * 1.0 + i * 0.6;
      m.scale.setScalar(0.5 + Math.abs(Math.sin(phase * 0.8)) * 0.7);
      m.material.opacity = 0.5 + Math.sin(phase * 1.2) * 0.3;
    });
    if (beamRef.current) beamRef.current.material.opacity = 0.08 + Math.sin(t * 0.5) * 0.06;
    if (glowRef.current) glowRef.current.material.opacity = anyActive
      ? 0.18 + Math.sin(t * 1.6) * 0.08
      : 0.06 + Math.sin(t * 0.9) * 0.03;
    // Arms raise when agents are active
    const armTarget = anyActive ? -1.1 : -0.25;
    if (lArmRef.current) lArmRef.current.rotation.z += (armTarget - lArmRef.current.rotation.z) * 0.025;
    if (rArmRef.current) rArmRef.current.rotation.z += (-armTarget - rArmRef.current.rotation.z) * 0.025;
  });

  return (
    <group>
      {/* ── Wooden scaffold tower ── */}
      {/* 4 corner posts */}
      {[[-1.8,-1.8],[1.8,-1.8],[-1.8,1.8],[1.8,1.8]].map(([x,z], i) => (
        <mesh key={i} position={[x, MAN_Y + TOWER_H / 2, z]}>
          <cylinderGeometry args={[0.15, 0.20, TOWER_H, 6]} />
          <meshLambertMaterial color="#7a5028" />
        </mesh>
      ))}
      {/* Horizontal ring beams at 3 heights */}
      {[MAN_Y + 1.8, MAN_Y + 3.8, MAN_Y + 5.8].map((h, li) => (
        <group key={li}>
          <mesh position={[0, h, -1.8]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.07, 0.07, 3.6, 5]} />
            <meshLambertMaterial color="#8a6038" />
          </mesh>
          <mesh position={[0, h, 1.8]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.07, 0.07, 3.6, 5]} />
            <meshLambertMaterial color="#8a6038" />
          </mesh>
          <mesh position={[-1.8, h, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 3.6, 5]} />
            <meshLambertMaterial color="#8a6038" />
          </mesh>
          <mesh position={[1.8, h, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 3.6, 5]} />
            <meshLambertMaterial color="#8a6038" />
          </mesh>
        </group>
      ))}

      {/* ── The Man figure (4× scale atop tower) ── */}
      <group position={[0, MAN_BASE, 0]}>
        {/* Legs */}
        <mesh position={[-0.72, 2.08, 0]}>
          <cylinderGeometry args={[0.36, 0.44, 4.16, 7]} />
          <meshLambertMaterial color="#c8a060" />
        </mesh>
        <mesh position={[0.72, 2.08, 0]}>
          <cylinderGeometry args={[0.36, 0.44, 4.16, 7]} />
          <meshLambertMaterial color="#c8a060" />
        </mesh>
        {/* Body */}
        <mesh position={[0, 5.12, 0]}>
          <cylinderGeometry args={[0.88, 1.12, 2.88, 8]} />
          <meshLambertMaterial color="#d4aa70" />
        </mesh>
        {/* Left arm — rotates independently */}
        <mesh ref={lArmRef} position={[-1.92, 6.08, 0]} rotation={[0, 0, 0.5]}>
          <cylinderGeometry args={[0.28, 0.36, 2.88, 6]} />
          <meshLambertMaterial color="#c8a060" />
        </mesh>
        {/* Right arm */}
        <mesh ref={rArmRef} position={[1.92, 6.08, 0]} rotation={[0, 0, -0.5]}>
          <cylinderGeometry args={[0.28, 0.36, 2.88, 6]} />
          <meshLambertMaterial color="#c8a060" />
        </mesh>
        {/* Head */}
        <mesh position={[0, 7.44, 0]}>
          <sphereGeometry args={[0.88, 10, 10]} />
          <meshLambertMaterial color="#d4aa70" />
        </mesh>
      </group>

      {/* ── Fire ring at base of platform ── */}
      {Array.from({ length: NUM_FIRE }, (_, i) => {
        const a = (i / NUM_FIRE) * Math.PI * 2;
        const r = 2.8 + (i % 3) * 0.9;
        return (
          <mesh key={i} ref={el => { fireRef.current[i] = el; }}
            position={[Math.cos(a) * r, MAN_Y, Math.sin(a) * r]}>
            <coneGeometry args={[0.22, 2.8, 5]} />
            <meshBasicMaterial
              color={i % 3 === 0 ? "#FF6B35" : i % 3 === 1 ? "#FF4500" : "#FFD700"}
              transparent opacity={0.65} />
          </mesh>
        );
      })}

      {/* ── Glow disc at base ── */}
      <mesh ref={glowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, MAN_Y + 0.08, 0]}>
        <circleGeometry args={[11, 48]} />
        <meshBasicMaterial color="#FF6B35" transparent opacity={0.06} />
      </mesh>

      {/* ── Sky beam ── */}
      <mesh ref={beamRef} position={[0, MAN_BASE + 28, 0]}>
        <cylinderGeometry args={[0.12, 1.2, 50, 6]} />
        <meshBasicMaterial color="#FF8844" transparent opacity={0.08} />
      </mesh>

      <pointLight position={[0, MAN_BASE + 8, 0]}
        intensity={anyActive ? 18 : 10} color="#FF8844" distance={45} decay={2} />
    </group>
  );
}

// ── Playa dust — floating alkaline particles drifting low ─────────────────────
const NUM_DUST = 260;
function PlayaDust() {
  const ref   = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const data  = useRef(
    Array.from({ length: NUM_DUST }, (_, i) => ({
      x:  (rng(i + 500) - 0.5) * 150,
      y:   rng(i + 600) * 4.5,
      z:  (rng(i + 700) - 0.5) * 150,
      s:   rng(i + 800) * 0.16 + 0.04,
      vy:  rng(i + 900) * 0.005 + 0.001,
      vx: (rng(i + 1000) - 0.5) * 0.003,
    }))
  );
  useFrame(() => {
    const m = ref.current; if (!m) return;
    data.current.forEach((d, i) => {
      d.y += d.vy; d.x += d.vx;
      if (d.y > 5.0) d.y = 0.0;
      dummy.position.set(d.x, d.y, d.z);
      dummy.scale.setScalar(d.s);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[null, null, NUM_DUST]}>
      <sphereGeometry args={[1, 3, 3]} />
      <meshBasicMaterial color="#e8ddd0" transparent opacity={0.20} depthWrite={false} />
    </instancedMesh>
  );
}

// ── Esplanade camp clusters along the horseshoe arc ───────────────────────────
const CAMP_POSITIONS = Array.from({ length: 22 }, (_, i) => {
  const a = ((i / 22) * Math.PI * 1.4) - Math.PI * 0.2;
  const r = 28 + rng(i + 300) * 4;
  return { x: Math.cos(a) * r, z: Math.sin(a) * r, seed: i + 50 };
});

function CampCluster({ x, z, seed }) {
  const hue   = Math.floor(rng(seed) * 360);
  const hue2  = Math.floor(rng(seed + 1) * 360);
  return (
    <group position={[x, 0, z]}>
      {/* Shade canopy */}
      <mesh position={[0, 1.4, 0]} rotation={[-Math.PI / 2, 0, rng(seed) * Math.PI]}>
        <planeGeometry args={[4.5, 3.5]} />
        <meshLambertMaterial color={`hsl(${hue},45%,48%)`} side={THREE.DoubleSide} />
      </mesh>
      {/* Canopy poles */}
      {[[-1.9,-1.4],[1.9,-1.4],[-1.9,1.4],[1.9,1.4]].map(([px,pz], i) => (
        <mesh key={i} position={[px, 0.7, pz]}>
          <cylinderGeometry args={[0.05, 0.05, 1.4, 5]} />
          <meshLambertMaterial color="#888" />
        </mesh>
      ))}
      {/* Tent/RV body */}
      <mesh position={[0.3, 0.55, -1.8]}>
        <boxGeometry args={[3.2, 1.1, 1.6]} />
        <meshLambertMaterial color={`hsl(${hue2},30%,38%)`} />
      </mesh>
      {/* Roof ridge */}
      <mesh position={[0.3, 1.22, -1.8]} rotation={[0, 0, 0]}>
        <coneGeometry args={[1.7, 0.55, 4]} />
        <meshLambertMaterial color={`hsl(${hue2},35%,44%)`} />
      </mesh>
      {/* Camp light */}
      <pointLight position={[0, 1.0, 0]} intensity={0.5}
        color={`hsl(${hue},80%,65%)`} distance={5} decay={2} />
    </group>
  );
}

function EsplanadeCity() {
  return (
    <>
      {CAMP_POSITIONS.map((c, i) => <CampCluster key={i} x={c.x} z={c.z} seed={c.seed} />)}
    </>
  );
}

// ── Deep playa art — large sculptures in the open 10–2 o'clock area ──────────
function DeepPlayaArt() {
  const spin1 = useRef();
  const spin2 = useRef();
  const spin3 = useRef();
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (spin1.current) spin1.current.rotation.y = t * 0.25;
    if (spin2.current) spin2.current.rotation.z = t * 0.18;
    if (spin3.current) spin3.current.rotation.y = -t * 0.2;
  });

  return (
    <>
      {/* Giant arch — northwest playa */}
      <group position={[-38, 0, -18]}>
        <mesh position={[-2.5, 3.5, 0]} rotation={[0, 0, 0.12]}>
          <cylinderGeometry args={[0.5, 0.6, 7.0, 8]} />
          <meshLambertMaterial color="#c8a870" />
        </mesh>
        <mesh position={[2.5, 3.5, 0]} rotation={[0, 0, -0.12]}>
          <cylinderGeometry args={[0.5, 0.6, 7.0, 8]} />
          <meshLambertMaterial color="#c8a870" />
        </mesh>
        <mesh position={[0, 7.2, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.4, 0.4, 5.2, 8]} />
          <meshLambertMaterial color="#d4b880" />
        </mesh>
        <pointLight position={[0, 5, 0]} intensity={1.5} color="#ffe8a0" distance={10} decay={2} />
      </group>

      {/* Tall twisted tower — northeast playa */}
      <group position={[36, 0, -20]}>
        <group ref={spin1}>
          {[0, 1, 2, 3, 4].map(i => (
            <mesh key={i} position={[Math.sin(i * 1.3) * 0.8, i * 2.0, Math.cos(i * 1.3) * 0.8]}>
              <boxGeometry args={[0.9, 1.8, 0.9]} />
              <meshLambertMaterial color={`hsl(${30 + i * 15},60%,50%)`} />
            </mesh>
          ))}
        </group>
        <pointLight position={[0, 5, 0]} intensity={1.2} color="#ff9944" distance={10} decay={2} />
      </group>

      {/* Giant golden orb on pedestal — northwest deep */}
      <group position={[-24, 0, -38]}>
        <mesh position={[0, 1.0, 0]}>
          <cylinderGeometry args={[1.2, 1.6, 2.0, 8]} />
          <meshLambertMaterial color="#a09070" />
        </mesh>
        <group ref={spin2} position={[0, 4.0, 0]}>
          <mesh>
            <sphereGeometry args={[2.2, 14, 14]} />
            <meshLambertMaterial color="#d4a830" emissive="#c89020" emissiveIntensity={0.3} />
          </mesh>
          <mesh rotation={[Math.PI / 4, 0, 0]}>
            <torusGeometry args={[2.8, 0.18, 8, 36]} />
            <meshBasicMaterial color="#FFD700" transparent opacity={0.7} />
          </mesh>
        </group>
        <pointLight position={[0, 4, 0]} intensity={2.5} color="#FFD700" distance={14} decay={2} />
      </group>

      {/* Cluster of standing stones — northeast deep */}
      <group position={[28, 0, -40]}>
        {[0, 1, 2, 3, 4].map(i => {
          const a = (i / 5) * Math.PI * 2;
          const r = 2 + rng(i + 40) * 1.5;
          const h = 3 + rng(i + 41) * 4;
          return (
            <mesh key={i} position={[Math.cos(a) * r, h / 2, Math.sin(a) * r]}
              rotation={[0, rng(i + 42) * 0.4, rng(i + 43) * 0.15 - 0.075]}>
              <boxGeometry args={[0.8 + rng(i) * 0.4, h, 0.5 + rng(i + 1) * 0.3]} />
              <meshLambertMaterial color={`hsl(30,20%,${45 + i * 5}%)`} />
            </mesh>
          );
        })}
        <pointLight position={[0, 3, 0]} intensity={1.0} color="#c0d0ff" distance={10} decay={2} />
      </group>

      {/* Neon skeleton sculpture — far north */}
      <group position={[0, 0, -62]} ref={spin3}>
        <mesh position={[0, 3, 0]}>
          <torusGeometry args={[3.5, 0.22, 10, 40]} />
          <meshBasicMaterial color="#A855F7" transparent opacity={0.85} />
        </mesh>
        <mesh position={[0, 3, 0]}>
          <torusGeometry args={[2.2, 0.15, 10, 30]} />
          <meshBasicMaterial color="#06B6D4" transparent opacity={0.75} />
        </mesh>
        <mesh position={[0, 6, 0]}>
          <sphereGeometry args={[0.9, 8, 8]} />
          <meshBasicMaterial color="#A855F7" transparent opacity={0.9} />
        </mesh>
        <pointLight position={[0, 3, 0]} intensity={3} color="#A855F7" distance={14} decay={2} />
      </group>
    </>
  );
}

// ── The Temple — ornate wooden structure at 12 o'clock (north) ────────────────
function TheTemple() {
  const glowRef = useRef();
  useFrame((s) => {
    if (glowRef.current) glowRef.current.material.opacity = 0.08 + Math.sin(s.clock.elapsedTime * 0.6) * 0.04;
  });
  return (
    <group position={[0, 0, -42]}>
      {/* Foundation */}
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[10, 0.2, 10]} />
        <meshLambertMaterial color="#c8b898" />
      </mesh>
      {/* Main hall */}
      <mesh position={[0, 1.4, 0]}>
        <boxGeometry args={[6.5, 2.8, 6.5]} />
        <meshLambertMaterial color="#d4c8a8" />
      </mesh>
      {/* Roof pyramid */}
      <mesh position={[0, 3.3, 0]}>
        <coneGeometry args={[4.8, 2.0, 4]} />
        <meshLambertMaterial color="#c0b090" />
      </mesh>
      {/* Spire */}
      <mesh position={[0, 4.8, 0]}>
        <cylinderGeometry args={[0.06, 0.14, 2.2, 6]} />
        <meshLambertMaterial color="#a89878" />
      </mesh>
      {/* Corner pillars */}
      {[[-2.8,-2.8],[2.8,-2.8],[-2.8,2.8],[2.8,2.8]].map(([x,z], i) => (
        <mesh key={i} position={[x, 1.5, z]}>
          <cylinderGeometry args={[0.22, 0.26, 3.0, 8]} />
          <meshLambertMaterial color="#c8b898" />
        </mesh>
      ))}
      {/* Inner light */}
      <mesh ref={glowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.15, 0]}>
        <circleGeometry args={[7, 36]} />
        <meshBasicMaterial color="#ffe8a0" transparent opacity={0.08} />
      </mesh>
      <pointLight position={[0, 2, 0]} intensity={1.8} color="#ffe8a0" distance={14} decay={2} />
      {/* Label */}
      <Billboard position={[0, 7.5, 0]} follow lockX={false} lockZ={false}>
        <Text fontSize={0.32} color="#d4c8a8" anchorX="center"
          outlineWidth={0.04} outlineColor="#000">THE TEMPLE</Text>
      </Billboard>
    </group>
  );
}

// ── Mutant art vehicle — slowly patrols the playa ─────────────────────────────
function MutantVehicle({ seed }) {
  const ref   = useRef();
  const color = WANDER_COLORS[seed % WANDER_COLORS.length];
  const speed = 0.008 + rng(seed) * 0.006;
  const orbit = 19 + rng(seed + 1) * 8;
  const phase = rng(seed + 2) * Math.PI * 2;

  useFrame((s) => {
    if (!ref.current) return;
    const t = s.clock.elapsedTime * speed + phase;
    const x = Math.cos(t) * orbit;
    const z = Math.sin(t) * orbit;
    ref.current.position.set(x, 0.35, z);
    ref.current.rotation.y = -t + Math.PI / 2;
  });

  return (
    <group ref={ref}>
      {/* Body */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[2.2, 0.55, 1.0]} />
        <meshLambertMaterial color={color} emissive={color} emissiveIntensity={0.3} />
      </mesh>
      {/* Wheels */}
      {[[-0.8,-0.3],[ 0.8,-0.3],[-0.8, 0.3],[ 0.8, 0.3]].map(([x,z], i) => (
        <mesh key={i} position={[x, -0.22, z]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.22, 0.22, 0.16, 8]} />
          <meshLambertMaterial color="#222" />
        </mesh>
      ))}
      {/* Headlight glow */}
      <pointLight position={[1.2, 0.2, 0]} intensity={1.2} color={color} distance={5} decay={2} />
    </group>
  );
}

// ── Agent art installations ───────────────────────────────────────────────────
function TradingInstallation({ color, active, requests }) {
  const spinRef = useRef();
  const glowRef = useRef();
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (spinRef.current) spinRef.current.rotation.y = t * (active ? 2.0 : 0.6);
    if (glowRef.current) glowRef.current.material.emissiveIntensity = active ? 1.2 + Math.sin(t * 4) * 0.5 : 0.4 + Math.sin(t) * 0.15;
  });
  const height = 1.5 + Math.min(requests / 20, 3) * 0.8;
  return (
    <group>
      {/* Totem pole shaft */}
      <mesh ref={glowRef} position={[0, height / 2, 0]}>
        <cylinderGeometry args={[0.18, 0.24, height, 6]} />
        <meshLambertMaterial color={color} emissive={color} emissiveIntensity={0.4} />
      </mesh>
      {/* Spinning energy wheel */}
      <group ref={spinRef} position={[0, height + 0.6, 0]}>
        {[0, 1, 2].map(i => (
          <mesh key={i} rotation={[i * Math.PI / 3, 0, 0]}>
            <torusGeometry args={[0.7, 0.06, 8, 24]} />
            <meshBasicMaterial color={color} />
          </mesh>
        ))}
        <mesh><sphereGeometry args={[0.22, 8, 8]} /><meshBasicMaterial color={color} /></mesh>
      </group>
      <pointLight position={[0, height + 0.6, 0]} intensity={active ? 3 : 1} color={color} distance={5} decay={2} />
    </group>
  );
}

function AnalysisInstallation({ color, active, requests }) {
  const floatRef = useRef();
  const orbitRef = useRef();
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (floatRef.current) floatRef.current.position.y = 2.2 + Math.sin(t * 0.8) * 0.3;
    if (orbitRef.current) orbitRef.current.rotation.y = t * (active ? 1.4 : 0.4);
  });
  return (
    <group>
      <mesh position={[0, 0.3, 0]}><cylinderGeometry args={[0.8, 0.9, 0.5, 8]} /><meshLambertMaterial color="#1a0a2e" /></mesh>
      <group ref={floatRef} position={[0, 2.2, 0]}>
        <mesh rotation={[0.5, 0, 0.3]}><octahedronGeometry args={[0.55, 0]} /><meshBasicMaterial color={color} transparent opacity={0.85} /></mesh>
        <group ref={orbitRef}>
          {[0, 1, 2].map(i => {
            const a = (i / 3) * Math.PI * 2;
            return <mesh key={i} position={[Math.cos(a) * 1.0, 0, Math.sin(a) * 1.0]}><sphereGeometry args={[0.1, 6, 6]} /><meshBasicMaterial color={color} /></mesh>;
          })}
        </group>
      </group>
      <pointLight position={[0, 2.5, 0]} intensity={active ? 2.5 : 0.8} color={color} distance={5} decay={2} />
    </group>
  );
}

function DataInstallation({ color, active, requests }) {
  const refs = useRef([]);
  useFrame((s) => {
    refs.current.forEach((m, i) => {
      if (!m) return;
      const t = (s.clock.elapsedTime * (active ? 1.8 : 0.7) + i * 0.6) % 1;
      m.material.opacity = 0.3 + Math.sin(t * Math.PI) * 0.7;
    });
  });
  const tiers = 3 + Math.min(Math.floor(requests / 15), 3);
  return (
    <group>
      {Array.from({ length: tiers }, (_, i) => (
        <group key={i} position={[0, 0.5 + i * 0.7, 0]}>
          <mesh rotation={[Math.PI / 2, 0, i * 0.4]}>
            <torusGeometry args={[0.6 + i * 0.15, 0.04 + i * 0.01, 8, 32]} />
            <meshBasicMaterial color={color} />
          </mesh>
          <mesh ref={el => { refs.current[i] = el; }} rotation={[Math.PI / 2, 0, i * 0.4]}>
            <torusGeometry args={[0.6 + i * 0.15, 0.08, 8, 32, Math.PI * 0.6]} />
            <meshBasicMaterial color={color} transparent opacity={0.6} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.3, 0]}><cylinderGeometry args={[0.1, 0.12, 0.6, 6]} /><meshLambertMaterial color={color} /></mesh>
      <pointLight position={[0, 1.5, 0]} intensity={active ? 2.5 : 0.8} color={color} distance={5} decay={2} />
    </group>
  );
}

function RiskInstallation({ color, active, requests }) {
  const spikeRef = useRef();
  const flashRef = useRef();
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (spikeRef.current) spikeRef.current.rotation.y = t * (active ? 1.6 : 0.3);
    if (flashRef.current) flashRef.current.material.opacity = active
      ? 0.4 + Math.abs(Math.sin(t * 3.5)) * 0.6
      : 0.15 + Math.sin(t * 0.8) * 0.1;
  });
  return (
    <group>
      <mesh position={[0, 0.3, 0]}><boxGeometry args={[1.2, 0.5, 1.2]} /><meshLambertMaterial color="#1a0008" /></mesh>
      <group ref={spikeRef} position={[0, 0.8, 0]}>
        {[0, 1, 2, 3, 4, 5].map(i => {
          const a = (i / 6) * Math.PI * 2;
          const r = 0.5 + (i % 2) * 0.2;
          return (
            <mesh key={i} position={[Math.cos(a) * r, 0, Math.sin(a) * r]}
              rotation={[Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4]}>
              <coneGeometry args={[0.1, 0.9 + (i % 2) * 0.4, 5]} />
              <meshBasicMaterial color={color} />
            </mesh>
          );
        })}
      </group>
      <mesh ref={flashRef} position={[0, 1.8, 0]}>
        <sphereGeometry args={[0.35, 8, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} />
      </mesh>
      <pointLight position={[0, 1.5, 0]} intensity={active ? 4 : 1} color={color} distance={6} decay={2} />
    </group>
  );
}

function DefaultInstallation({ color, active }) {
  const spinRef = useRef();
  useFrame((s) => { if (spinRef.current) spinRef.current.rotation.y = s.clock.elapsedTime * 0.5; });
  return (
    <group>
      <group ref={spinRef} position={[0, 1.2, 0]}>
        <mesh><boxGeometry args={[0.7, 0.7, 0.7]} /><meshBasicMaterial color={color} transparent opacity={0.8} /></mesh>
        <mesh rotation={[Math.PI / 4, Math.PI / 4, 0]}><boxGeometry args={[0.7, 0.7, 0.7]} /><meshBasicMaterial color={color} transparent opacity={0.4} /></mesh>
      </group>
      <pointLight position={[0, 1.2, 0]} intensity={active ? 2 : 0.6} color={color} distance={4} decay={2} />
    </group>
  );
}

const INSTALLATIONS = {
  trading:  TradingInstallation,
  analysis: AnalysisInstallation,
  data:     DataInstallation,
  risk:     RiskInstallation,
};

function AgentInstallation({ agent, position, active, requests, selected, onClick }) {
  const color     = neon(agent.category);
  const Install   = INSTALLATIONS[agent.category] ?? DefaultInstallation;
  const glowRef   = useRef();

  useFrame((s) => {
    if (glowRef.current) glowRef.current.material.opacity = selected
      ? 0.5 + Math.sin(s.clock.elapsedTime * 2) * 0.2
      : active ? 0.25 : 0.08;
  });

  return (
    <group position={[position.x, 0, position.z]}
      onClick={(e) => { e.stopPropagation(); onClick(agent); }}>

      {/* Glow disc at base */}
      <mesh ref={glowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <circleGeometry args={[2.0, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.08} side={THREE.DoubleSide} />
      </mesh>

      {/* Sand mound base */}
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[1.2, 1.4, 0.2, 10]} />
        <meshLambertMaterial color="#3a2510" />
      </mesh>

      <Install color={color} active={active} requests={requests ?? 0} />

      {/* Name label */}
      <Billboard position={[0, 3.8, 0]} follow lockX={false} lockZ={false}>
        <Text fontSize={0.24} color={color} anchorX="center"
          outlineWidth={0.04} outlineColor="#000">
          {agent.name.length > 14 ? agent.name.slice(0, 13) + "…" : agent.name}
        </Text>
      </Billboard>

      {selected && (
        <Billboard position={[0, 4.5, 0]} follow lockX={false} lockZ={false}>
          <Text fontSize={0.18} color="#aaa" anchorX="center">
            {requests ?? 0} calls · ${((agent.price_per_request ?? 0) * (requests ?? 0)).toFixed(3)} earned
          </Text>
        </Billboard>
      )}
    </group>
  );
}

// ── Signal connection between active installation and fire ────────────────────
function SignalBeam({ from, to, color }) {
  const ref  = useRef();
  const t0   = useRef(Math.random());
  useFrame((s) => {
    if (ref.current) ref.current.material.opacity = 0.3 + Math.sin((s.clock.elapsedTime + t0.current) * 3) * 0.25;
  });
  const mid    = new THREE.Vector3((from.x + to.x) / 2, 3.5, (from.z + to.z) / 2);
  const start  = new THREE.Vector3(from.x, 1.5, from.z);
  const end    = new THREE.Vector3(to.x,   2.0, to.z);
  const points = [start, mid, end];
  const curve  = new THREE.CatmullRomCurve3(points);
  const pts    = curve.getPoints(20);
  return (
    <group ref={ref}>
      {pts.slice(1).map((p, i) => {
        const prev = pts[i];
        const mid2 = new THREE.Vector3().lerpVectors(prev, p, 0.5);
        const len  = prev.distanceTo(p);
        const dir  = new THREE.Vector3().subVectors(p, prev).normalize();
        const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        return (
          <mesh key={i} position={mid2} quaternion={quat}>
            <cylinderGeometry args={[0.04, 0.04, len, 4]} />
            <meshBasicMaterial color={color} transparent opacity={0.55} />
          </mesh>
        );
      })}
    </group>
  );
}

// ── Festival wanderer NPCs with light trails ──────────────────────────────────
const WANDER_COLORS = ["#FF6B35","#A855F7","#06B6D4","#F43F5E","#EAB308","#10B981"];

function FestivalWalker({ seed, positions }) {
  const ref       = useRef();
  const trailRef  = useRef([]);
  const state     = useRef({
    pos:   new THREE.Vector3(rng(seed) * 20 - 10, 0, rng(seed + 1) * 20 - 10),
    target:new THREE.Vector3(0, 0, 0),
    speed: 0.02 + rng(seed + 2) * 0.015,
    color: WANDER_COLORS[seed % WANDER_COLORS.length],
    trail: [],
  });

  useFrame(() => {
    const s   = state.current;
    const pos = s.pos;

    // Pick new target if reached
    if (pos.distanceTo(s.target) < 0.6) {
      if (positions.length > 0) {
        const t = positions[Math.floor(rng(Date.now() * 0.0001 + seed) * positions.length)];
        s.target.set(t.x + (rng(seed + Date.now() * 0.00001) - 0.5) * 2, 0, t.z + (rng(seed + 1 + Date.now() * 0.00001) - 0.5) * 2);
      }
    }

    const dir = new THREE.Vector3().subVectors(s.target, pos).normalize();
    pos.addScaledVector(dir, s.speed);

    if (ref.current) {
      ref.current.position.set(pos.x, 0.25, pos.z);
      ref.current.lookAt(s.target.x, 0.25, s.target.z);
    }

    // Update trail
    s.trail.unshift({ x: pos.x, z: pos.z });
    if (s.trail.length > 12) s.trail.pop();
  });

  const color = state.current.color;

  return (
    <group ref={ref}>
      {/* Body */}
      <mesh position={[0, 0.2, 0]}><boxGeometry args={[0.22, 0.38, 0.18]} /><meshBasicMaterial color={color} /></mesh>
      {/* Head */}
      <mesh position={[0, 0.52, 0]}><sphereGeometry args={[0.13, 6, 6]} /><meshBasicMaterial color="#f5d0a0" /></mesh>
      {/* Glow aura */}
      <mesh position={[0, 0.3, 0]}>
        <sphereGeometry args={[0.28, 8, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.18} />
      </mesh>
      <pointLight position={[0, 0.3, 0]} intensity={0.6} color={color} distance={2} decay={2} />
    </group>
  );
}

// ── Night sky atmosphere ──────────────────────────────────────────────────────
function NightMoon() {
  return (
    <group position={[-80, 70, -120]}>
      <mesh>
        <sphereGeometry args={[7, 12, 10]} />
        <meshBasicMaterial color="#e8e0c8" transparent opacity={0.92} />
      </mesh>
      <mesh>
        <sphereGeometry args={[10, 12, 10]} />
        <meshBasicMaterial color="#e8e0c8" transparent opacity={0.08} />
      </mesh>
    </group>
  );
}

// ── Neon totem posts at circle perimeter ─────────────────────────────────────
const TOTEM_DATA = Array.from({ length: 12 }, (_, i) => ({
  angle: (i / 12) * Math.PI * 2,
  color: WANDER_COLORS[i % WANDER_COLORS.length],
  h:     3 + rng(i + 80) * 2.5,
}));

function NeonTotems() {
  const refs = useRef([]);
  useFrame((s) => {
    refs.current.forEach((m, i) => {
      if (!m) return;
      m.material.opacity = 0.6 + Math.sin(s.clock.elapsedTime * 1.2 + i * 0.8) * 0.3;
    });
  });
  const R = 27;
  return (
    <>
      {TOTEM_DATA.map((t, i) => (
        <group key={i} position={[Math.cos(t.angle) * R, 0, Math.sin(t.angle) * R]}>
          <mesh position={[0, t.h / 2, 0]}>
            <cylinderGeometry args={[0.08, 0.1, t.h, 6]} />
            <meshLambertMaterial color="#1a1a1a" />
          </mesh>
          <mesh ref={el => { refs.current[i] = el; }} position={[0, t.h + 0.3, 0]}>
            <sphereGeometry args={[0.22, 8, 8]} />
            <meshBasicMaterial color={t.color} transparent opacity={0.8} />
          </mesh>
          <pointLight position={[0, t.h + 0.3, 0]} intensity={0.8} color={t.color} distance={4} decay={2} />
        </group>
      ))}
    </>
  );
}

// ── World event banner ────────────────────────────────────────────────────────
function EventBanner({ event }) {
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState(null);
  useEffect(() => {
    if (!event) return;
    setCurrent(event); setVisible(true);
    const t = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(t);
  }, [event]);
  if (!visible || !current) return null;
  return (
    <div style={{
      position: "absolute", top: 18, left: "50%", transform: "translateX(-50%)",
      background: `${current.color}22`, border: `2px solid ${current.color}`,
      borderRadius: 12, padding: "10px 28px",
      color: current.color, fontSize: 15, fontWeight: 800,
      fontFamily: "inherit", pointerEvents: "none", zIndex: 100,
      textShadow: `0 0 12px ${current.color}`,
      boxShadow: `0 0 24px ${current.color}44`,
    }}>
      {current.label}
    </div>
  );
}

// ── Selected agent HUD ────────────────────────────────────────────────────────
function AgentHUD({ agent, metrics, onClose }) {
  if (!agent) return null;
  const color = neon(agent.category);
  const m = metrics[agent.id] || {};
  return (
    <div style={{
      position: "absolute", top: 16, right: 16, width: 220,
      background: "rgba(8,4,20,0.92)", border: `1px solid ${color}60`,
      borderRadius: 12, padding: 16, color: "#fff",
      fontFamily: "inherit", zIndex: 50,
      boxShadow: `0 0 20px ${color}33`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ color, fontWeight: 800, fontSize: 14 }}>{agent.name}</span>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 16 }}>✕</button>
      </div>
      <div style={{ fontSize: 11, color: "#888", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>{agent.category}</div>
      {[
        ["Requests", m.requests ?? 0],
        ["Avg Latency", `${(m.avg_latency_ms ?? 0).toFixed(0)}ms`],
        ["Earnings", `$${(m.earnings ?? 0).toFixed(4)}`],
        ["Price/Call", `$${agent.price_per_request ?? 0}`],
      ].map(([label, value]) => (
        <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
          <span style={{ color: "#888", fontSize: 12 }}>{label}</span>
          <span style={{ color, fontSize: 12, fontWeight: 700 }}>{value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ msg }) {
  if (!msg) return null;
  return (
    <div style={{
      position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)",
      background: "rgba(255,107,53,0.18)", border: "1px solid #FF6B3560",
      borderRadius: 10, padding: "8px 20px", color: "#FF6B35",
      fontSize: 12, fontWeight: 700, fontFamily: "inherit",
      pointerEvents: "none", zIndex: 100,
    }}>{msg}</div>
  );
}

// ── Main 3D scene ─────────────────────────────────────────────────────────────
function BurnScene({ agents, metrics, activeAgents, selected, onSelect, positions, worldEvent }) {
  const allPositions = useMemo(() => positions.map(p => ({ x: p.x, z: p.z })), [positions]);

  return (
    <>
      <color attach="background" args={["#0a0806"]} />
      <fog attach="fog" color="#1a1410" near={90} far={230} />

      {/* Dusty playa night: warm amber ambient, faint moon directional */}
      <ambientLight intensity={0.18} color="#2a1e10" />
      <directionalLight position={[-30, 50, 20]} intensity={0.20} color="#c0a870" />
      <hemisphereLight args={["#1a1208", "#0a0806", 0.25]} />

      <StarField />
      <NightMoon />
      <PlayaFloor />
      <PlayaDust />
      <NeonTotems />
      <EsplanadeCity />
      <DeepPlayaArt />

      <TheMan anyActive={activeAgents.size > 0} />
      <TheTemple />
      {Array.from({ length: 5 }, (_, i) => <MutantVehicle key={i} seed={i + 3} />)}

      {agents.map((a, i) => {
        const p = positions[i];
        if (!p) return null;
        const m = metrics[a.id] || {};
        return (
          <AgentInstallation key={a.id}
            agent={a} position={p}
            active={activeAgents.has(a.id)}
            requests={m.requests ?? 0}
            selected={selected?.id === a.id}
            onClick={onSelect} />
        );
      })}

      {/* Signal beams from active installations to fire */}
      {agents.map((a, i) => {
        if (!activeAgents.has(a.id)) return null;
        const p = positions[i]; if (!p) return null;
        return <SignalBeam key={a.id} from={p} to={{ x: 0, z: 0 }} color={neon(a.category)} />;
      })}

      {/* Festival wanderers */}
      {Array.from({ length: Math.min(agents.length + 4, 14) }, (_, i) => (
        <FestivalWalker key={i} seed={i + 7} positions={allPositions.length ? allPositions : [{ x: 0, z: 0 }]} />
      ))}

      <EffectComposer>
        <Bloom luminanceThreshold={0.1} luminanceSmoothing={0.4} intensity={worldEvent ? 2.2 : 1.4} radius={0.6} />
      </EffectComposer>
    </>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────
function layoutAgentsRadial(agents) {
  const n = agents.length;
  if (!n) return [];
  const R = n <= 6 ? 10 : n <= 10 ? 13 : 16;
  return agents.map((_, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    return { x: Math.cos(a) * R, z: Math.sin(a) * R };
  });
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function ExperimentalWorld() {
  const [agents,       setAgents]       = useState([]);
  const [metrics,      setMetrics]      = useState({});
  const [activeAgents, setActiveAgents] = useState(new Set());
  const [selected,     setSelected]     = useState(null);
  const [worldEvent,   setWorldEvent]   = useState(null);
  const [toast,        setToast]        = useState("");
  const [wsRetry,      setWsRetry]      = useState(0);

  const positions = useMemo(() => layoutAgentsRadial(agents), [agents]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3500); };

  // Load agents + metrics
  useEffect(() => {
    const load = () => {
      fetch(`${API}/agents`).then(r => r.json()).then(data => {
        setAgents(data.filter(a => a.status !== "inactive"));
      }).catch(() => {});
      fetch(`${API}/metrics`).then(r => r.json()).then(arr => {
        const m = {}; arr.forEach(x => { m[x.agent_id] = x; }); setMetrics(m);
      }).catch(() => {});
    };
    load();
    const iv = setInterval(load, 8000);
    return () => clearInterval(iv);
  }, []);

  // WebSocket
  useEffect(() => {
    const ws = new WebSocket(WS);

    ws.onmessage = (e) => {
      const ev = JSON.parse(e.data);

      if (ev.type === "agent_call_start" || ev.type === "pipeline_step_start") {
        setActiveAgents(prev => new Set([...prev, ev.agent_id]));
      }

      if (ev.type === "agent_call_done" || ev.type === "pipeline_step_done") {
        setActiveAgents(prev => { const n = new Set(prev); n.delete(ev.agent_id); return n; });
        if (ev.metrics) setMetrics(prev => ({ ...prev, [ev.agent_id]: ev.metrics }));
        const earn = ev.metrics?.earnings ?? ev.result?.earnings ?? 0;
        if (earn > 0.5) {
          setWorldEvent({ label: "⚡ SIGNAL SURGE", color: "#FF6B35" });
          setTimeout(() => setWorldEvent(null), 3500);
        }
      }

      if (ev.type === "pipeline_start") {
        showToast(`Pipeline running…`);
      }

      if (ev.type === "pipeline_done") {
        setWorldEvent({ label: "🔥 SIGNAL BURN COMPLETE", color: "#FFD700" });
        setTimeout(() => setWorldEvent(null), 4000);
      }

      if (ev.type === "agent_registered") {
        showToast(`New agent deployed to the Burn!`);
        fetch(`${API}/agents`).then(r => r.json()).then(data => setAgents(data.filter(a => a.status !== "inactive"))).catch(() => {});
        setWorldEvent({ label: "🌟 NEW AGENT DEPLOYED", color: "#A855F7" });
        setTimeout(() => setWorldEvent(null), 4000);
      }
    };

    ws.onerror = () => {};
    ws.onclose = () => { setTimeout(() => setWsRetry(n => n + 1), 3000); };
    return () => ws.close();
  }, [wsRetry]);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", background: "#060310" }}>
      <EventBanner event={worldEvent} />
      <Toast msg={toast} />
      <AgentHUD agent={selected} metrics={metrics} onClose={() => setSelected(null)} />

      {agents.length === 0 && (
        <div style={{
          position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
          color: "#FF6B35", fontFamily: "inherit", fontSize: 14, fontWeight: 700,
          textAlign: "center", pointerEvents: "none",
          textShadow: "0 0 12px #FF6B35",
        }}>
          The desert awaits…<br />
          <span style={{ color: "#666", fontSize: 11, fontWeight: 400 }}>Deploy an agent to the Experimental world to begin</span>
        </div>
      )}

      <Canvas
        camera={{ position: [0, 22, 32], fov: 58 }}
        shadows={false}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.4 }}
        style={{ width: "100%", height: "100%" }}
      >
        <Suspense fallback={null}>
          <BurnScene
            agents={agents}
            metrics={metrics}
            activeAgents={activeAgents}
            selected={selected}
            onSelect={setSelected}
            positions={positions}
            worldEvent={worldEvent}
          />
          <OrbitControls
            enableDamping dampingFactor={0.08}
            minDistance={6} maxDistance={180}
            maxPolarAngle={Math.PI * 0.82}
          />
        </Suspense>
      </Canvas>

      {/* Legend */}
      <div style={{
        position: "absolute", bottom: 16, left: 16,
        background: "rgba(6,3,16,0.85)", border: "1px solid #FF6B3540",
        borderRadius: 10, padding: "10px 14px", fontFamily: "inherit",
      }}>
        <div style={{ color: "#FF6B35", fontSize: 11, fontWeight: 800, marginBottom: 6, letterSpacing: 1 }}>
          AGENT BURN
        </div>
        {Object.entries(NEON).slice(0, 4).map(([cat, color]) => (
          <div key={cat} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}` }} />
            <span style={{ color: "#888", fontSize: 10, textTransform: "capitalize" }}>{cat}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
