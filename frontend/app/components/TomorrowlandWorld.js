"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

import { API, WS } from "@/app/lib/config";
import { useMyUsername } from "@/app/lib/useMyUsername";

const rng = (seed) => {
  const x = Math.sin(seed + 1) * 43758.5453123;
  return x - Math.floor(x);
};

function layoutAgents(agents) {
  return agents.map((a, i) => {
    const row = Math.floor(i / 6);
    const col = i % 6;
    return { ...a, x: (col / 5 - 0.5) * 38, z: -5 - row * 11 };
  });
}

// ── Ground ────────────────────────────────────────────────────────────────────
function FestivalGround() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[300, 300]} />
        <meshLambertMaterial color="#111820" />
      </mesh>
      {/* Crowd area — worn grass */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -14]}>
        <planeGeometry args={[70, 32]} />
        <meshLambertMaterial color="#16221a" />
      </mesh>
      {/* Center aisle */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -17]}>
        <planeGeometry args={[8, 38]} />
        <meshLambertMaterial color="#1a1810" />
      </mesh>
      {/* Stage island behind lake */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -52]}>
        <planeGeometry args={[80, 32]} />
        <meshLambertMaterial color="#0d0820" />
      </mesh>
    </>
  );
}

// ── Lake + Unity Bridge ───────────────────────────────────────────────────────
function LakeAndBridge() {
  const waterRef = useRef();

  useFrame((s) => {
    if (waterRef.current) {
      const t = s.clock.elapsedTime;
      waterRef.current.material.color.setHSL(0.62 + Math.sin(t * 0.25) * 0.03, 0.9, 0.14 + Math.sin(t * 0.4) * 0.04);
    }
  });

  return (
    <>
      {/* Lake water */}
      <mesh ref={waterRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, -32]}>
        <planeGeometry args={[80, 7]} />
        <meshLambertMaterial color="#0a1428" />
      </mesh>
      {/* Stage light reflections on water */}
      {[-18, -8, 0, 8, 18].map((rx, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[rx, 0.09, -32]}>
          <circleGeometry args={[2.2, 16]} />
          <meshBasicMaterial color={`hsl(${i * 55 + 220},100%,55%)`} transparent opacity={0.12} />
        </mesh>
      ))}
      {/* Unity Bridge */}
      <group position={[0, 0, -32]}>
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[7, 0.3, 7.5]} />
          <meshLambertMaterial color="#1e1040" />
        </mesh>
        {[-3.2, 3.2].map((rx, i) => (
          <group key={i}>
            <mesh position={[rx, 1.1, 0]}>
              <boxGeometry args={[0.12, 1.0, 7.5]} />
              <meshLambertMaterial color="#4a2080" />
            </mesh>
            {[-3, -1.5, 0, 1.5, 3].map((pz, j) => (
              <group key={j} position={[rx, 0, pz]}>
                <mesh position={[0, 1.6, 0]}>
                  <cylinderGeometry args={[0.06, 0.08, 1.8, 5]} />
                  <meshLambertMaterial color="#333" />
                </mesh>
                <mesh position={[0, 2.55, 0]}>
                  <sphereGeometry args={[0.18, 6, 6]} />
                  <meshBasicMaterial color="#ffdd88" />
                </mesh>
                <pointLight position={[0, 2.5, 0]} intensity={0.5} color="#ffcc55" distance={5} decay={2} />
              </group>
            ))}
          </group>
        ))}
      </group>
    </>
  );
}

// ── The Mainstage — Tomorrowland castle ───────────────────────────────────────
function BookOfWisdom() {
  const glowRef = useRef();
  useFrame((s) => {
    if (glowRef.current)
      glowRef.current.material.emissiveIntensity = 0.5 + Math.sin(s.clock.elapsedTime * 2) * 0.25;
  });
  return (
    <group position={[0, 1.8, 6]}>
      {/* Pedestal */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.9, 1.2, 1.8, 8]} />
        <meshLambertMaterial color="#1e1040" emissive="#440088" emissiveIntensity={0.3} />
      </mesh>
      {/* Gold band */}
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.95, 0.95, 0.22, 8]} />
        <meshBasicMaterial color="#d4a020" />
      </mesh>
      {/* Left page — animated glow */}
      <mesh ref={glowRef} position={[-2.0, 3.5, 0]} rotation={[0.2, 0, 0.4]}>
        <planeGeometry args={[3.5, 5.0]} />
        <meshLambertMaterial color="#f4ecd0" emissive="#c8900c" emissiveIntensity={0.5} side={THREE.DoubleSide} />
      </mesh>
      {/* Right page */}
      <mesh position={[2.0, 3.5, 0]} rotation={[0.2, 0, -0.4]}>
        <planeGeometry args={[3.5, 5.0]} />
        <meshLambertMaterial color="#f4ecd0" emissive="#c8900c" emissiveIntensity={0.5} side={THREE.DoubleSide} />
      </mesh>
      {/* Spine */}
      <mesh position={[0, 3.2, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 4.8, 6]} />
        <meshBasicMaterial color="#d4a020" />
      </mesh>
      <pointLight position={[0, 4, 2]} intensity={4} color="#ffcc44" distance={14} decay={2} />
    </group>
  );
}

