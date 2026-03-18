"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

import { API, WS } from "@/app/lib/config";
import { useMyUsername } from "@/app/lib/useMyUsername";

// House definitions
const HOUSES = {
  slytherin: { name: "Slytherin",  color: "#1a7a3a", categories: ["trading", "risk"] },
  ravenclaw: { name: "Ravenclaw",  color: "#3355cc", categories: ["data"] },
  hufflepuff:{ name: "Hufflepuff", color: "#d4a820", categories: ["analysis"] },
  gryffindor:{ name: "Gryffindor", color: "#cc2200", categories: ["composite"] },
};

function getHouse(agent) {
  const cat = (agent.category || "").toLowerCase();
  if (cat.includes("trading") || cat.includes("risk")) return "slytherin";
  if (cat.includes("data"))     return "ravenclaw";
  if (cat.includes("analysis")) return "hufflepuff";
  return "gryffindor";
}

function getHouseColor(agent) {
  return HOUSES[getHouse(agent)]?.color ?? "#cc2200";
}

// Deterministic seeded random
const rng = (seed) => {
  const x = Math.sin(seed + 1) * 43758.5453123;
  return x - Math.floor(x);
};

// Stone + amber window canvas texture helper
function makeStoneWindowTex() {
  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 256;
  const ctx = canvas.getContext("2d");

  // Stone base
  ctx.fillStyle = "#4a4a50";
  ctx.fillRect(0, 0, 256, 256);

  // Draw stone blocks
  const blockW = 32, blockH = 20;
  for (let row = 0; row < Math.ceil(256 / blockH); row++) {
    const offset = (row % 2) * (blockW / 2);
    for (let col = -1; col < Math.ceil(256 / blockW) + 1; col++) {
      const x = col * blockW + offset;
      const y = row * blockH;
      const gray = 55 + Math.floor(rng(row * 17 + col * 31) * 25);
      ctx.fillStyle = `rgb(${gray + 20},${gray + 18},${gray + 22})`;
      ctx.fillRect(x + 1, y + 1, blockW - 2, blockH - 2);
      ctx.strokeStyle = "#333336";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 1, y + 1, blockW - 2, blockH - 2);
    }
  }

  // Scatter amber-lit windows
  for (let i = 0; i < 18; i++) {
    const wx = 12 + rng(i * 7 + 1) * 230;
    const wy = 8 + rng(i * 7 + 2) * 230;
    const ww = 6 + rng(i * 7 + 3) * 6;
    const wh = 8 + rng(i * 7 + 4) * 8;
    const brightness = rng(i * 7 + 5);
    if (brightness > 0.3) {
      ctx.fillStyle = `rgba(255, ${160 + Math.floor(brightness * 60)}, 40, ${0.5 + brightness * 0.5})`;
      ctx.fillRect(wx, wy, ww, wh);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

// ── Hogwarts Castle ───────────────────────────────────────────────────────────
function HogwartsCastle({ position }) {
  const stoneTex = useMemo(() => makeStoneWindowTex(), []);

  return (
    <group position={position}>
      {/* ── Main Keep ── */}
      <mesh position={[0, 14, 0]}>
        <boxGeometry args={[30, 28, 20]} />
        <meshLambertMaterial map={stoneTex} color="#5a5860" />
      </mesh>

      {/* ── Battlements on main keep ── */}
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={`bm-front-${i}`} position={[(i - 4) * 3.5, 28.5, 10.2]}>
          <boxGeometry args={[2.2, 2.2, 0.8]} />
          <meshLambertMaterial color="#4a4850" />
        </mesh>
      ))}
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={`bm-back-${i}`} position={[(i - 4) * 3.5, 28.5, -10.2]}>
          <boxGeometry args={[2.2, 2.2, 0.8]} />
          <meshLambertMaterial color="#4a4850" />
        </mesh>
      ))}

      {/* ── Great Hall Wing (extends left) ── */}
      <mesh position={[-22, 10, -2]}>
        <boxGeometry args={[16, 20, 18]} />
        <meshLambertMaterial map={stoneTex} color="#58565e" />
      </mesh>
      {/* Vaulted roof over great hall */}
      <mesh position={[-22, 22, -2]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.1, 9, 14, 4, 1, false, Math.PI / 4, Math.PI / 2]} />
        <meshLambertMaterial color="#4a4255" />
      </mesh>
      <mesh position={[-22, 20.5, -2]}>
        <boxGeometry args={[16.2, 2, 18.2]} />
        <meshLambertMaterial color="#4a4255" />
      </mesh>

      {/* ── Astronomy Tower (tallest) ── */}
      <mesh position={[12, 30, -6]}>
        <cylinderGeometry args={[3.5, 4, 60, 10]} />
        <meshLambertMaterial map={stoneTex} color="#555360" />
      </mesh>
      <mesh position={[12, 62, -6]}>
        <coneGeometry args={[4.2, 12, 10]} />
        <meshLambertMaterial color="#2a2540" />
      </mesh>
      {/* Astronomy tower battlements */}
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return (
          <mesh key={`ast-bm-${i}`} position={[12 + Math.cos(a) * 4, 61, -6 + Math.sin(a) * 4]}>
            <boxGeometry args={[1.2, 2, 0.8]} />
            <meshLambertMaterial color="#4a4850" />
          </mesh>
        );
      })}

      {/* ── Clock Tower ── */}
      <mesh position={[-8, 22, 8]}>
        <boxGeometry args={[8, 44, 8]} />
        <meshLambertMaterial map={stoneTex} color="#525060" />
      </mesh>
      {/* Clock face */}
      <mesh position={[-8, 30, 12.1]}>
        <circleGeometry args={[2.8, 24]} />
        <meshBasicMaterial color="#e8e0c0" />
      </mesh>
      {/* Clock hands */}
      <mesh position={[-8, 30, 12.3]} rotation={[0, 0, 0.5]}>
        <boxGeometry args={[0.2, 2.2, 0.1]} />
        <meshBasicMaterial color="#222" />
      </mesh>
      <mesh position={[-8, 30, 12.3]} rotation={[0, 0, 1.8]}>
        <boxGeometry args={[0.18, 1.6, 0.1]} />
        <meshBasicMaterial color="#333" />
      </mesh>
      {/* Clock tower battlements */}
      {Array.from({ length: 5 }, (_, i) => (
        <mesh key={`ct-bm-${i}`} position={[-8 + (i - 2) * 2, 45, 4.2]}>
          <boxGeometry args={[1.4, 2, 0.8]} />
          <meshLambertMaterial color="#4a4850" />
        </mesh>
      ))}

      {/* ── Corner Turrets ── */}
      {[
        [-16, 18, 11], [16, 18, 11], [-16, 21, -11], [16, 24, -11],
        [-30, 15, 5],  [30, 15, 5],
      ].map(([tx, th, tz], i) => (
        <group key={`turret-${i}`} position={[tx, 0, tz]}>
          <mesh position={[0, th / 2, 0]}>
            <cylinderGeometry args={[2.8, 3.2, th, 10]} />
            <meshLambertMaterial map={stoneTex} color="#524f5e" />
          </mesh>
          <mesh position={[0, th + 4, 0]}>
            <coneGeometry args={[3.5, 9, 10]} />
            <meshLambertMaterial color="#2e2a42" />
          </mesh>
          {Array.from({ length: 7 }, (_, j) => {
            const a = (j / 7) * Math.PI * 2;
            return (
              <mesh key={j} position={[Math.cos(a) * 3.1, th + 0.5, Math.sin(a) * 3.1]}>
                <boxGeometry args={[1.0, 1.8, 0.7]} />
                <meshLambertMaterial color="#4a4850" />
              </mesh>
            );
          })}
        </group>
      ))}

      {/* ── Smaller Spire Towers ── */}
      {[
        [6, -8], [-5, 9], [18, 8], [-18, -7],
      ].map(([tx, tz], i) => (
        <group key={`spire-${i}`} position={[tx, 0, tz]}>
          <mesh position={[0, 10, 0]}>
            <cylinderGeometry args={[1.6, 2.0, 20, 8]} />
            <meshLambertMaterial color="#504d5c" />
          </mesh>
          <mesh position={[0, 22, 0]}>
            <coneGeometry args={[2.2, 8, 8]} />
            <meshLambertMaterial color="#2a2640" />
          </mesh>
        </group>
      ))}

      {/* ── Connecting Walls ── */}
      {/* Main keep to great hall */}
      <mesh position={[-7.5, 8, -2]}>
        <boxGeometry args={[3, 16, 14]} />
        <meshLambertMaterial color="#525060" />
      </mesh>
      {/* South connecting wall approach */}
      <mesh position={[0, 5, 14]}>
        <boxGeometry args={[18, 10, 3]} />
        <meshLambertMaterial color="#504e5c" />
      </mesh>

      {/* ── Viaduct Bridge (arched approach from south) ── */}
      <group position={[0, 0, 22]}>
        {/* Bridge deck */}
        <mesh position={[0, 4.5, 0]}>
          <boxGeometry args={[10, 1, 28]} />
          <meshLambertMaterial color="#4e4c58" />
        </mesh>
        {/* Bridge arches */}
        {[-8, -2, 4, 10].map((az, i) => (
          <group key={i} position={[0, 0, az]}>
            <mesh position={[-4.5, 2.5, 0]}>
              <cylinderGeometry args={[0.6, 0.8, 5, 6]} />
              <meshLambertMaterial color="#484650" />
            </mesh>
            <mesh position={[4.5, 2.5, 0]}>
              <cylinderGeometry args={[0.6, 0.8, 5, 6]} />
              <meshLambertMaterial color="#484650" />
            </mesh>
            <mesh position={[0, 4, 0]}>
              <torusGeometry args={[4.5, 0.55, 6, 12, Math.PI]} />
              <meshLambertMaterial color="#484650" />
            </mesh>
          </group>
        ))}
        {/* Viaduct side railings */}
        {[-4.7, 4.7].map((rx, i) => (
          <mesh key={i} position={[rx, 5.8, 0]}>
            <boxGeometry args={[0.4, 1.5, 28]} />
            <meshLambertMaterial color="#4a4858" />
          </mesh>
        ))}
      </group>

      {/* ── House Banners ── */}
      {[
        { pos: [-15, 26, 10.4], color: "#cc2200" },  // Gryffindor
        { pos: [0,   26, 10.4], color: "#3355cc" },  // Ravenclaw
        { pos: [-30, 22, 3.3],  color: "#1a7a3a" },  // Slytherin
        { pos: [30,  22, 3.3],  color: "#d4a820" },  // Hufflepuff
      ].map((b, i) => (
        <group key={`banner-${i}`} position={b.pos}>
          <mesh>
            <planeGeometry args={[2.5, 6.5]} />
            <meshLambertMaterial color={b.color} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 3.5, 0]}>
            <boxGeometry args={[2.8, 0.3, 0.2]} />
            <meshBasicMaterial color="#c8a030" />
          </mesh>
        </group>
      ))}

      {/* ── Castle warm glow lights ── */}
      <pointLight position={[-22, 12, 5]}  intensity={3} color="#ffaa44" distance={25} decay={2} />
      <pointLight position={[10,  18, 5]}  intensity={2.5} color="#ffbb55" distance={22} decay={2} />
      <pointLight position={[12,  35, -3]} intensity={2} color="#ffcc66" distance={18} decay={2} />
      <pointLight position={[-8,  28, 2]}  intensity={1.8} color="#ffaa33" distance={20} decay={2} />
    </group>
  );
}