function CO2Jets({ anyActive }) {
  const refs = useRef([]);
  const JET_POS = [-22, -15, -9, -4, 4, 9, 15, 22];

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    const speed = anyActive ? 3.5 : 0.7;
    refs.current.forEach((m, i) => {
      if (!m) return;
      const phase = (t * speed + i * 0.75) % 4.5;
      const sc = phase < 0.5 ? phase / 0.5 : Math.max(0, 1 - (phase - 0.5) / 2.5);
      m.scale.set(1, Math.max(0.001, sc), 1);
      m.material.opacity = sc * 0.52;
    });
  });

  return (
    <>
      {JET_POS.map((x, i) => (
        <mesh key={i} ref={el => { refs.current[i] = el; }} position={[x, 1, -38.5]}>
          <cylinderGeometry args={[0.28, 0.55, 11, 6]} />
          <meshBasicMaterial color="#cce8ff" transparent opacity={0.4} />
        </mesh>
      ))}
    </>
  );
}

function Mainstage({ anyActive }) {
  const screenRef  = useRef();
  const beamRefs   = useRef([]);
  const flameRefs  = useRef([]);
  const archGlow   = useRef();

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (screenRef.current) {
      screenRef.current.material.color.setHSL((t * 0.07) % 1, 1, 0.55);
      screenRef.current.material.emissive.setHSL((t * 0.07) % 1, 1, 0.38);
    }
    beamRefs.current.forEach((g, i) => {
      if (g) g.rotation.y = Math.sin(t * (0.5 + i * 0.15) + i) * 0.55;
    });
    flameRefs.current.forEach((m, i) => {
      if (!m) return;
      const ph = t * (1.8 + i * 0.2) + i * 1.1;
      m.scale.set(1, 0.8 + Math.abs(Math.sin(ph)) * 0.6, 1);
      m.material.opacity = 0.55 + Math.sin(ph * 1.3) * 0.3;
    });
    if (archGlow.current)
      archGlow.current.material.opacity = anyActive
        ? 0.22 + Math.sin(t * 4) * 0.12
        : 0.08 + Math.sin(t * 1.2) * 0.04;
  });

  return (
    <group position={[0, 0, -55]}>
      {/* ── Stage platform ── */}
      <mesh position={[0, 0.5, 8]}>
        <boxGeometry args={[58, 1.0, 20]} />
        <meshLambertMaterial color="#0e0b1e" />
      </mesh>
      {/* Gold edge trim front */}
      <mesh position={[0, 0.8, 17.5]}>
        <boxGeometry args={[58, 0.35, 0.2]} />
        <meshBasicMaterial color="#d4a020" />
      </mesh>

      {/* ── Stage stairs ── */}
      {[0, 1, 2, 3, 4].map(i => (
        <mesh key={i} position={[0, i * 0.38 + 0.19, 17 + i * 1.5]}>
          <boxGeometry args={[50 - i * 3, 0.38, 1.5]} />
          <meshLambertMaterial color="#12101e" />
        </mesh>
      ))}

      {/* ── Main back wall ── */}
      <mesh position={[0, 13, 0]}>
        <boxGeometry args={[58, 26, 3]} />
        <meshLambertMaterial color="#110a24" emissive="#280055" emissiveIntensity={0.18} />
      </mesh>

      {/* ── Gold horizontal trim on back wall ── */}
      {[5, 11, 18, 23].map((h, i) => (
        <mesh key={i} position={[0, h, 1.55]}>
          <boxGeometry args={[58.2, 0.28, 0.12]} />
          <meshBasicMaterial color="#d4a020" />
        </mesh>
      ))}

      {/* ── Central LED screen ── */}
      <mesh ref={screenRef} position={[0, 13, 1.65]}>
        <planeGeometry args={[28, 16]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} />
      </mesh>

      {/* ── Screen frame (gold) ── */}
      {[[-15, 13, 1.7, [0.5, 16.5, 0.2]], [15, 13, 1.7, [0.5, 16.5, 0.2]],
        [0, 21.5, 1.7, [28.5, 0.5, 0.2]], [0, 4.5, 1.7, [28.5, 0.5, 0.2]]].map(([x,y,z,s],i) => (
        <mesh key={i} position={[x, y, z]}>
          <boxGeometry args={s} />
          <meshBasicMaterial color="#d4a020" />
        </mesh>
      ))}

      {/* ── Left outer mega tower ── */}
      <group position={[-26, 0, 0]}>
        <mesh position={[0, 17, 0]}>
          <boxGeometry args={[7, 34, 7]} />
          <meshLambertMaterial color="#130a28" emissive="#2a0055" emissiveIntensity={0.2} />
        </mesh>
        {/* Gold tower bands */}
        {[6, 12, 18, 24, 30].map((h, i) => (
          <mesh key={i} position={[0, h, 3.55]}>
            <boxGeometry args={[7.1, 0.3, 0.12]} />
            <meshBasicMaterial color="#d4a020" />
          </mesh>
        ))}
        {/* Tall pointed spire */}
        <mesh position={[0, 37, 0]} rotation={[0, Math.PI / 4, 0]}>
          <coneGeometry args={[4.5, 9, 4]} />
          <meshLambertMaterial color="#2a0058" emissive="#8800cc" emissiveIntensity={0.5} />
        </mesh>
        {/* Battlements on tower top */}
        {[-2.5, -0.8, 0.8, 2.5].map((bx, i) => (
          <mesh key={i} position={[bx, 35, 3.55]}>
            <boxGeometry args={[0.9, 1.4, 0.6]} />
            <meshLambertMaterial color="#1a0f32" />
          </mesh>
        ))}
        {/* Flame topper */}
        <mesh ref={el => { flameRefs.current[0] = el; }} position={[0, 42, 0]}>
          <coneGeometry args={[0.6, 3.5, 6]} />
          <meshBasicMaterial color="#ff6600" transparent opacity={0.7} />
        </mesh>
        <pointLight position={[0, 20, 4]} intensity={5} color="#aa44ff" distance={35} decay={2} />
      </group>

      {/* ── Right outer mega tower ── */}
      <group position={[26, 0, 0]}>
        <mesh position={[0, 17, 0]}>
          <boxGeometry args={[7, 34, 7]} />
          <meshLambertMaterial color="#130a28" emissive="#2a0055" emissiveIntensity={0.2} />
        </mesh>
        {[6, 12, 18, 24, 30].map((h, i) => (
          <mesh key={i} position={[0, h, 3.55]}>
            <boxGeometry args={[7.1, 0.3, 0.12]} />
            <meshBasicMaterial color="#d4a020" />
          </mesh>
        ))}
        <mesh position={[0, 37, 0]} rotation={[0, Math.PI / 4, 0]}>
          <coneGeometry args={[4.5, 9, 4]} />
          <meshLambertMaterial color="#2a0058" emissive="#8800cc" emissiveIntensity={0.5} />
        </mesh>
        {[-2.5, -0.8, 0.8, 2.5].map((bx, i) => (
          <mesh key={i} position={[bx, 35, 3.55]}>
            <boxGeometry args={[0.9, 1.4, 0.6]} />
            <meshLambertMaterial color="#1a0f32" />
          </mesh>
        ))}
        <mesh ref={el => { flameRefs.current[1] = el; }} position={[0, 42, 0]}>
          <coneGeometry args={[0.6, 3.5, 6]} />
          <meshBasicMaterial color="#ff6600" transparent opacity={0.7} />
        </mesh>
        <pointLight position={[0, 20, 4]} intensity={5} color="#ff44aa" distance={35} decay={2} />
      </group>

      {/* ── Left inner tower ── */}
      <group position={[-15, 0, 0]}>
        <mesh position={[0, 13, 0]}>
          <boxGeometry args={[5.5, 26, 5.5]} />
          <meshLambertMaterial color="#150c2c" emissive="#220044" emissiveIntensity={0.2} />
        </mesh>
        <mesh position={[0, 27.5, 0]} rotation={[0, Math.PI / 4, 0]}>
          <coneGeometry args={[3.8, 7, 4]} />
          <meshLambertMaterial color="#250050" emissive="#6600aa" emissiveIntensity={0.45} />
        </mesh>
        {[5, 10, 15, 20].map((h, i) => (
          <mesh key={i} position={[0, h, 2.8]}>
            <boxGeometry args={[5.6, 0.25, 0.1]} />
            <meshBasicMaterial color="#d4a020" />
          </mesh>
        ))}
        <mesh ref={el => { flameRefs.current[2] = el; }} position={[0, 33, 0]}>
          <coneGeometry args={[0.45, 2.8, 6]} />
          <meshBasicMaterial color="#ff8800" transparent opacity={0.65} />
        </mesh>
      </group>

      {/* ── Right inner tower ── */}
      <group position={[15, 0, 0]}>
        <mesh position={[0, 13, 0]}>
          <boxGeometry args={[5.5, 26, 5.5]} />
          <meshLambertMaterial color="#150c2c" emissive="#220044" emissiveIntensity={0.2} />
        </mesh>
        <mesh position={[0, 27.5, 0]} rotation={[0, Math.PI / 4, 0]}>
          <coneGeometry args={[3.8, 7, 4]} />
          <meshLambertMaterial color="#250050" emissive="#6600aa" emissiveIntensity={0.45} />
        </mesh>
        {[5, 10, 15, 20].map((h, i) => (
          <mesh key={i} position={[0, h, 2.8]}>
            <boxGeometry args={[5.6, 0.25, 0.1]} />
            <meshBasicMaterial color="#d4a020" />
          </mesh>
        ))}
        <mesh ref={el => { flameRefs.current[3] = el; }} position={[0, 33, 0]}>
          <coneGeometry args={[0.45, 2.8, 6]} />
          <meshBasicMaterial color="#ff8800" transparent opacity={0.65} />
        </mesh>
      </group>

      {/* ── Mid turrets ── */}
      {[-8, -3, 3, 8].map((tx, i) => (
        <group key={i} position={[tx, 0, -1]}>
          <mesh position={[0, 11, 0]}>
            <cylinderGeometry args={[1.8, 2.1, 15, 8]} />
            <meshLambertMaterial color="#160c2a" emissive="#1a0040" emissiveIntensity={0.15} />
          </mesh>
          <mesh position={[0, 19.5, 0]}>
            <coneGeometry args={[2.4, 5, 8]} />
            <meshLambertMaterial color="#22004a" emissive="#5500aa" emissiveIntensity={0.4} />
          </mesh>
          {/* Turret battlements */}
          {Array.from({ length: 6 }, (_, j) => {
            const a = (j / 6) * Math.PI * 2;
            return (
              <mesh key={j} position={[Math.cos(a) * 2.0, 16, Math.sin(a) * 2.0]}>
                <boxGeometry args={[0.7, 1.2, 0.5]} />
                <meshLambertMaterial color="#14102a" />
              </mesh>
            );
          })}
        </group>
      ))}

      {/* ── Main arch connecting inner towers ── */}
      <mesh position={[0, 26.5, 0]}>
        <boxGeometry args={[34, 4.5, 4]} />
        <meshLambertMaterial color="#180e32" emissive="#440088" emissiveIntensity={0.25} />
      </mesh>
      {/* Gold arch trim */}
      <mesh position={[0, 28.5, 2.1]}>
        <boxGeometry args={[34.2, 0.3, 0.1]} />
        <meshBasicMaterial color="#d4a020" />
      </mesh>
      {/* Arch battlements */}
      {Array.from({ length: 11 }, (_, i) => (
        <mesh key={i} position={[(i / 10 - 0.5) * 32, 29.2, 2.1]}>
          <boxGeometry args={[1.2, 1.8, 0.5]} />
          <meshLambertMaterial color="#140e28" />
        </mesh>
      ))}

      {/* ── Banners hanging from towers ── */}
      {[[-26, 25], [26, 25], [-15, 20], [15, 20]].map(([bx, by], i) => (
        <group key={i} position={[bx, by, 3.6]}>
          <mesh>
            <planeGeometry args={[2.2, 5.5]} />
            <meshLambertMaterial
              color={i % 2 === 0 ? "#4a0088" : "#880044"}
              emissive={i % 2 === 0 ? "#220044" : "#440022"}
              emissiveIntensity={0.3}
              side={THREE.DoubleSide}
            />
          </mesh>
          {/* Gold banner top bar */}
          <mesh position={[0, 2.9, 0]}>
            <boxGeometry args={[2.4, 0.2, 0.12]} />
            <meshBasicMaterial color="#d4a020" />
          </mesh>
        </group>
      ))}

      {/* ── Speaker stacks ── */}
      {[-21, 21].map((sx, i) => (
        <group key={i} position={[sx, 0, 8]}>
          <mesh position={[0, 4, 0]}>
            <boxGeometry args={[3, 8, 2.5]} />
            <meshLambertMaterial color="#0a0a14" />
          </mesh>
          {[1.5, 3.5, 5.5, 7.5].map((h, j) => (
            <mesh key={j} position={[0, h, 1.27]}>
              <boxGeometry args={[2.6, 1.6, 0.08]} />
              <meshLambertMaterial color="#111" />
            </mesh>
          ))}
          <pointLight position={[0, 8.5, 1]} intensity={3}
            color={i === 0 ? "#ff44cc" : "#44ccff"} distance={25} decay={2} />
        </group>
      ))}

      {/* ── Spotlight beams (8 sweeping) ── */}
      {[-20, -12, -6, 0, 6, 12, 20].map((sx, i) => (
        <group key={i} ref={el => { beamRefs.current[i] = el; }} position={[sx, 1, 15]}>
          <mesh rotation={[0.18, 0, 0]}>
            <cylinderGeometry args={[0.07, 1.6, 45, 5]} />
            <meshBasicMaterial
              color={`hsl(${i * 51 + 220},100%,72%)`}
              transparent opacity={0.10}
            />
          </mesh>
        </group>
      ))}

      {/* ── Ground glow ── */}
      <mesh ref={archGlow} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 8]}>
        <planeGeometry args={[58, 22]} />
        <meshBasicMaterial color="#8800ff" transparent opacity={0.08} />
      </mesh>

      {/* ── Book of Wisdom center stage ── */}
      <BookOfWisdom />

      {/* ── CO2 jets ── */}
      <CO2Jets anyActive={anyActive} />
    </group>
  );
}

// ── LED light towers throughout crowd ────────────────────────────────────────
const LED_TOWER_SPOTS = [
  [-20,-6],[20,-6],[-25,-13],[25,-13],
  [-22,-21],[22,-21],[-18,-4],[18,-4],
  [-28,-10],[28,-10],
];

function LightTower({ x, z, seed }) {
  const panelRef = useRef();
  const hue = Math.floor(rng(seed) * 360);

  useFrame((s) => {
    if (panelRef.current) {
      const h = ((s.clock.elapsedTime * 0.12 + seed * 0.22) % 1);
      panelRef.current.material.color.setHSL(h, 1, 0.55);
      panelRef.current.material.emissive.setHSL(h, 1, 0.35);
    }
  });

  return (
    <group position={[x, 0, z]}>
      {[[-0.5,-0.5],[0.5,-0.5],[-0.5,0.5],[0.5,0.5]].map(([lx,lz], i) => (
        <mesh key={i} position={[lx, 4.5, lz]}>
          <cylinderGeometry args={[0.07, 0.10, 9, 5]} />
          <meshLambertMaterial color="#1a1a22" />
        </mesh>
      ))}
      {[2, 5, 7.5].map((h, i) => (
        <group key={i} position={[0, h, 0]}>
          <mesh rotation={[0, Math.PI / 4, Math.PI / 2]}>
            <cylinderGeometry args={[0.04, 0.04, 1.42, 4]} />
            <meshLambertMaterial color="#2a2a32" />
          </mesh>
          <mesh rotation={[0, -Math.PI / 4, Math.PI / 2]}>
            <cylinderGeometry args={[0.04, 0.04, 1.42, 4]} />
            <meshLambertMaterial color="#2a2a32" />
          </mesh>
        </group>
      ))}
      <mesh ref={panelRef} position={[0, 10.5, 0]}>
        <boxGeometry args={[2.4, 1.9, 0.22]} />
        <meshStandardMaterial color={`hsl(${hue},100%,55%)`}
          emissive={`hsl(${hue},100%,35%)`} emissiveIntensity={0.8} />
      </mesh>
      <pointLight position={[0, 11, 0]} intensity={2.5}
        color={`hsl(${hue},100%,60%)`} distance={16} decay={2} />
    </group>
  );
}