// ── Great Hall Floating Candles ───────────────────────────────────────────────
const GH_CANDLES = 180;
function GreatHallGlow() {
  const bodyRef  = useRef();
  const flameRef = useRef();
  const dummy    = useMemo(() => new THREE.Object3D(), []);
  const phases   = useMemo(() => Array.from({ length: GH_CANDLES }, (_, i) => rng(i * 13) * Math.PI * 2), []);

  // Great hall area footprint centered around [-22, y, -2] in world space (relative to castle [-80])
  // So in local world coords, candles float above around x: -50 to -10, z: -85 to -75
  const positions = useMemo(() => Array.from({ length: GH_CANDLES }, (_, i) => ({
    x: -50 + rng(i * 7 + 1) * 40,
    z: -90 + rng(i * 7 + 2) * 20,
    baseY: 9 + rng(i * 7 + 3) * 9,
  })), []);

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    const bm = bodyRef.current;
    const fm = flameRef.current;
    if (!bm || !fm) return;

    positions.forEach((p, i) => {
      const bob = Math.sin(t * 0.8 + phases[i]) * 0.6;
      dummy.position.set(p.x, p.baseY + bob, p.z);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      bm.setMatrixAt(i, dummy.matrix);

      dummy.position.set(p.x, p.baseY + bob + 0.65, p.z);
      dummy.scale.setScalar(0.38);
      dummy.updateMatrix();
      fm.setMatrixAt(i, dummy.matrix);
    });
    bm.instanceMatrix.needsUpdate = true;
    fm.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={bodyRef} args={[null, null, GH_CANDLES]}>
        <cylinderGeometry args={[0.08, 0.1, 1.2, 5]} />
        <meshLambertMaterial color="#f5f0e0" />
      </instancedMesh>
      <instancedMesh ref={flameRef} args={[null, null, GH_CANDLES]}>
        <sphereGeometry args={[1, 5, 5]} />
        <meshBasicMaterial color="#ffe080" />
      </instancedMesh>
    </>
  );
}