// ── Totem poles in crowd ──────────────────────────────────────────────────────
const TOTEM_SPOTS = Array.from({ length: 24 }, (_, i) => ({
  x: (rng(i * 11 + 1) - 0.5) * 44,
  z: -4 - rng(i * 11 + 2) * 24,
  seed: i,
}));

function TotemPole({ x, z, seed }) {
  const hue     = Math.floor(rng(seed) * 360);
  const flagRef = useRef();
  useFrame((s) => {
    if (flagRef.current)
      flagRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 1.8 + seed) * 0.35;
  });
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 3.0, 0]}>
        <cylinderGeometry args={[0.06, 0.09, 6, 5]} />
        <meshLambertMaterial color="#1a1820" />
      </mesh>
      <group ref={flagRef} position={[0.55, 5.8, 0]}>
        <mesh>
          <planeGeometry args={[1.2, 0.7]} />
          <meshBasicMaterial color={`hsl(${hue},90%,58%)`} side={THREE.DoubleSide} />
        </mesh>
      </group>
      <mesh position={[0, 6.3, 0]}>
        <sphereGeometry args={[0.2, 6, 6]} />
        <meshBasicMaterial color={`hsl(${hue},100%,72%)`} />
      </mesh>
    </group>
  );
}

// ── Confetti cannons (when agents fire) ───────────────────────────────────────
const CONF_N = 450;
function Confetti({ active }) {
  const ref   = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const col   = useMemo(() => new THREE.Color(), []);
  const parts = useRef(Array.from({ length: CONF_N }, (_, i) => ({
    x: (rng(i) - 0.5) * 55, y: 10 + rng(i + 100) * 22,
    z: -6 - rng(i + 200) * 26,
    vy: -(0.9 + rng(i + 300) * 2.2),
    vx: (rng(i + 400) - 0.5) * 0.55,
    hue: rng(i + 500),
  })));

  useFrame((s, dt) => {
    const m = ref.current; if (!m) return;
    parts.current.forEach((p, i) => {
      if (active) {
        p.y += p.vy * dt; p.x += p.vx * dt;
        if (p.y < -1) {
          p.y = 12 + rng(i + s.clock.elapsedTime * 0.6) * 22;
          p.x = (rng(i * 3 + s.clock.elapsedTime * 0.1) - 0.5) * 55;
        }
        dummy.position.set(p.x, p.y, p.z);
        dummy.scale.setScalar(0.24);
      } else {
        dummy.position.set(0, -200, 0);
        dummy.scale.setScalar(0);
      }
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      col.setHSL(p.hue, 1, 0.6);
      m.setColorAt(i, col);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[null, null, CONF_N]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} />
    </instancedMesh>
  );
}

// ── Fireworks ─────────────────────────────────────────────────────────────────
const NUM_FW   = 8;
const PARTS    = 55;
const LAUNCHES = [[-26,-55],[26,-55],[-22,-46],[22,-46],[0,-55],[-10,-50],[10,-50],[0,-45]];

function Fireworks({ anyActive }) {
  const rktRef  = useRef();
  const burstRef = useRef();
  const dummy   = useMemo(() => new THREE.Object3D(), []);
  const col     = useMemo(() => new THREE.Color(), []);

  const fw = useRef(Array.from({ length: NUM_FW }, (_, i) => ({
    state: 'idle', timer: rng(i) * 4,
    rx: 0, ry: 0, rz: 0, rvy: 0, hue: rng(i * 7),
    parts: Array.from({ length: PARTS }, () => ({ x:0,y:0,z:0,vx:0,vy:0,vz:0,life:0 })),
  })));

  useFrame((s, dt) => {
    const rm = rktRef.current;
    const bm = burstRef.current;
    if (!rm || !bm) return;

    fw.current.forEach((f, fi) => {
      f.timer -= dt;
      if (f.state === 'idle' && f.timer <= 0) {
        const lp = LAUNCHES[fi];
        f.rx = lp[0]; f.ry = 0.5; f.rz = lp[1];
        f.rvy = 16 + rng(fi + s.clock.elapsedTime) * 6;
        f.hue = rng(fi + s.clock.elapsedTime * 0.1);
        f.state = 'rising';
      }
      if (f.state === 'rising') {
        f.rvy -= 22 * dt; f.ry += f.rvy * dt;
        if (f.rvy < 0) {
          f.state = 'burst';
          f.parts.forEach((p, j) => {
            p.x = f.rx; p.y = f.ry; p.z = f.rz;
            const theta = rng(j * 7 + fi) * Math.PI * 2;
            const phi   = rng(j * 5 + fi + 1) * Math.PI;
            const spd   = 5 + rng(j * 3 + fi) * 5.5;
            p.vx = Math.sin(phi)*Math.cos(theta)*spd;
            p.vy = Math.cos(phi)*spd*0.5+2;
            p.vz = Math.sin(phi)*Math.sin(theta)*spd;
            p.life = 1.0;
          });
        }
      }
      if (f.state === 'burst') {
        let alive = false;
        f.parts.forEach(p => {
          if (p.life <= 0) return;
          p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
          p.vy -= 5 * dt; p.life -= dt * 0.5;
          if (p.life > 0) alive = true;
        });
        if (!alive) {
          f.state = 'idle';
          f.timer = (anyActive ? 0.3 : 2.0) + rng(fi + f.ry) * 2.5;
        }
      }
      if (f.state === 'rising') {
        dummy.position.set(f.rx, f.ry, f.rz); dummy.scale.setScalar(1);
      } else { dummy.position.set(0,-200,0); dummy.scale.setScalar(0); }
      dummy.updateMatrix(); rm.setMatrixAt(fi, dummy.matrix);

      col.setHSL(f.hue, 1, 0.65);
      const base = fi * PARTS;
      f.parts.forEach((p, j) => {
        if (p.life > 0) { dummy.position.set(p.x,p.y,p.z); dummy.scale.setScalar(Math.max(0,p.life*0.38)); }
        else { dummy.position.set(0,-200,0); dummy.scale.setScalar(0); }
        dummy.updateMatrix(); bm.setMatrixAt(base+j, dummy.matrix); bm.setColorAt(base+j, col);
      });
    });
    rm.instanceMatrix.needsUpdate = true;
    bm.instanceMatrix.needsUpdate = true;
    if (bm.instanceColor) bm.instanceColor.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={rktRef} args={[null, null, NUM_FW]}>
        <sphereGeometry args={[0.22, 4, 4]} />
        <meshBasicMaterial color="#ffffcc" />
      </instancedMesh>
      <instancedMesh ref={burstRef} args={[null, null, NUM_FW * PARTS]}>
        <sphereGeometry args={[1, 4, 4]} />
        <meshBasicMaterial color="#ffffff" />
      </instancedMesh>
    </>
  );
}

// ── Festival crowd ────────────────────────────────────────────────────────────
const CROWD = Array.from({ length: 600 }, (_, i) => ({
  x:     (rng(i) - 0.5) * 52,
  z:     -3 - rng(i + 1000) * 26,
  phase:  rng(i + 2000) * Math.PI * 2,
  speed:  rng(i + 3000) * 0.6 + 0.9,
}));

function FestivalCrowd({ anyActive }) {
  const ref   = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((s) => {
    const m = ref.current; if (!m) return;
    const t = s.clock.elapsedTime;
    CROWD.forEach((c, i) => {
      const bounce = anyActive
        ? Math.abs(Math.sin(t * c.speed * 4 + c.phase)) * 0.5
        : Math.abs(Math.sin(t * c.speed * 0.9 + c.phase)) * 0.06;
      dummy.position.set(c.x, bounce * 0.5 + 0.4, c.z);
      dummy.scale.set(1, 0.85 + bounce, 1);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[null, null, CROWD.length]}>
      <cylinderGeometry args={[0.12, 0.14, 0.82, 5]} />
      <meshLambertMaterial color="#2a2840" />
    </instancedMesh>
  );
}

// ── Ferris wheel ──────────────────────────────────────────────────────────────
function FerrisWheel() {
  const wheelRef = useRef();
  useFrame((s) => { if (wheelRef.current) wheelRef.current.rotation.z = s.clock.elapsedTime * 0.18; });
  const R = 9, G = 12;
  return (
    <group position={[38, 0, -18]}>
      {[-4.5, 4.5].map((lx, i) => (
        <mesh key={i} position={[lx, 6.5, 0]} rotation={[0, 0, lx > 0 ? -0.3 : 0.3]}>
          <cylinderGeometry args={[0.22, 0.30, 13, 6]} />
          <meshLambertMaterial color="#222" />
        </mesh>
      ))}
      <group ref={wheelRef} position={[0, 12, 0]}>
        <mesh><torusGeometry args={[R, 0.34, 8, 40]} /><meshLambertMaterial color="#1a1a28" emissive="#330055" emissiveIntensity={0.3} /></mesh>
        {Array.from({ length: 10 }, (_, i) => (
          <mesh key={i} rotation={[0, 0, (i / 10) * Math.PI * 2]}>
            <boxGeometry args={[0.1, R * 2, 0.1]} />
            <meshLambertMaterial color="#333" />
          </mesh>
        ))}
        {Array.from({ length: 24 }, (_, i) => {
          const a = (i / 24) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * R, Math.sin(a) * R, 0]}>
              <sphereGeometry args={[0.22, 5, 5]} />
              <meshBasicMaterial color={`hsl(${i * 15},100%,68%)`} />
            </mesh>
          );
        })}
        {Array.from({ length: G }, (_, i) => {
          const a = (i / G) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * R, Math.sin(a) * R, 0]}>
              <boxGeometry args={[1.4, 1.1, 0.9]} />
              <meshLambertMaterial color={`hsl(${i * 30},65%,50%)`} />
            </mesh>
          );
        })}
      </group>
      <pointLight position={[0, 12, 0]} intensity={3} color="#cc44ff" distance={20} decay={2} />
    </group>
  );
}

// ── Enchanted trees ───────────────────────────────────────────────────────────
const TREE_SPOTS = [
  [-30,-6],[30,-6],[-34,-16],[34,-16],[-32,-28],[32,-28],
  [-24,-4],[24,-4],[-40,-22],[40,-22],
];
function EnchantedTree({ x, z, seed }) {
  const hue = Math.floor(rng(seed) * 360);
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 2.5, 0]}><cylinderGeometry args={[0.28, 0.38, 5, 6]} /><meshLambertMaterial color="#1e1008" /></mesh>
      <mesh position={[0, 6.0, 0]}><sphereGeometry args={[2.4, 8, 8]} /><meshLambertMaterial color="#0f2010" /></mesh>
      {[0, 1, 2].map(i => {
        const a = (i / 3) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 1.3, 6 + i * 0.4, Math.sin(a) * 1.3]}>
            <sphereGeometry args={[0.2, 5, 5]} />
            <meshBasicMaterial color={`hsl(${(hue + i * 40) % 360},100%,68%)`} />
          </mesh>
        );
      })}
      <pointLight position={[0, 6, 0]} intensity={0.9} color={`hsl(${hue},100%,60%)`} distance={8} decay={2} />
    </group>
  );
}

// ── Agent DJ booth ────────────────────────────────────────────────────────────
function AgentBooth({ x, z, isActive, isSelected, isMine, onClick, seed }) {
  const lightRef = useRef();
  const ledRef   = useRef();
  const hue      = Math.floor(rng(seed) * 360);

  useFrame((s) => {
    const t = s.clock.elapsedTime + seed;
    if (lightRef.current) {
      lightRef.current.intensity = isActive ? 4 + Math.sin(t * 8) * 3 : 0.8 + Math.sin(t * 1.5) * 0.3;
      lightRef.current.color.setHSL(((t * 0.25 + seed * 0.5) % 1), 1, 0.55);
    }
    if (ledRef.current) ledRef.current.material.opacity = isActive ? 0.9 + Math.sin(t * 12) * 0.1 : 0.3;
  });

  return (
    <group position={[x, 0, z]} onClick={onClick}>
      <mesh position={[0, 0.25, 0]}>
        <boxGeometry args={[4.0, 0.5, 3.4]} />
        <meshLambertMaterial color={isSelected ? "#2a1540" : "#0e0c1c"} />
      </mesh>
      <mesh position={[0, 0.9, -0.8]}>
        <boxGeometry args={[2.8, 0.85, 1.0]} />
        <meshLambertMaterial color="#0a0812" />
      </mesh>
      {[-0.65, 0.65].map((sx, i) => (
        <mesh key={i} position={[sx, 1.32, -0.8]} rotation={[-Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.4, 0.4, 0.07, 16]} />
          <meshLambertMaterial color="#1a1825" />
        </mesh>
      ))}
      {[-1.5, 1.5].map((sx, i) => (
        <group key={i} position={[sx, 0, -0.1]}>
          <mesh position={[0, 1.2, 0]}><boxGeometry args={[0.9, 2.0, 0.75]} /><meshLambertMaterial color="#0a0812" /></mesh>
          <mesh position={[0, 1.2, 0.39]}>
            <circleGeometry args={[0.32, 12]} />
            <meshBasicMaterial color={isActive ? `hsl(${hue},100%,60%)` : "#111"} />
          </mesh>
        </group>
      ))}
      <mesh ref={ledRef} position={[0, 0.52, 1.72]}>
        <boxGeometry args={[4.0, 0.12, 0.06]} />
        <meshBasicMaterial color={`hsl(${hue},100%,65%)`} transparent opacity={0.3} />
      </mesh>
      {isActive && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <circleGeometry args={[3.2, 24]} />
          <meshBasicMaterial color={`hsl(${hue},100%,60%)`} transparent opacity={0.14} />
        </mesh>
      )}
      <pointLight ref={lightRef} position={[0, 3, 0]}
        intensity={0.8} color={`hsl(${hue},100%,60%)`} distance={13} decay={2} />
      {/* isMine: purple spotlight ring on ground */}
      {isMine && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
          <ringGeometry args={[2.8, 3.5, 28]} />
          <meshBasicMaterial color="#a855f7" transparent opacity={0.55} side={THREE.DoubleSide} />
        </mesh>
      )}
      {isMine && <pointLight position={[0, 5, 0]} intensity={3} color="#a855f7" distance={10} decay={2} />}
    </group>
  );
}