// ── Black Lake ────────────────────────────────────────────────────────────────
function BlackLake({ position }) {
  const tentacleRef = useRef();
  const tentState   = useRef({ phase: 0, timer: 0 });

  useFrame((s, dt) => {
    const tm = tentacleRef.current;
    if (!tm) return;
    tentState.current.timer += dt;
    const cycle = 10; // seconds per cycle
    const t = tentState.current.timer % cycle;
    let scaleY;
    if (t < 2.5) {
      // Rising
      scaleY = t / 2.5;
    } else if (t < 4.5) {
      // Holding
      scaleY = 1;
    } else if (t < 7) {
      // Sinking
      scaleY = 1 - (t - 4.5) / 2.5;
    } else {
      scaleY = 0;
    }
    tm.scale.set(1, Math.max(0.001, scaleY), 1);
  });

  return (
    <group position={position}>
      {/* Lake surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <planeGeometry args={[60, 45]} />
        <meshLambertMaterial color="#040c14" />
      </mesh>

      {/* Light reflection patches */}
      {[[-8, 0, -5], [5, 0, 8], [12, 0, -12], [-5, 0, 15]].map((rp, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={rp}>
          <circleGeometry args={[4 + i * 1.5, 14]} />
          <meshBasicMaterial color="#1a3050" transparent opacity={0.18} />
        </mesh>
      ))}

      {/* Giant Squid tentacle */}
      <mesh ref={tentacleRef} position={[8, 0, -8]}>
        <cylinderGeometry args={[0.6, 1.1, 10, 7]} />
        <meshLambertMaterial color="#0d1820" />
      </mesh>
    </group>
  );
}

// ── Quidditch Pitch ───────────────────────────────────────────────────────────
function QuidditchPitch({ position }) {
  const snitchRef   = useRef();
  const broomRefs   = useRef([]);
  const snitchAngle = useRef(0);

  const BROOM_COUNT = 4;
  const broomAngles = useRef(Array.from({ length: BROOM_COUNT }, (_, i) => (i / BROOM_COUNT) * Math.PI * 2));

  useFrame((s, dt) => {
    // Golden snitch — figure-8 orbit
    snitchAngle.current += dt * 0.9;
    const sa = snitchAngle.current;
    if (snitchRef.current) {
      snitchRef.current.position.set(
        Math.sin(sa) * 14,
        8 + Math.sin(sa * 2) * 4,
        Math.cos(sa) * 10
      );
    }

    // Broom riders orbiting in oval
    broomAngles.current = broomAngles.current.map((a, i) => a + dt * (0.5 + i * 0.05));
    broomRefs.current.forEach((m, i) => {
      if (!m) return;
      const a = broomAngles.current[i];
      m.position.set(Math.cos(a) * 18, 10 + Math.sin(a * 2) * 2, Math.sin(a) * 10);
      m.rotation.y = -a + Math.PI / 2;
    });
  });

  return (
    <group position={position}>
      {/* Grass field */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <planeGeometry args={[44, 26]} />
        <meshLambertMaterial color="#1a3810" />
      </mesh>
      {/* Pitch lines */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <planeGeometry args={[0.3, 26]} />
        <meshBasicMaterial color="#2a5020" />
      </mesh>

      {/* Goal hoops: 3 at each end, heights 8/12/16 */}
      {[-1, 0, 1].map((side) =>
        [[-20, 0], [20, 0]].map(([ex, ez], ei) => (
          <group key={`hoop-${side}-${ei}`} position={[ex, 0, side * 5]}>
            <mesh position={[0, (8 + Math.abs(side) * 4) / 2, 0]}>
              <cylinderGeometry args={[0.2, 0.25, 8 + Math.abs(side) * 4, 6]} />
              <meshLambertMaterial color="#888060" />
            </mesh>
            <mesh position={[0, 8 + Math.abs(side) * 4, 0]}>
              <torusGeometry args={[1.5, 0.22, 7, 18]} />
              <meshLambertMaterial color="#a09050" />
            </mesh>
          </group>
        ))
      )}

      {/* Score towers */}
      {[-12, 12].map((sz, i) => (
        <group key={`score-${i}`} position={[0, 0, sz]}>
          <mesh position={[0, 4, 0]}>
            <boxGeometry args={[4, 8, 3]} />
            <meshLambertMaterial color="#3a3830" />
          </mesh>
          <mesh position={[0, 8.5, 0]}>
            <boxGeometry args={[4.2, 1, 3.2]} />
            <meshLambertMaterial color="#2e2c28" />
          </mesh>
        </group>
      ))}

      {/* Golden Snitch */}
      <mesh ref={snitchRef} position={[0, 10, 0]}>
        <sphereGeometry args={[0.45, 8, 8]} />
        <meshBasicMaterial color="#ffd700" />
      </mesh>

      {/* Broom riders */}
      {Array.from({ length: BROOM_COUNT }, (_, i) => (
        <group key={`broom-${i}`} ref={el => { broomRefs.current[i] = el; }}>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[1.0, 0.28, 0.28]} />
            <meshBasicMaterial color="#c8a060" />
          </mesh>
          <mesh position={[0.6, -0.2, 0]}>
            <cylinderGeometry args={[0.05, 0.22, 1.0, 5]} />
            <meshBasicMaterial color="#8b6040" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ── Forbidden Forest ──────────────────────────────────────────────────────────
const FOREST_TREES = Array.from({ length: 42 }, (_, i) => {
  const side = i < 21 ? 1 : -1;
  const idx = i % 21;
  return {
    x: side * (55 + rng(i * 11 + 1) * 14),
    z: -40 + rng(i * 11 + 2) * 70,
    h: 10 + rng(i * 11 + 3) * 12,
    seed: i,
  };
});

function ForbiddenForest() {
  return (
    <>
      {FOREST_TREES.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]}>
          {/* Trunk */}
          <mesh position={[0, t.h * 0.28, 0]}>
            <cylinderGeometry args={[0.35, 0.5, t.h * 0.55, 6]} />
            <meshLambertMaterial color="#1a1208" />
          </mesh>
          {/* Canopy */}
          <mesh position={[0, t.h * 0.7, 0]}>
            <coneGeometry args={[t.h * 0.22, t.h * 0.65, 7]} />
            <meshLambertMaterial color="#0a1408" />
          </mesh>
          {/* Occasional ghost light */}
          {rng(i * 37) > 0.82 && (
            <mesh position={[rng(i) * 4 - 2, t.h * 0.4, rng(i * 2) * 4 - 2]}>
              <sphereGeometry args={[0.3, 6, 6]} />
              <meshBasicMaterial color="#e0ffe8" transparent opacity={0.18} />
            </mesh>
          )}
        </group>
      ))}
    </>
  );
}

// ── Hagrid's Hut ──────────────────────────────────────────────────────────────
function HagridHut({ position }) {
  return (
    <group position={position}>
      {/* Hut body */}
      <mesh position={[0, 3.5, 0]}>
        <cylinderGeometry args={[3.2, 3.8, 7, 10]} />
        <meshLambertMaterial color="#5a5250" />
      </mesh>
      {/* Thatched roof */}
      <mesh position={[0, 8.2, 0]}>
        <coneGeometry args={[4.2, 5.5, 10]} />
        <meshLambertMaterial color="#5c3a00" />
      </mesh>
      {/* Door */}
      <mesh position={[0, 1.8, 3.82]}>
        <boxGeometry args={[1.6, 3.2, 0.2]} />
        <meshLambertMaterial color="#3a2010" />
      </mesh>
      {/* Window warm glow */}
      <mesh position={[2.0, 3.5, 3.0]}>
        <circleGeometry args={[0.7, 8]} />
        <meshBasicMaterial color="#ffcc66" />
      </mesh>
      <pointLight position={[2, 3.5, 3.5]} intensity={1.5} color="#ffaa44" distance={10} decay={2} />
      {/* Pumpkin patch */}
      {[[-1.5, 0, 5], [0, 0, 5.5], [1.5, 0, 4.8], [-0.5, 0, 6.2]].map((pp, i) => (
        <mesh key={i} position={pp}>
          <sphereGeometry args={[0.5 + rng(i) * 0.2, 7, 6]} />
          <meshLambertMaterial color="#c85010" />
        </mesh>
      ))}
    </group>
  );
}

// ── Floating Candles (grounds) ────────────────────────────────────────────────
const CANDLE_COUNT = 200;
const CANDLE_DATA  = Array.from({ length: CANDLE_COUNT }, (_, i) => ({
  x:     (rng(i * 7 + 1) - 0.5) * 80,
  z:     -10 - rng(i * 7 + 2) * 55,
  baseY:  3 + rng(i * 7 + 3) * 5,
  phase:  rng(i * 7 + 4) * Math.PI * 2,
}));

function FloatingCandles({ active }) {
  const bodyRef  = useRef();
  const flameRef = useRef();
  const dummy    = useMemo(() => new THREE.Object3D(), []);

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    const bm = bodyRef.current;
    const fm = flameRef.current;
    if (!bm || !fm) return;

    const speed   = active ? 1.8 : 0.6;
    const riseAmt = active ? 3.0 : 0.0;

    CANDLE_DATA.forEach((c, i) => {
      const bob = Math.sin(t * speed + c.phase) * 0.5;
      const y = c.baseY + riseAmt + bob;
      dummy.position.set(c.x, y, c.z);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      bm.setMatrixAt(i, dummy.matrix);

      dummy.position.set(c.x, y + 0.7, c.z);
      dummy.scale.setScalar(0.4);
      dummy.updateMatrix();
      fm.setMatrixAt(i, dummy.matrix);
    });
    bm.instanceMatrix.needsUpdate = true;
    fm.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={bodyRef} args={[null, null, CANDLE_COUNT]}>
        <cylinderGeometry args={[0.07, 0.09, 1.0, 5]} />
        <meshBasicMaterial color="#f0ece0" />
      </instancedMesh>
      <instancedMesh ref={flameRef} args={[null, null, CANDLE_COUNT]}>
        <sphereGeometry args={[1, 5, 5]} />
        <meshBasicMaterial color="#ffcc44" />
      </instancedMesh>
    </>
  );
}

// ── Flying Owls ───────────────────────────────────────────────────────────────
const OWL_COUNT = 25;
const OWL_DATA  = Array.from({ length: OWL_COUNT }, (_, i) => ({
  radius: 30 + rng(i * 3 + 1) * 20,
  speed:  0.12 + rng(i * 3 + 2) * 0.15,
  phase:  rng(i * 3 + 3) * Math.PI * 2,
  baseY:  30 + rng(i * 3 + 4) * 20,
  swoop:  false,
  swoopTimer: 0,
}));

function FlyingOwls({ active }) {
  const bodyRef = useRef();
  const wingLRef = useRef();
  const wingRRef = useRef();
  const dummy   = useMemo(() => new THREE.Object3D(), []);
  const owlState = useRef(OWL_DATA.map(d => ({ ...d })));

  const prevActive = useRef(false);

  useEffect(() => {
    if (active && !prevActive.current) {
      // Trigger a few owls to swoop
      const n = 3 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) {
        const idx = Math.floor(Math.random() * OWL_COUNT);
        owlState.current[idx].swoop = true;
        owlState.current[idx].swoopTimer = 0;
      }
    }
    prevActive.current = active;
  }, [active]);

  useFrame((s, dt) => {
    const t = s.clock.elapsedTime;
    const bm = bodyRef.current;
    const lm = wingLRef.current;
    const rm = wingRRef.current;
    if (!bm || !lm || !rm) return;

    owlState.current.forEach((o, i) => {
      if (o.swoop) {
        o.swoopTimer += dt;
        // swoop down then back up over 4 seconds
        const st = o.swoopTimer;
        if (st > 4) { o.swoop = false; }
      }

      const angle = t * o.speed + o.phase;
      let y = o.baseY + Math.sin(t * 0.3 + o.phase) * 3;
      if (o.swoop) {
        const swoopY = Math.sin((o.swoopTimer / 4) * Math.PI) * 22;
        y -= swoopY;
      }

      const x = Math.cos(angle) * o.radius;
      const z = Math.sin(angle) * o.radius - 50; // orbit around castle

      dummy.position.set(x, y, z);
      dummy.rotation.y = -angle;
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      bm.setMatrixAt(i, dummy.matrix);

      const wingFlap = Math.sin(t * 3.5 + o.phase) * 0.5;
      // Left wing
      dummy.position.set(x + Math.cos(angle + Math.PI / 2) * 1.0, y + wingFlap * 0.3, z + Math.sin(angle + Math.PI / 2) * 1.0);
      dummy.rotation.y = -angle;
      dummy.rotation.z = wingFlap - 0.3;
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      lm.setMatrixAt(i, dummy.matrix);

      // Right wing
      dummy.position.set(x + Math.cos(angle - Math.PI / 2) * 1.0, y + wingFlap * 0.3, z + Math.sin(angle - Math.PI / 2) * 1.0);
      dummy.rotation.y = -angle;
      dummy.rotation.z = -wingFlap + 0.3;
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      rm.setMatrixAt(i, dummy.matrix);
    });

    bm.instanceMatrix.needsUpdate = true;
    lm.instanceMatrix.needsUpdate = true;
    rm.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      {/* Body */}
      <instancedMesh ref={bodyRef} args={[null, null, OWL_COUNT]}>
        <boxGeometry args={[0.6, 0.9, 0.55]} />
        <meshBasicMaterial color="#c8b890" />
      </instancedMesh>
      {/* Left wing */}
      <instancedMesh ref={wingLRef} args={[null, null, OWL_COUNT]}>
        <boxGeometry args={[1.6, 0.12, 0.7]} />
        <meshBasicMaterial color="#b8a880" />
      </instancedMesh>
      {/* Right wing */}
      <instancedMesh ref={wingRRef} args={[null, null, OWL_COUNT]}>
        <boxGeometry args={[1.6, 0.12, 0.7]} />
        <meshBasicMaterial color="#b8a880" />
      </instancedMesh>
    </>
  );
}

// ── Wizard Students ───────────────────────────────────────────────────────────
function WizardStudents({ agents, activeAgents, myAgents, onSelect }) {
  const positions = useMemo(() => agents.map((a, i) => {
    const row = Math.floor(i / 8);
    const col = i % 8;
    return {
      x: (col - 3.5) * 7,
      z: 15 + row * 8,
    };
  }), [agents.length]);

  return (
    <>
      {agents.map((agent, i) => {
        const p = positions[i];
        if (!p) return null;
        const houseColor = getHouseColor(agent);
        const isActive   = activeAgents.has(agent.id);
        const phase      = rng(i * 17 + 1) * Math.PI * 2;

        return (
          <WizardFigure
            key={agent.id}
            position={[p.x, 0, p.z]}
            color={houseColor}
            isActive={isActive}
            isMine={myAgents.has(agent.id)}
            phase={phase}
            onClick={() => onSelect(agent)}
          />
        );
      })}
    </>
  );
}

function WizardFigure({ position, color, isActive, isMine, phase, onClick }) {
  const groupRef = useRef();
  const sparkRef = useRef();
  const indicatorRef = useRef();

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (groupRef.current) {
      // Gentle sway
      groupRef.current.rotation.z = Math.sin(t * 0.9 + phase) * 0.04;
      groupRef.current.position.y = Math.abs(Math.sin(t * 0.7 + phase)) * 0.1;
    }
    if (sparkRef.current) {
      sparkRef.current.visible = isActive;
      if (isActive) {
        sparkRef.current.material.opacity = 0.6 + Math.sin(t * 12 + phase) * 0.4;
      }
    }
    if (indicatorRef.current) {
      indicatorRef.current.visible = isActive;
      if (isActive) {
        indicatorRef.current.rotation.y = t * 2 + phase;
        indicatorRef.current.position.y = 5.2 + Math.sin(t * 2 + phase) * 0.3;
      }
    }
  });

  return (
    <group ref={groupRef} position={position} onClick={onClick} onPointerOver={() => document.body.style.cursor = "pointer"} onPointerOut={() => document.body.style.cursor = "default"}>
      {/* Robe body */}
      <mesh position={[0, 1.4, 0]}>
        <cylinderGeometry args={[0.22, 0.35, 2.8, 7]} />
        <meshLambertMaterial color={color} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 3.1, 0]}>
        <sphereGeometry args={[0.3, 7, 7]} />
        <meshLambertMaterial color="#e8c8a0" />
      </mesh>
      {/* Pointy hat */}
      <mesh position={[0, 3.9, 0]}>
        <coneGeometry args={[0.28, 0.85, 7]} />
        <meshLambertMaterial color={color} />
      </mesh>
      {/* Wand */}
      <mesh position={[0.35, 2.0, 0.1]} rotation={[0.3, 0, 0.5]}>
        <cylinderGeometry args={[0.02, 0.03, 0.8, 4]} />
        <meshLambertMaterial color="#5c3a10" />
      </mesh>
      {/* Wand tip spark (when active) */}
      <mesh ref={sparkRef} position={[0.62, 2.45, 0.25]}>
        <sphereGeometry args={[0.12, 6, 6]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0} />
      </mesh>
      {/* Floating indicator (when active) */}
      <mesh ref={indicatorRef} position={[0, 5.2, 0]}>
        <octahedronGeometry args={[0.3, 0]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      {/* isMine: golden ring on ground */}
      {isMine && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.55, 0.9, 20]} />
          <meshBasicMaterial color="#d4a820" transparent opacity={0.75} side={THREE.DoubleSide} />
        </mesh>
      )}
      {isMine && <pointLight position={[0, 2, 0]} intensity={1.5} color="#d4a820" distance={5} decay={2} />}
    </group>
  );
}