// ── Main 3D scene ─────────────────────────────────────────────────────────────
function TomorrowlandScene({ agents, activeAgents, selected, onSelect, positions, myAgents }) {
  const anyActive = activeAgents.size > 0;

  return (
    <>
      <color attach="background" args={["#040210"]} />
      <fog attach="fog" color="#07041a" near={70} far={210} />

      <ambientLight intensity={0.85} color="#2a1858" />
      <directionalLight position={[-15, 40, 10]} intensity={1.1} color="#cc99ff" />
      <directionalLight position={[20, 30, 25]} intensity={0.55} color="#ff88cc" />
      <hemisphereLight args={["#1a0840", "#0a0418", 0.45]} />

      <FestivalGround />
      <LakeAndBridge />
      <Mainstage anyActive={anyActive} />
      <FerrisWheel />
      <FestivalCrowd anyActive={anyActive} />
      <Fireworks anyActive={anyActive} />
      <Confetti active={anyActive} />

      {LED_TOWER_SPOTS.map((t, i) => <LightTower key={i} x={t[0]} z={t[1]} seed={i + 2} />)}
      {TOTEM_SPOTS.map((t, i) => <TotemPole key={i} x={t.x} z={t.z} seed={t.seed} />)}
      {TREE_SPOTS.map((t, i) => <EnchantedTree key={i} x={t[0]} z={t[1]} seed={i + 8} />)}

      {positions.map((p, i) => {
        const agent = agents[i];
        if (!agent) return null;
        return (
          <AgentBooth
            key={agent.id}
            x={p.x}
            z={p.z}
            isActive={activeAgents.has(agent.id)}
            isSelected={selected === agent.id}
            isMine={myAgents.has(agent.id)}
            onClick={() => onSelect(agent.id === selected ? null : agent.id)}
            seed={i + 5}
          />
        );
      })}

      <OrbitControls makeDefault minPolarAngle={0.1} maxPolarAngle={Math.PI / 2.2}
        minDistance={8} maxDistance={100} target={[0, 4, -20]} />
      <EffectComposer>
        <Bloom mipmapBlur luminanceThreshold={0.07} luminanceSmoothing={0.28} intensity={2.2} />
      </EffectComposer>
    </>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function TomorrowlandWorld() {
  const [agents,       setAgents]       = useState([]);
  const [activeAgents, setActiveAgents] = useState(new Set());
  const [selected,     setSelected]     = useState(null);
  const [wsRetry,      setWsRetry]      = useState(0);
  const [toasts,       setToasts]       = useState([]);

  const username = useMyUsername();
  const myAgents = useMemo(
    () => new Set(agents.filter(a => a.developer_name === username).map(a => a.id)),
    [agents, username]
  );

  const positions = useMemo(() => layoutAgents(agents), [agents]);

  useEffect(() => {
    fetch(`${API}/agents`).then(r => r.json()).then(setAgents).catch(() => {});
  }, []);

  useEffect(() => {
    const ws = new WebSocket(WS);
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "agent_active") {
          setActiveAgents(prev => new Set([...prev, msg.agent_id]));
          const agent = agents.find(a => a.id === msg.agent_id);
          if (agent) {
            const id = Date.now();
            setToasts(t => [...t, { id, text: `${agent.name} dropped a track 🔥` }]);
            setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
          }
          setTimeout(() => setActiveAgents(prev => {
            const next = new Set(prev); next.delete(msg.agent_id); return next;
          }), 5500);
        }
      } catch {}
    };
    ws.onclose = () => setTimeout(() => setWsRetry(n => n + 1), 3000);
    return () => ws.close();
  }, [wsRetry, agents]);

  const selectedAgent = selected ? agents.find(a => a.id === selected) : null;

  return (
    <div style={{ width:"100%", height:"100%", background:"#040210", position:"relative", fontFamily:"monospace" }}>
      <Canvas camera={{ position:[0, 22, 35], fov:60 }} gl={{ antialias:true }}>
        <TomorrowlandScene agents={agents} activeAgents={activeAgents}
          selected={selected} onSelect={setSelected} positions={positions} myAgents={myAgents} />
      </Canvas>

      {/* Top left info */}
      <div style={{ position:"absolute", top:16, left:16, color:"#cc88ff",
        fontSize:11, lineHeight:2.1, opacity:0.9, pointerEvents:"none",
        textShadow:"0 0 10px #aa44ff" }}>
        <div style={{ fontSize:16, fontWeight:700, letterSpacing:3 }}>TOMORROWLAND</div>
        <div>CROWD: {(CROWD.length * 1000).toLocaleString()}</div>
        <div>AGENTS: {agents.length} LIVE</div>
        <div>ON STAGE: {activeAgents.size}</div>
      </div>

      {/* Toasts */}
      <div style={{ position:"absolute", top:16, right:16, display:"flex", flexDirection:"column", gap:8 }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background:"rgba(15,5,35,0.96)", border:"1px solid #cc44ff",
            borderRadius:8, padding:"8px 16px", fontSize:12, fontWeight:600, color:"#ee88ff",
            boxShadow:"0 0 18px #aa44ff44",
          }}>{t.text}</div>
        ))}
      </div>

      {/* My Agents badge */}
      {myAgents.size > 0 && (
        <div style={{
          position:"absolute", bottom:22, right:22,
          background:"rgba(8,4,22,0.92)", border:"1px solid #a855f7",
          borderRadius:8, padding:"8px 16px", color:"#c084fc",
          fontSize:11, letterSpacing:1,
          boxShadow:"0 0 16px #a855f744",
        }}>
          ◈ {myAgents.size} booth{myAgents.size !== 1 ? "s" : ""} yours
        </div>
      )}

      {/* Now Playing panel */}
      {selectedAgent && (
        <div style={{
          position:"absolute", bottom:24, left:"50%", transform:"translateX(-50%)",
          background:"rgba(8,4,22,0.97)", border:"1px solid #aa44ff",
          borderRadius:12, padding:"14px 22px", maxWidth:380, width:"90%",
          boxShadow:"0 0 32px #aa44ff33", color:"#cc88ff",
        }}>
          <div style={{ fontSize:9, letterSpacing:3, opacity:0.6, marginBottom:4 }}>NOW PLAYING</div>
          <div style={{ fontWeight:800, fontSize:15, color:"#fff", marginBottom:4 }}>{selectedAgent.name}</div>
          <div style={{ fontSize:10, opacity:0.6, lineHeight:1.6, marginBottom:10 }}>{selectedAgent.description}</div>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ fontSize:10, padding:"3px 10px", border:"1px solid #aa44ff66", borderRadius:20, color:"#aa88ff" }}>
              {selectedAgent.category?.toUpperCase()}
            </div>
            <div style={{ fontSize:10, color:"#ff88ff" }}>
              BPM {128 + Math.floor(rng(selectedAgent.id + 99) * 32)}
            </div>
            <button onClick={() => setSelected(null)} style={{
              marginLeft:"auto", background:"none", border:"none",
              color:"#aa88ff", cursor:"pointer", fontSize:14,
            }}>✕</button>
          </div>
        </div>
      )}
    </div>
  );
}