// ── Spell Particles ───────────────────────────────────────────────────────────
const SPELL_COUNT = 100;
const HOUSE_COLORS_ARR = ["#cc2200", "#3355cc", "#1a7a3a", "#d4a820"];

function SpellParticles({ active }) {
  const ref   = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const col   = useMemo(() => new THREE.Color(), []);

  const parts = useRef(Array.from({ length: SPELL_COUNT }, (_, i) => ({
    x:    (rng(i * 5 + 1) - 0.5) * 60,
    y:    2 + rng(i * 5 + 2) * 4,
    z:    5 + rng(i * 5 + 3) * 30,
    vx:   (rng(i * 5 + 4) - 0.5) * 8,
    vy:   2 + rng(i * 5 + 5) * 5,
    vz:   (rng(i * 5 + 6) - 0.5) * 8,
    life: rng(i * 5 + 7),
    houseIdx: Math.floor(rng(i * 5 + 8) * 4),
  })));

  useFrame((s, dt) => {
    const m = ref.current; if (!m) return;
    parts.current.forEach((p, i) => {
      if (active) {
        p.life -= dt * 0.6;
        if (p.life <= 0) {
          p.x  = (rng(i + s.clock.elapsedTime * 0.1) - 0.5) * 60;
          p.y  = 2;
          p.z  = 5 + rng(i * 2 + s.clock.elapsedTime * 0.07) * 30;
          p.vx = (rng(i * 3 + s.clock.elapsedTime * 0.13) - 0.5) * 8;
          p.vy = 2 + rng(i * 4 + s.clock.elapsedTime * 0.11) * 5;
          p.vz = (rng(i * 5 + s.clock.elapsedTime * 0.09) - 0.5) * 8;
          p.life = 1.0;
          p.houseIdx = (p.houseIdx + 1) % 4;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.vy -= 6 * dt;

        const sc = Math.max(0.01, p.life * 0.5);
        dummy.position.set(p.x, p.y, p.z);
        dummy.scale.setScalar(sc);
      } else {
        dummy.position.set(0, -200, 0);
        dummy.scale.setScalar(0);
      }
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      col.set(HOUSE_COLORS_ARR[p.houseIdx]);
      m.setColorAt(i, col);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[null, null, SPELL_COUNT]}>
      <sphereGeometry args={[0.8, 5, 5]} />
      <meshBasicMaterial color="#ffffff" />
    </instancedMesh>
  );
}

// ── Castle Grounds ────────────────────────────────────────────────────────────
function CastleGrounds() {
  return (
    <>
      {/* Main grounds */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[300, 300]} />
        <meshLambertMaterial color="#0e1a0c" />
      </mesh>
      {/* Path to castle */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -20]}>
        <planeGeometry args={[12, 60]} />
        <meshLambertMaterial color="#1e1c18" />
      </mesh>
      {/* Courtyard area */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -65]}>
        <planeGeometry args={[45, 25]} />
        <meshLambertMaterial color="#16140e" />
      </mesh>
    </>
  );
}

// ── Main 3D scene ─────────────────────────────────────────────────────────────
function HogwartsScene({ agents, activeAgents, myAgents, onSelect }) {
  const anyActive = activeAgents.size > 0;

  return (
    <>
      <color attach="background" args={["#0a0818"]} />
      <fog attach="fog" args={["#0a0818", 80, 200]} />

      {/* Lighting */}
      <ambientLight intensity={0.4} color="#1a1030" />
      <directionalLight
        position={[-30, 60, 20]}
        intensity={0.6}
        color="#c0c8ff"
      />
      {/* Warm castle ambient fill */}
      <pointLight position={[0, 20, -50]} intensity={4} color="#ff9933" distance={80} decay={2} />
      <pointLight position={[-20, 12, -45]} intensity={2.5} color="#ffaa44" distance={55} decay={2} />

      <Stars radius={150} depth={50} count={2000} factor={4} saturation={0} fade />

      <CastleGrounds />
      <HogwartsCastle position={[0, 0, -80]} />
      <GreatHallGlow />
      <BlackLake position={[50, 0, -20]} />
      <QuidditchPitch position={[-55, 0, -10]} />
      <ForbiddenForest />
      <HagridHut position={[35, 0, 20]} />
      <FloatingCandles active={anyActive} />
      <FlyingOwls active={anyActive} />
      <WizardStudents agents={agents} activeAgents={activeAgents} myAgents={myAgents} onSelect={onSelect} />
      <SpellParticles active={anyActive} />

      <OrbitControls
        makeDefault
        maxPolarAngle={Math.PI / 2.1}
        minDistance={15}
        maxDistance={150}
        target={[0, 10, -20]}
      />
      <EffectComposer>
        <Bloom mipmapBlur luminanceThreshold={0.05} luminanceSmoothing={0.3} intensity={1.8} />
      </EffectComposer>
    </>
  );
}

// ── House Points UI ───────────────────────────────────────────────────────────
function HousePointsUI({ housePoints }) {
  return (
    <div style={{
      position: "absolute", top: 16, left: 16,
      background: "#2a1e0a", border: "1px solid #8B6914",
      borderRadius: 10, padding: "14px 18px",
      fontFamily: "'Georgia', serif",
      color: "#e8d8a0",
      boxShadow: "0 0 24px #8B691440",
      minWidth: 170,
    }}>
      <div style={{ fontSize: 11, letterSpacing: 2, marginBottom: 10, opacity: 0.7, textAlign: "center" }}>
        HOUSE POINTS
      </div>
      {Object.entries(HOUSES).map(([key, h]) => (
        <div key={key} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
          <div style={{
            width: 10, height: 10, borderRadius: "50%",
            background: h.color,
            boxShadow: `0 0 6px ${h.color}`,
            flexShrink: 0,
          }} />
          <span style={{ flex: 1, fontSize: 12 }}>{h.name}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: h.color }}>
            {housePoints[key] ?? 0}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Bottom overlay ────────────────────────────────────────────────────────────
function BottomOverlay({ agents, activeAgents }) {
  return (
    <div style={{
      position: "absolute", bottom: 22, left: "50%",
      transform: "translateX(-50%)",
      background: "rgba(18, 10, 4, 0.92)",
      border: "1px solid #8B6914",
      borderRadius: 10, padding: "12px 28px",
      fontFamily: "'Georgia', serif",
      color: "#e8d0a0",
      textAlign: "center",
      boxShadow: "0 0 28px #8B691430",
      pointerEvents: "none",
    }}>
      <div style={{ fontSize: 13, letterSpacing: 3, fontWeight: 700, marginBottom: 6, color: "#d4a820" }}>
        HOGWARTS SCHOOL OF WITCHCRAFT AND WIZARDRY
      </div>
      <div style={{ display: "flex", gap: 32, justifyContent: "center", fontSize: 11, opacity: 0.8 }}>
        <span>Wizards Enrolled: <strong style={{ color: "#e8d0a0" }}>{agents.length}</strong></span>
        <span>Currently Casting: <strong style={{ color: "#ff9944" }}>{activeAgents.size}</strong></span>
      </div>
    </div>
  );
}

// ── Toast Notifications ───────────────────────────────────────────────────────
function ToastList({ toasts }) {
  return (
    <div style={{ position: "absolute", top: 16, right: 16, display: "flex", flexDirection: "column", gap: 8 }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: "rgba(24, 14, 6, 0.97)",
          border: `1px solid ${t.houseColor}`,
          borderRadius: 8,
          padding: "8px 16px",
          fontSize: 12,
          fontWeight: 600,
          color: t.houseColor,
          fontFamily: "'Georgia', serif",
          boxShadow: `0 0 18px ${t.houseColor}44`,
          maxWidth: 260,
        }}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function HogwartsWorld() {
  const [agents,        setAgents]        = useState([]);
  const [activeAgents,  setActiveAgents]  = useState(new Set());
  const [wsRetry,       setWsRetry]       = useState(0);
  const [toasts,        setToasts]        = useState([]);
  const [housePoints,   setHousePoints]   = useState({ slytherin: 0, ravenclaw: 0, hufflepuff: 0, gryffindor: 0 });
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [agentRunning,  setAgentRunning]  = useState(false);
  const [agentResult,   setAgentResult]   = useState(null);

  const runAgent = async (agent) => {
    setAgentRunning(true);
    setAgentResult(null);
    try {
      const res = await fetch(`${API}/call-agent/${agent.id}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ market: "BTC" }),
      });
      const data = await res.json();
      setAgentResult(data);
    } catch {}
    setAgentRunning(false);
  };

  const username = useMyUsername();
  const myAgents = useMemo(
    () => new Set(agents.filter(a => a.developer_name === username).map(a => a.id)),
    [agents, username]
  );

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
            const house      = getHouse(agent);
            const houseColor = HOUSES[house]?.color ?? "#d4a820";

            // Increment house points
            setHousePoints(prev => ({ ...prev, [house]: (prev[house] ?? 0) + 10 }));

            // Toast
            const id = Date.now();
            setToasts(t => [...t, {
              id,
              text: `🦉 Owl Post — ${agent.name} cast a spell!`,
              houseColor,
            }]);
            setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4500);
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

  return (
    <div style={{ width: "100%", height: "100%", background: "#0a0818", position: "relative", fontFamily: "monospace" }}>
      <Canvas camera={{ position: [0, 30, 65], fov: 60 }} gl={{ antialias: true }}>
        <HogwartsScene agents={agents} activeAgents={activeAgents} myAgents={myAgents} onSelect={(a) => { setSelectedAgent(a); setAgentResult(null); }} />
      </Canvas>

      {/* Agent detail panel */}
      {selectedAgent && (
        <div style={{
          position: "absolute", top: 16, right: 16, width: 280, zIndex: 100,
          background: "rgba(10,8,24,0.97)", border: `1px solid ${getHouseColor(selectedAgent)}50`,
          borderTop: `3px solid ${getHouseColor(selectedAgent)}`,
          borderRadius: 14, padding: "18px 16px",
          boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 24px ${getHouseColor(selectedAgent)}20`,
          fontFamily: "'Georgia', serif",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <div style={{ color: getHouseColor(selectedAgent), fontWeight: 700, fontSize: 15, letterSpacing: 0.5 }}>
                {selectedAgent.name}
              </div>
              <div style={{ color: "#6b5c8a", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginTop: 3 }}>
                {HOUSES[getHouse(selectedAgent)]?.name} · {selectedAgent.category}
              </div>
            </div>
            <button onClick={() => { setSelectedAgent(null); setAgentResult(null); }} style={{
              background: "none", border: "none", color: "#4a3a6a",
              fontSize: 18, cursor: "pointer", lineHeight: 1, padding: 0,
            }}>×</button>
          </div>

          <div style={{ color: "#8878a8", fontSize: 12, lineHeight: 1.6, marginBottom: 14 }}>
            {selectedAgent.description || "A wizard agent of the " + HOUSES[getHouse(selectedAgent)]?.name + " house."}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, fontSize: 11 }}>
            <div style={{ color: "#4a3a6a" }}>Cost per cast</div>
            <div style={{ color: getHouseColor(selectedAgent), fontWeight: 700 }}>
              {Math.max(1, Math.round(selectedAgent.price_per_request * 100))} credits
            </div>
          </div>

          {agentResult && (
            <div style={{ background: "#0f0c1e", borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
              <div style={{ color: "#4a3a6a", fontSize: 9, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
                Spell Result
              </div>
              {Object.entries(agentResult)
                .filter(([k]) => !["market", "agent_id", "_mock"].includes(k))
                .slice(0, 5)
                .map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, lineHeight: 1.9 }}>
                    <span style={{ color: "#5a4a7a" }}>{k}</span>
                    <span style={{ color: "#e8d0a0", fontWeight: 700 }}>
                      {typeof v === "number" ? (v % 1 !== 0 ? v.toFixed(3) : v) : String(v).toUpperCase()}
                    </span>
                  </div>
                ))}
            </div>
          )}

          <button onClick={() => runAgent(selectedAgent)} disabled={agentRunning} style={{
            width: "100%", background: agentRunning ? "#1a1030" : getHouseColor(selectedAgent),
            color: agentRunning ? "#4a3a6a" : "#fff",
            border: "none", borderRadius: 8, padding: "10px",
            fontSize: 13, fontWeight: 700, cursor: agentRunning ? "default" : "pointer",
            letterSpacing: 0.5,
          }}>
            {agentRunning ? "Casting spell…" : agentResult ? "Cast Again" : "Cast Spell"}
          </button>
        </div>
      )}

      <HousePointsUI housePoints={housePoints} />
      <BottomOverlay agents={agents} activeAgents={activeAgents} />
      <ToastList toasts={toasts} />
      {myAgents.size > 0 && (
        <div style={{
          position: "absolute", bottom: 22, right: 22,
          background: "rgba(18,10,4,0.94)", border: "1px solid #d4a820",
          borderRadius: 8, padding: "8px 16px",
          fontFamily: "'Georgia', serif",
          color: "#d4a820", fontSize: 12, letterSpacing: 1,
          boxShadow: "0 0 16px #d4a82044",
        }}>
          ✦ {myAgents.size} wizard{myAgents.size !== 1 ? "s" : ""} yours
        </div>
      )}
    </div>
  );
}
