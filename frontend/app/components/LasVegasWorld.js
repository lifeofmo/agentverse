"use client";

import { useRef, useEffect, useState, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

import { API, WS } from "@/app/lib/config";
import { useMyUsername } from "@/app/lib/useMyUsername";

/* Strip runs along Z axis. North = positive Z. Camera scrolls in segments.
   Real-world south-to-north order is preserved. */
const SEGMENTS = [
  { z: 0,   label: "South Strip",  sub: "Luxor · Mandalay Bay · MGM · NY NY" },
  { z: 120, label: "Center Strip", sub: "Bellagio · Caesars · Paris · Cosmopolitan" },
  { z: 240, label: "North Strip",  sub: "Venetian · Mirage · Treasure Island · Wynn" },
  { z: 360, label: "Fremont St",   sub: "Stratosphere · Binion's · El Cortez" },
];

/* ── Canvas texture for windows ─────────────────────────────────────────────── */
function makeWinTex(cols, rows, bg, lit) {
  const c = document.createElement("canvas");
  c.width = 128; c.height = 128;
  const ctx = c.getContext("2d");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 128, 128);
  const cw = 128 / cols, ch = 128 / rows;
  for (let r = 0; r < rows; r++)
    for (let cc = 0; cc < cols; cc++) {
      ctx.fillStyle = Math.random() > 0.28 ? lit : "#111";
      ctx.fillRect(cc * cw + 1, r * ch + 1, cw - 2, ch - 2);
    }
  return new THREE.CanvasTexture(c);
}

/* ── Camera rig — lerps OrbitControls target along Z, preserving user orbit ── */
function CameraRig({ targetZ, controlsRef }) {
  useFrame(() => {
    const ctrl = controlsRef.current;
    if (!ctrl) return;
    const cur = ctrl.target.z;
    const delta = (targetZ - cur) * 0.06;
    if (Math.abs(delta) < 0.001) return;
    ctrl.target.z += delta;
    ctrl.object.position.z += delta;
    ctrl.update();
  });
  return null;
}

/* ── Shared road ────────────────────────────────────────────────────────────── */
function TheStrip() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[22, 500]} />
        <meshBasicMaterial color="#1c1c1c" />
      </mesh>
      {Array.from({ length: 50 }, (_, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -10 + i * 10]}>
          <planeGeometry args={[0.25, 4.5]} />
          <meshBasicMaterial color="#FFD700" />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-14, 0.005, 250]}>
        <planeGeometry args={[6, 500]} /><meshBasicMaterial color="#b8a898" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[14, 0.005, 250]}>
        <planeGeometry args={[6, 500]} /><meshBasicMaterial color="#b8a898" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 250]}>
        <planeGeometry args={[240, 500]} /><meshBasicMaterial color="#0e0e0e" />
      </mesh>
    </group>
  );
}

/* ── NeonBar (no lights) ────────────────────────────────────────────────────── */
function NeonBar({ position, color, width = 8, height = 1.2 }) {
  return (
    <mesh position={position}>
      <boxGeometry args={[width, height, 0.12]} />
      <meshBasicMaterial color={color} />
    </mesh>
  );
}

/* ══════════════════════════════════════════════════════════════
   SOUTH STRIP  (z ≈ -60 … +60)
══════════════════════════════════════════════════════════════ */

/* Welcome sign */
function WelcomeSign({ position }) {
  const ref = useRef(); const t = useRef(0);
  useFrame((_, dt) => {
    t.current += dt;
    if (ref.current) ref.current.material.opacity = 0.7 + Math.sin(t.current * 3) * 0.3;
  });
  return (
    <group position={position}>
      <mesh position={[0, 7, 0]}><cylinderGeometry args={[0.35, 0.35, 14, 7]} /><meshBasicMaterial color="#888" /></mesh>
      <mesh position={[0, 15, 0]} rotation={[0, 0, Math.PI / 4]}><boxGeometry args={[8, 8, 0.4]} /><meshBasicMaterial color="#cc0000" /></mesh>
      <mesh ref={ref} position={[0, 15, 0.3]}><boxGeometry args={[5, 2.5, 0.12]} /><meshBasicMaterial color="#FFD700" transparent opacity={0.9} /></mesh>
    </group>
  );
}

/* Mandalay Bay — gold curved tower */
function MandalayBay({ position }) {
  const tex = useMemo(() => makeWinTex(8, 12, "#3a2800", "#FFB300"), []);
  return (
    <group position={position}>
      <mesh position={[0, 25, 0]}><cylinderGeometry args={[10, 11, 50, 16]} /><meshLambertMaterial color="#8B6914" emissive="#3a2800" emissiveIntensity={0.3} /></mesh>
      <mesh position={[0, 25, 10.2]}><planeGeometry args={[19, 46]} /><meshBasicMaterial map={tex} transparent /></mesh>
      <NeonBar position={[0, 51, 0]} color="#FFB300" width={14} />
      <mesh position={[0, 51, 0]}><sphereGeometry args={[1.5, 8, 8]} /><meshBasicMaterial color="#FFB300" /></mesh>
    </group>
  );
}

/* Luxor */
function Luxor({ position }) {
  return (
    <group position={position}>
      <mesh><coneGeometry args={[20, 30, 4]} /><meshLambertMaterial color="#060b18" /></mesh>
      <mesh><coneGeometry args={[20.3, 30.4, 4]} /><meshBasicMaterial color="#FFD700" wireframe /></mesh>
      <mesh position={[0, 45, 0]}><cylinderGeometry args={[0.6, 0.18, 80, 7]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.15} /></mesh>
      <mesh position={[0, 2, 18]}><boxGeometry args={[7, 4, 14]} /><meshLambertMaterial color="#c8a870" /></mesh>
      <NeonBar position={[0, 32, 0]} color="#FFD700" width={10} />
    </group>
  );
}

/* Excalibur — white castle with blue/red towers */
function Excalibur({ position }) {
  const towers = [[-8,-6],[8,-6],[-8,6],[8,6]];
  return (
    <group position={position}>
      <mesh position={[0, 10, 0]}><boxGeometry args={[22, 20, 18]} /><meshLambertMaterial color="#e8e4d4" /></mesh>
      {towers.map(([x,z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 16, 0]}><cylinderGeometry args={[3, 3.5, 28, 8]} /><meshLambertMaterial color={i%2===0?"#1a3a8c":"#cc1a1a"} /></mesh>
          <mesh position={[0, 30, 0]}><coneGeometry args={[3.5, 8, 4]} /><meshLambertMaterial color={i%2===0?"#cc1a1a":"#1a3a8c"} /></mesh>
        </group>
      ))}
      <NeonBar position={[0, 22, 0]} color="#FFD700" width={14} />
    </group>
  );
}

/* MGM Grand */
function MGMGrand({ position }) {
  const tex = useMemo(() => makeWinTex(6, 9, "#0e2a0e", "#FFD700"), []);
  return (
    <group position={position}>
      <mesh position={[0, 22, 0]}><boxGeometry args={[22, 44, 14]} /><meshLambertMaterial color="#0e2a0e" emissive="#051505" emissiveIntensity={0.3} /></mesh>
      <mesh position={[0, 22, 7.1]}><planeGeometry args={[20, 40]} /><meshBasicMaterial map={tex} transparent /></mesh>
      <mesh position={[0, 5, 9]}><sphereGeometry args={[4.5, 10, 7]} /><meshLambertMaterial color="#c8a830" emissive="#5a3a00" emissiveIntensity={0.3} /></mesh>
      <NeonBar position={[0, 46, 0]} color="#00cc44" width={12} />
    </group>
  );
}

/* New York New York */
function NYNYHotel({ position }) {
  const bldgs = [{w:4,h:30,z:0,c:"#c8c0b8"},{w:5,h:22,z:5,c:"#b8b0a8"},{w:3,h:35,z:-5,c:"#d0c8c0"},{w:4,h:18,z:9,c:"#bab2aa"},{w:6,h:26,z:-10,c:"#b0a8a0"}];
  return (
    <group position={position}>
      {bldgs.map((b,i) => (
        <group key={i}>
          <mesh position={[i*3.5-7, b.h/2, b.z]}><boxGeometry args={[b.w, b.h, 6]} /><meshLambertMaterial color={b.c} /></mesh>
          <mesh position={[i*3.5-7, b.h+2, b.z]}><coneGeometry args={[b.w*0.28, 4, 4]} /><meshLambertMaterial color="#88807a" /></mesh>
        </group>
      ))}
      <mesh position={[10, 12, 0]}><cylinderGeometry args={[0.35, 0.55, 10, 7]} /><meshLambertMaterial color="#5a8a5a" /></mesh>
      <mesh position={[10, 17.5, 0]}><sphereGeometry args={[1.2, 8, 7]} /><meshLambertMaterial color="#5a8a5a" /></mesh>
      {/* Mini roller coaster loop (iconic NY NY feature) */}
      <mesh position={[-5, 20, 0]} rotation={[0, 0, 0]}><torusGeometry args={[7, 0.3, 6, 18]} /><meshBasicMaterial color="#ff6600" /></mesh>
      <NeonBar position={[0, 38, 0]} color="#cc0000" width={12} />
    </group>
  );
}

/* ══════════════════════════════════════════════════════════════
   CENTER STRIP  (z ≈ 80 … 200)
══════════════════════════════════════════════════════════════ */

/* Bellagio fountains */
function BellagioFountains({ position, active }) {
  const jets = useRef([]);
  const t = useRef(0);
  const jetPos = useMemo(() => Array.from({length:20},(_,i)=>[Math.cos(i/20*Math.PI*2)*13, Math.sin(i/20*Math.PI*2)*9]),[]);
  useFrame((_,dt) => {
    t.current += dt;
    jets.current.forEach((j,i) => {
      if (!j) return;
      const h = Math.max(0.2, (active?7:3) + Math.sin(t.current*2.2 + i/20*Math.PI*2) * (active?6:1.5));
      j.scale.y = h/8; j.position.y = h/2;
    });
  });
  return (
    <group position={position}>
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.06,0]} scale={[1.45,1,1]}><circleGeometry args={[11,32]} /><meshBasicMaterial color="#001a33" /></mesh>
      {jetPos.map(([x,z],i) => (
        <mesh key={i} ref={el=>(jets.current[i]=el)} position={[x,0,z]}>
          <cylinderGeometry args={[0.18,0.32,8,5]} />
          <meshBasicMaterial color="#88ccff" transparent opacity={0.65} />
        </mesh>
      ))}
      <mesh position={[0, 20, -15]}><boxGeometry args={[35, 40, 10]} /><meshLambertMaterial color="#c8b89a" /></mesh>
      <NeonBar position={[0, 42, -15]} color="#4488ff" width={18} />
    </group>
  );
}

/* Caesars Palace */
function CaesarsPalace({ position }) {
  return (
    <group position={position}>
      <mesh position={[0, 17, 0]}><boxGeometry args={[30, 34, 16]} /><meshLambertMaterial color="#f0ece0" /></mesh>
      {[-12,-8,-4,0,4,8,12].map((x,i) => (
        <mesh key={i} position={[x, 8, 9.2]}><cylinderGeometry args={[0.55, 0.65, 16, 8]} /><meshLambertMaterial color="#e8e0d0" /></mesh>
      ))}
      <mesh position={[0, 35, 0]}><sphereGeometry args={[6, 14, 7, 0, Math.PI*2, 0, Math.PI/2]} /><meshLambertMaterial color="#d4c9b0" /></mesh>
      <NeonBar position={[0, 37, 0]} color="#FFD700" width={16} />
    </group>
  );
}

/* Paris Eiffel Tower */
function ParisEiffelTower({ position }) {
  return (
    <group position={position}>
      {[[-5,-5],[5,-5],[-5,5],[5,5]].map(([x,z],i) => (
        <mesh key={i} position={[x*0.5,9,z*0.5]} rotation={[z>0?-0.2:0.2, 0, x>0?-0.2:0.2]}>
          <cylinderGeometry args={[0.45,1,18,6]} /><meshLambertMaterial color="#6b5a3a" emissive="#2a1a00" emissiveIntensity={0.2} />
        </mesh>
      ))}
      <mesh position={[0, 18, 0]}><boxGeometry args={[8, 1, 8]} /><meshLambertMaterial color="#6b5a3a" /></mesh>
      <mesh position={[0, 26, 0]}><cylinderGeometry args={[1.8, 4, 14, 10]} /><meshLambertMaterial color="#6b5a3a" emissive="#2a1a00" emissiveIntensity={0.2} /></mesh>
      <mesh position={[0, 33, 0]}><boxGeometry args={[4, 0.8, 4]} /><meshLambertMaterial color="#6b5a3a" /></mesh>
      <mesh position={[0, 42, 0]}><cylinderGeometry args={[0.1, 1.4, 18, 8]} /><meshLambertMaterial color="#6b5a3a" /></mesh>
      <mesh position={[0, 51, 0]}><sphereGeometry args={[0.45, 8, 8]} /><meshBasicMaterial color="#FFD700" /></mesh>
      <NeonBar position={[-10, 3, 0]} color="#ff69b4" width={9} />
    </group>
  );
}

/* Cosmopolitan — sleek modern tower */
function Cosmopolitan({ position }) {
  const tex = useMemo(() => makeWinTex(8, 14, "#0a0a14", "#88aaff"), []);
  return (
    <group position={position}>
      <mesh position={[0, 25, 0]}><boxGeometry args={[18, 50, 12]} /><meshLambertMaterial color="#0e1020" emissive="#080818" emissiveIntensity={0.3} /></mesh>
      <mesh position={[0, 25, 6.1]}><planeGeometry args={[16, 46]} /><meshBasicMaterial map={tex} transparent /></mesh>
      {/* Infinity pool ledge glow */}
      <mesh position={[0, 50.5, 0]}><boxGeometry args={[18.5, 0.4, 12.5]} /><meshBasicMaterial color="#88aaff" /></mesh>
      <NeonBar position={[0, 52, 0]} color="#cc44ff" width={12} />
    </group>
  );
}

/* Aria — curved modern glass */
function Aria({ position }) {
  const tex = useMemo(() => makeWinTex(10, 14, "#081418", "#00ccff"), []);
  return (
    <group position={position}>
      {/* Two curved wings */}
      <mesh position={[-6, 28, 0]} rotation={[0, 0.15, 0]}><boxGeometry args={[10, 56, 10]} /><meshLambertMaterial color="#0a1820" emissive="#041020" emissiveIntensity={0.3} /></mesh>
      <mesh position={[6, 28, 0]} rotation={[0, -0.15, 0]}><boxGeometry args={[10, 56, 10]} /><meshLambertMaterial color="#0a1820" emissive="#041020" emissiveIntensity={0.3} /></mesh>
      <mesh position={[-6, 28, 5.2]} rotation={[0, 0.15, 0]}><planeGeometry args={[9, 52]} /><meshBasicMaterial map={tex} transparent /></mesh>
      <mesh position={[6, 28, 5.2]} rotation={[0, -0.15, 0]}><planeGeometry args={[9, 52]} /><meshBasicMaterial map={tex} transparent /></mesh>
      <NeonBar position={[0, 58, 0]} color="#00ccff" width={14} />
    </group>
  );
}

/* ══════════════════════════════════════════════════════════════
   NORTH STRIP  (z ≈ 200 … 330)
══════════════════════════════════════════════════════════════ */

/* Flamingo — pink neon classic */
function Flamingo({ position }) {
  const neonRef = useRef(); const t = useRef(0);
  useFrame((_,dt) => { t.current+=dt; if(neonRef.current) neonRef.current.material.opacity = 0.6+Math.abs(Math.sin(t.current*4))*0.4; });
  return (
    <group position={position}>
      <mesh position={[0, 18, 0]}><boxGeometry args={[20, 36, 12]} /><meshLambertMaterial color="#ff9aaa" /></mesh>
      <mesh ref={neonRef} position={[0, 37, 0]}><boxGeometry args={[18, 3, 0.2]} /><meshBasicMaterial color="#ff1493" transparent opacity={0.9} /></mesh>
      <NeonBar position={[0, 37, 0]} color="#ff1493" width={16} height={2.5} />
      {/* Flamingo birds decoration */}
      {[-4, 0, 4].map((x, i) => (
        <group key={i} position={[x, 1, 8]}>
          <mesh position={[0, 3, 0]}><cylinderGeometry args={[0.1, 0.1, 4, 6]} /><meshBasicMaterial color="#ff69b4" /></mesh>
          <mesh position={[0, 5.2, 0]}><sphereGeometry args={[0.5, 6, 6]} /><meshBasicMaterial color="#ff69b4" /></mesh>
        </group>
      ))}
    </group>
  );
}

/* High Roller ferris wheel */
function HighRoller({ position }) {
  const wheelRef = useRef();
  useFrame(s => { if (wheelRef.current) wheelRef.current.rotation.z = s.clock.elapsedTime * 0.12; });
  const R = 14;
  return (
    <group position={position}>
      {[-6, 6].map((x, i) => (
        <mesh key={i} position={[x, 9, 0]} rotation={[0, 0, x>0?-0.2:0.2]}>
          <cylinderGeometry args={[0.4, 0.5, 18, 7]} /><meshBasicMaterial color="#333" />
        </mesh>
      ))}
      <group ref={wheelRef} position={[0, 18, 0]}>
        <mesh><torusGeometry args={[R, 0.35, 8, 40]} /><meshLambertMaterial color="#1a1a28" emissive="#220044" emissiveIntensity={0.5} /></mesh>
        {Array.from({length:10},(_,i) => (
          <mesh key={i} rotation={[0,0,(i/10)*Math.PI*2]}><boxGeometry args={[0.12, R*2, 0.12]} /><meshBasicMaterial color="#333" /></mesh>
        ))}
        {Array.from({length:28},(_,i) => {
          const a=(i/28)*Math.PI*2;
          return <mesh key={i} position={[Math.cos(a)*R, Math.sin(a)*R, 0]}><sphereGeometry args={[0.28,5,5]} /><meshBasicMaterial color={`hsl(${i*13},100%,68%)`} /></mesh>;
        })}
        {Array.from({length:14},(_,i) => {
          const a=(i/14)*Math.PI*2;
          return <mesh key={i} position={[Math.cos(a)*R, Math.sin(a)*R, 0]}><boxGeometry args={[2.0, 1.4, 1.0]} /><meshLambertMaterial color={`hsl(${i*26},60%,50%)`} /></mesh>;
        })}
      </group>
    </group>
  );
}

/* Venetian — Italian palazzo */
function Venetian({ position }) {
  const tex = useMemo(() => makeWinTex(10, 8, "#c8b890", "#ffe090"), []);
  return (
    <group position={position}>
      {/* Main body */}
      <mesh position={[0, 20, 0]}><boxGeometry args={[32, 40, 14]} /><meshLambertMaterial color="#d4c890" /></mesh>
      <mesh position={[0, 20, 7.1]}><planeGeometry args={[30, 36]} /><meshBasicMaterial map={tex} transparent /></mesh>
      {/* Arched colonnade base */}
      {[-12,-6,0,6,12].map((x,i) => (
        <group key={i} position={[x, 0, 8]}>
          <mesh position={[0, 5, 0]}><cylinderGeometry args={[0.6, 0.7, 10, 10]} /><meshLambertMaterial color="#e8dcc0" /></mesh>
          <mesh position={[0, 10.5, 0]}><torusGeometry args={[3, 0.3, 6, 14, Math.PI]} /><meshLambertMaterial color="#e8dcc0" /></mesh>
        </group>
      ))}
      {/* Canal water strip in front */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[0, 0.05, 14]}>
        <planeGeometry args={[28, 5]} />
        <meshBasicMaterial color="#1a3a5c" transparent opacity={0.85} />
      </mesh>
      {/* Gondola */}
      <mesh position={[-5, 0.5, 14]}><boxGeometry args={[4, 0.6, 1.2]} /><meshLambertMaterial color="#1a0a00" /></mesh>
      <NeonBar position={[0, 42, 0]} color="#FFD700" width={18} />
    </group>
  );
}

/* Mirage — with volcano */
function Mirage({ position, active }) {
  const lavaRef = useRef(); const smokeRef = useRef();
  const t = useRef(0);
  useFrame((_,dt) => {
    t.current += dt;
    if (lavaRef.current) lavaRef.current.material.opacity = (active?0.5:0.25) + Math.sin(t.current*2)*0.15;
    if (smokeRef.current) smokeRef.current.scale.y = 1 + Math.sin(t.current*1.5)*0.3;
  });
  const tex = useMemo(() => makeWinTex(8,12,"#1a1a0a","#FFD700"),[]);
  return (
    <group position={position}>
      {/* Hotel tower */}
      <mesh position={[0, 22, 0]}><cylinderGeometry args={[10,11,44,16]} /><meshLambertMaterial color="#c8b870" emissive="#3a2800" emissiveIntensity={0.2} /></mesh>
      <mesh position={[0, 22, 10.2]}><planeGeometry args={[19,40]} /><meshBasicMaterial map={tex} transparent /></mesh>
      {/* Volcano cone */}
      <mesh position={[0, 0, 16]}>
        <coneGeometry args={[12, 14, 14]} />
        <meshLambertMaterial color="#3a2010" />
      </mesh>
      {/* Lava glow at crater */}
      <mesh ref={lavaRef} position={[0, 12.5, 16]}>
        <circleGeometry args={[4, 16]} />
        <meshBasicMaterial color="#ff4400" transparent opacity={0.35} side={THREE.DoubleSide} />
      </mesh>
      {/* Smoke/fire plume */}
      <mesh ref={smokeRef} position={[0, 16, 16]}>
        <coneGeometry args={[3, 14, 8]} />
        <meshBasicMaterial color="#ff6600" transparent opacity={0.2} />
      </mesh>
      {active && <pointLight position={[0, 10, 16]} color="#ff4400" intensity={8} distance={40} />}
      <NeonBar position={[0, 46, 0]} color="#FFD700" width={13} />
    </group>
  );
}

/* Treasure Island */
function TreasureIsland({ position }) {
  return (
    <group position={position}>
      <mesh position={[0, 18, 0]}><boxGeometry args={[22, 36, 12]} /><meshLambertMaterial color="#c8a040" emissive="#3a2800" emissiveIntensity={0.2} /></mesh>
      {/* Skull/pirate decorations */}
      {[-7,0,7].map((x,i) => (
        <group key={i} position={[x, 37, 7]}>
          <mesh position={[0, 1, 0]}><sphereGeometry args={[1.2, 8, 8]} /><meshLambertMaterial color="#e8e0d0" /></mesh>
          <mesh position={[0, 3, 0]}><cylinderGeometry args={[0.12, 0.12, 4, 5]} /><meshBasicMaterial color="#8B4513" /></mesh>
          <mesh position={[0.5, 4, 0]} rotation={[0,0,0.5]}><boxGeometry args={[1.2, 0.5, 0.3]} /><meshBasicMaterial color="#cc0000" /></mesh>
        </group>
      ))}
      {/* Pirate ship in front */}
      <mesh position={[0, 1, 12]}><boxGeometry args={[10, 3, 5]} /><meshLambertMaterial color="#4a2800" /></mesh>
      <mesh position={[0, 5, 12]}><cylinderGeometry args={[0.25, 0.25, 10, 6]} /><meshLambertMaterial color="#3a1800" /></mesh>
      <mesh position={[-2, 9, 12]} rotation={[0, 0, 0.15]}><planeGeometry args={[4, 5]} /><meshBasicMaterial color="#cc1a1a" side={THREE.DoubleSide} /></mesh>
      <NeonBar position={[0, 38, 0]} color="#FFD700" width={14} />
    </group>
  );
}

/* Wynn — gold curved tower */
function WynnHotel({ position }) {
  const tex = useMemo(() => makeWinTex(12, 12, "#7a6035", "#FFD700"), []);
  return (
    <group position={position}>
      <mesh position={[0, 22, 0]}><cylinderGeometry args={[9, 10, 44, 18]} /><meshLambertMaterial color="#7a6035" emissive="#3a2808" emissiveIntensity={0.25} /></mesh>
      <mesh position={[0, 22, 9.2]}><planeGeometry args={[17, 40]} /><meshBasicMaterial map={tex} transparent /></mesh>
      <NeonBar position={[0, 46, 0]} color="#FFD700" width={13} />
    </group>
  );
}

/* ══════════════════════════════════════════════════════════════
   FREMONT STREET  (z ≈ 330 … 450)
══════════════════════════════════════════════════════════════ */

/* Stratosphere Tower */
function StratosphereRocket({ position }) {
  return (
    <group position={position}>
      {/* Main shaft */}
      <mesh position={[0, 60, 0]}><cylinderGeometry args={[2, 4, 120, 12]} /><meshLambertMaterial color="#888" /></mesh>
      {/* Observation pod */}
      <mesh position={[0, 122, 0]}><cylinderGeometry args={[8, 5, 14, 16]} /><meshLambertMaterial color="#cccccc" emissive="#aaaaaa" emissiveIntensity={0.1} /></mesh>
      {/* Top spire */}
      <mesh position={[0, 135, 0]}><cylinderGeometry args={[0.3, 2, 18, 8]} /><meshLambertMaterial color="#888" /></mesh>
      {/* Beacon */}
      <mesh position={[0, 144, 0]}><sphereGeometry args={[0.8, 6, 6]} /><meshBasicMaterial color="#ff0000" /></mesh>
      {/* Base */}
      <mesh position={[0, 5, 0]}><cylinderGeometry args={[12, 14, 10, 16]} /><meshLambertMaterial color="#888" /></mesh>
      <NeonBar position={[0, 120, 0]} color="#ff0000" width={18} height={0.8} />
    </group>
  );
}

/* Fremont Experience canopy */
function FremontCanopy({ position }) {
  const canopyRef = useRef(); const t = useRef(0);
  useFrame((_,dt) => {
    t.current += dt;
    if (canopyRef.current) {
      const h = ((t.current*0.08)%1);
      canopyRef.current.material.color.setHSL(h, 1, 0.45);
    }
  });
  return (
    <group position={position}>
      {/* Arched canopy structure */}
      <mesh ref={canopyRef} rotation={[-Math.PI/2,0,0]} position={[0, 18, 0]}>
        <planeGeometry args={[50, 80]} />
        <meshBasicMaterial color="#ff0000" side={THREE.DoubleSide} transparent opacity={0.5} />
      </mesh>
      {/* Support columns */}
      {[-20,-10,0,10,20].map((x,i) => (
        <group key={i}>
          <mesh position={[x, 9, -30]}><cylinderGeometry args={[0.5,0.7,18,8]} /><meshBasicMaterial color="#555" /></mesh>
          <mesh position={[x, 9, 30]}><cylinderGeometry args={[0.5,0.7,18,8]} /><meshBasicMaterial color="#555" /></mesh>
        </group>
      ))}
      {/* Old casino facades */}
      <mesh position={[-18, 8, -30]}><boxGeometry args={[12, 16, 6]} /><meshLambertMaterial color="#c8a840" /></mesh>
      <mesh position={[18, 8, -30]}><boxGeometry args={[12, 16, 6]} /><meshLambertMaterial color="#4a8acc" /></mesh>
      <mesh position={[-18, 8, 30]}><boxGeometry args={[12, 16, 6]} /><meshLambertMaterial color="#cc4a4a" /></mesh>
      <mesh position={[18, 8, 30]}><boxGeometry args={[12, 16, 6]} /><meshLambertMaterial color="#4acc4a" /></mesh>
      <NeonBar position={[-18, 17, -30]} color="#FFD700" width={10} />
      <NeonBar position={[18, 17, -30]} color="#ff4400" width={10} />
    </group>
  );
}

/* ── Shared: searchlight (no spotlight) ─────────────────────────────────────── */
function Searchlight({ position, phase }) {
  const pivotRef = useRef(); const t = useRef(phase);
  useFrame((_,dt) => {
    t.current += dt * 0.55;
    if (pivotRef.current) { pivotRef.current.rotation.y = Math.sin(t.current)*1.1; pivotRef.current.rotation.z = 0.25+Math.cos(t.current*0.8)*0.15; }
  });
  return (
    <group position={position}>
      <mesh position={[0,0.8,0]}><cylinderGeometry args={[0.9,1.1,1.6,8]} /><meshBasicMaterial color="#333" /></mesh>
      <group ref={pivotRef} position={[0,1.6,0]}>
        <mesh position={[0,28,0]}><cylinderGeometry args={[2,0.3,56,6]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.09} /></mesh>
      </group>
    </group>
  );
}

/* ── Neon billboard ─────────────────────────────────────────────────────────── */
function NeonBillboard({ position, rotation, color, width=12, height=6 }) {
  const faceRef = useRef(); const t = useRef(Math.random()*Math.PI*2);
  useFrame((_,dt) => { t.current+=dt*1.8; if(faceRef.current) faceRef.current.material.opacity=0.55+Math.abs(Math.sin(t.current))*0.45; });
  return (
    <group position={position} rotation={rotation}>
      <mesh><boxGeometry args={[width+0.5,height+0.5,0.22]} /><meshBasicMaterial color="#1a1a1a" /></mesh>
      <mesh ref={faceRef} position={[0,0,0.18]}><planeGeometry args={[width,height]} /><meshBasicMaterial color={color} transparent opacity={0.8} /></mesh>
    </group>
  );
}

/* ── Billboard tower ────────────────────────────────────────────────────────── */
function BillboardTower({ position, color }) {
  const ref = useRef(); const t = useRef(Math.random()*Math.PI*2);
  useFrame((_,dt) => { t.current+=dt; if(ref.current) ref.current.material.color.setHSL(((t.current*25)%360)/360,1,0.5); });
  return (
    <group position={position}>
      <mesh position={[0,13,0]}><boxGeometry args={[1.2,26,1.2]} /><meshBasicMaterial color="#222" /></mesh>
      <mesh position={[3.2,13,0]}><boxGeometry args={[1.2,26,1.2]} /><meshBasicMaterial color="#222" /></mesh>
      <mesh ref={ref} position={[1.6,22,0.8]}><boxGeometry args={[9,6,0.22]} /><meshBasicMaterial color={color} /></mesh>
    </group>
  );
}

/* ── Palm tree ──────────────────────────────────────────────────────────────── */
function PalmTree({ position }) {
  return (
    <group position={position}>
      <mesh position={[0,5.5,0]} rotation={[0,0,0.07]}><cylinderGeometry args={[0.22,0.38,11,6]} /><meshBasicMaterial color="#8B6914" /></mesh>
      {Array.from({length:6},(_,i) => { const a=(i/6)*Math.PI*2; return <mesh key={i} position={[Math.cos(a)*1.6,11.2,Math.sin(a)*1.6]} rotation={[0.45,a,0]}><boxGeometry args={[0.18,0.09,4.5]} /><meshBasicMaterial color="#1a5c1a" /></mesh>; })}
    </group>
  );
}

/* ── Slot machine ───────────────────────────────────────────────────────────── */
function SlotMachine({ position, active }) {
  const ref = useRef(); const t = useRef(Math.random()*Math.PI*2);
  useFrame((_,dt) => { t.current+=dt*(active?6:0.4); if(ref.current) ref.current.rotation.x=t.current; });
  return (
    <group position={position} scale={[0.75,0.75,0.75]}>
      <mesh><boxGeometry args={[1.6,2.6,1]} /><meshLambertMaterial color="#cc2200" /></mesh>
      <mesh position={[0,0.35,0.55]}><boxGeometry args={[1.15,0.85,0.1]} /><meshBasicMaterial color={active?"#FFD700":"#001133"} /></mesh>
      <group ref={ref} position={[0,0.35,0.62]}>
        {[0,1,2,3].map(j => <mesh key={j} position={[0,(j-1.5)*0.2,0]}><planeGeometry args={[0.85,0.18]} /><meshBasicMaterial color={active?"#FFD700":"#555"} /></mesh>)}
      </group>
    </group>
  );
}

/* ── Crowd ──────────────────────────────────────────────────────────────────── */
function StripCrowd({ active }) {
  const COUNT = 300;
  const ref = useRef();
  const data = useRef(Array.from({length:COUNT},() => ({
    x:(Math.random()>0.5?1:-1)*(11+Math.random()*4),
    z:(Math.random()-0.5)*450+230,
    phase:Math.random()*Math.PI*2,
  })));
  useEffect(() => {
    if (!ref.current) return;
    const dummy = new THREE.Object3D();
    data.current.forEach((d,i) => { dummy.position.set(d.x,0.5,d.z); dummy.scale.set(0.28,0.48,0.28); dummy.updateMatrix(); ref.current.setMatrixAt(i,dummy.matrix); });
    ref.current.instanceMatrix.needsUpdate = true;
  }, []);
  useFrame(({clock}) => {
    if (!ref.current || !active) return;
    const dummy = new THREE.Object3D(); const t = clock.elapsedTime;
    data.current.forEach((d,i) => {
      const b = Math.abs(Math.sin(t*2.5+d.phase))*0.25;
      dummy.position.set(d.x,0.5+b,d.z); dummy.scale.set(0.28,0.48+b*0.25,0.28); dummy.updateMatrix(); ref.current.setMatrixAt(i,dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[null,null,COUNT]}><capsuleGeometry args={[0.25,0.55,3,6]} /><meshBasicMaterial color="#8899aa" /></instancedMesh>;
}

/* ── Casino chips ───────────────────────────────────────────────────────────── */
function CasinoChips({ active }) {
  const COUNT = 200; const ref = useRef(); const parked = useRef(false);
  const colors = ["#FF0000","#0055FF","#008000","#111","#FF69B4","#FFD700","#FF6600","#8800FF"];
  const data = useRef(Array.from({length:COUNT},()=>({x:(Math.random()-0.5)*90,y:Math.random()*55+5,z:Math.random()*450,speed:Math.random()*2.5+1.2,rot:Math.random()*Math.PI*2})));
  useEffect(() => {
    if (!ref.current) return;
    const col = new THREE.Color();
    data.current.forEach((_,i) => { col.set(colors[i%colors.length]); ref.current.setColorAt(i,col); });
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate=true;
  },[]);
  useFrame((_,dt) => {
    if (!ref.current) return;
    if (!active) {
      if (parked.current) return; parked.current=true;
      const dummy=new THREE.Object3D(); dummy.position.set(0,-500,0); dummy.scale.setScalar(0); dummy.updateMatrix();
      for (let i=0;i<COUNT;i++) ref.current.setMatrixAt(i,dummy.matrix); ref.current.instanceMatrix.needsUpdate=true; return;
    }
    parked.current=false;
    const dummy=new THREE.Object3D();
    data.current.forEach((d,i) => {
      d.y-=d.speed*dt*9; d.rot+=dt*4; if(d.y<-2){d.y=55+Math.random()*12;}
      dummy.position.set(d.x,d.y,d.z); dummy.rotation.set(d.rot,d.rot*0.5,0); dummy.scale.set(0.55,0.12,0.55); dummy.updateMatrix(); ref.current.setMatrixAt(i,dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate=true;
  });
  return <instancedMesh ref={ref} args={[null,null,COUNT]}><cylinderGeometry args={[0.4,0.4,0.1,10]} /><meshBasicMaterial vertexColors /></instancedMesh>;
}

/* ── Agent figures ──────────────────────────────────────────────────────────── */
function AgentFigure({ position, isActive, isMine, agent, onClick }) {
  const ref = useRef(); const armLRef = useRef(); const armRRef = useRef();
  const ringRef = useRef(); const t = useRef(Math.random()*Math.PI*2);
  useFrame((_,dt) => {
    t.current += dt;
    if (ref.current) ref.current.position.y = position[1] + Math.sin(t.current*1.4)*0.06;
    const swing = isActive ? Math.sin(t.current*5)*0.55 : Math.sin(t.current*1.1)*0.08;
    if (armLRef.current) armLRef.current.rotation.x = -swing;
    if (armRRef.current) armRRef.current.rotation.x =  swing;
    if (ringRef.current) { ringRef.current.rotation.z = t.current * 1.2; ringRef.current.material.opacity = 0.5 + Math.sin(t.current*2)*0.3; }
  });
  const suit = isActive ? "#FFD700" : isMine ? "#7c3aed" : "#18223a";
  return (
    <group ref={ref} position={position} onClick={onClick} onPointerEnter={e=>{e.stopPropagation();document.body.style.cursor="pointer"}} onPointerLeave={()=>{document.body.style.cursor="auto"}}>
      {/* Platform glow for mine */}
      {isMine && <mesh ref={ringRef} rotation={[-Math.PI/2,0,0]} position={[0,-0.0,0]}><ringGeometry args={[0.7,1.1,24]} /><meshBasicMaterial color="#7c3aed" transparent opacity={0.6} /></mesh>}
      <mesh position={[0,1.25,0]}><boxGeometry args={[0.58,1.0,0.34]} /><meshBasicMaterial color={suit} /></mesh>
      <mesh position={[0,2.05,0]}><sphereGeometry args={[0.27,8,6]} /><meshBasicMaterial color="#f5c5a3" /></mesh>
      <group ref={armLRef} position={[-0.4,1.25,0]}><mesh position={[0,-0.22,0]}><boxGeometry args={[0.21,0.6,0.22]} /><meshBasicMaterial color={suit} /></mesh></group>
      <group ref={armRRef} position={[ 0.4,1.25,0]}><mesh position={[0,-0.22,0]}><boxGeometry args={[0.21,0.6,0.22]} /><meshBasicMaterial color={suit} /></mesh></group>
      <mesh position={[-0.16,0.42,0]}><boxGeometry args={[0.21,0.82,0.27]} /><meshBasicMaterial color="#101030" /></mesh>
      <mesh position={[0.16,0.42,0]}><boxGeometry args={[0.21,0.82,0.27]} /><meshBasicMaterial color="#101030" /></mesh>
      {isActive && <mesh position={[0,2.65,0]} rotation={[0,Math.PI/4,Math.PI/4]}><octahedronGeometry args={[0.2]} /><meshBasicMaterial color="#FFD700" /></mesh>}
      {isMine && <mesh position={[0,2.8,0]}><octahedronGeometry args={[0.15,0]} /><meshBasicMaterial color="#7c3aed" /></mesh>}
    </group>
  );
}

/* ── Full scene ─────────────────────────────────────────────────────────────── */
function VegasScene({ agents, targetZ, controlsRef, myAgents, selected, onSelect }) {
  const isActive = agents.some(a => a.last_run_ms && Date.now()-a.last_run_ms<12000);

  return (
    <>
      <color attach="background" args={["#060611"]} />
      <fog attach="fog" args={["#060611", 100, 220]} />
      <Stars radius={160} depth={50} count={1800} factor={4} saturation={0} fade speed={0.3} />

      <ambientLight intensity={0.3} color="#18104a" />
      <pointLight position={[0,20,targetZ-30]}  color="#FF4400" intensity={5} distance={140} />
      <pointLight position={[-22,12,targetZ+30]} color="#FFD700" intensity={3} distance={110} />
      <pointLight position={[26,12,targetZ+10]}  color="#00aaFF" intensity={3} distance={110} />
      <pointLight position={[0,6,targetZ+80]}    color="#FF0066" intensity={2} distance={90} />

      <CameraRig targetZ={targetZ} controlsRef={controlsRef} />

      <TheStrip />

      {/* ── SOUTH STRIP (z: -60 → +60) ── */}
      <WelcomeSign    position={[0,   0, -60]} />
      <MandalayBay    position={[42,  0, -40]} />
      <Luxor          position={[50,  0,  -5]} />
      <Excalibur      position={[-40, 0,  10]} />
      <MGMGrand       position={[32,  0,  35]} />
      <NYNYHotel      position={[-30, 0,  50]} />

      {/* ── CENTER STRIP (z: 80 → 200) ── */}
      <Aria           position={[38,  0,  90]} />
      <Cosmopolitan   position={[-36, 0, 110]} />
      <BellagioFountains position={[30, 0, 130]} active={isActive} />
      <CaesarsPalace  position={[-42, 0, 150]} />
      <ParisEiffelTower position={[-36, 0, 175]} />

      {/* ── NORTH STRIP (z: 210 → 330) ── */}
      <Flamingo       position={[35,  0, 215]} />
      <HighRoller     position={[28,  0, 250]} />
      <Venetian       position={[-38, 0, 265]} />
      <TreasureIsland position={[-36, 0, 295]} />
      <Mirage         position={[-40, 0, 320]} active={isActive} />
      <WynnHotel      position={[42,  0, 315]} />

      {/* ── FREMONT (z: 360 → 460) ── */}
      <StratosphereRocket position={[0, 0, 370]} />
      <FremontCanopy  position={[0,  0, 430]} />

      {/* Billboards scattered along strip */}
      {[20, 80, 140, 200, 260, 320, 390].map((z,i) => (
        <group key={i}>
          <NeonBillboard position={[18,13,z]}  rotation={[0,0,0]}           color={["#FF0066","#FFD700","#00ccFF","#FF4400","#cc44ff","#FF0066","#FFD700"][i]} width={12} height={6} />
          <NeonBillboard position={[-18,11,z+15]} rotation={[0,Math.PI,0]} color={["#00ccFF","#FF4400","#FFD700","#cc44ff","#FF0066","#00ccFF","#FF4400"][i]} width={11} height={5} />
        </group>
      ))}
      {[0, 80, 170, 260, 350].map((z,i) => (
        <group key={i}>
          <BillboardTower position={[17,0,z+40]}  color={["#FF0066","#FFD700","#00ccFF","#cc44ff","#FF4400"][i]} />
          <BillboardTower position={[-17,0,z+65]} color={["#FFD700","#FF0066","#FF4400","#00ccFF","#cc44ff"][i]} />
        </group>
      ))}

      {/* Searchlights along full strip */}
      {[0, 60, 120, 180, 240, 300, 380].flatMap((z,i) => [
        <Searchlight key={`a${i}`} position={[-10,0,z]} phase={i*0.9} />,
        <Searchlight key={`b${i}`} position={[10,0,z+30]} phase={i*0.9+1.5} />,
      ])}

      {/* Palm trees lining sidewalks */}
      {Array.from({length:22},(_,i) => (
        <group key={i}>
          <PalmTree position={[11.5,0,-30+i*22]} />
          <PalmTree position={[-11.5,0,-20+i*22]} />
        </group>
      ))}

      {/* Slot machines */}
      {Array.from({length:8},(_,i) => (
        <group key={i}>
          <SlotMachine position={[13,0,10+i*40]} active={isActive} />
          <SlotMachine position={[-13,0,25+i*40]} active={isActive} />
        </group>
      ))}

      <StripCrowd active={isActive} />
      <CasinoChips active={isActive} />

      {agents.slice(0,20).map((agent,i) => (
        <AgentFigure key={agent.id} position={[(i%2===0?1:-1)*13.5, 0, 10+i*20]}
          isActive={!!(agent.last_run_ms && Date.now()-agent.last_run_ms<12000)}
          isMine={myAgents.has(agent.id)}
          agent={agent}
          onClick={() => onSelect(selected === agent.id ? null : agent.id)} />
      ))}

      <EffectComposer>
        <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} intensity={1.2} />
      </EffectComposer>
    </>
  );
}

/* ── Root ───────────────────────────────────────────────────────────────────── */
export default function LasVegasWorld() {
  const [agents,    setAgents]    = useState([]);
  const [seg,       setSeg]       = useState(0);
  const [toast,     setToast]     = useState(null);
  const [wsRetry,   setWsRetry]   = useState(0);
  const [selected,  setSelected]  = useState(null);
  const controlsRef = useRef();
  const agentsRef   = useRef([]);
  const myUsername  = useMyUsername();
  const myAgents    = useMemo(() => new Set(agents.filter(a => a.developer_name === myUsername).map(a => a.id)), [agents, myUsername]);

  const showToast = (msg, ms = 3500) => {
    setToast(msg);
    setTimeout(() => setToast(null), ms);
  };

  useEffect(() => {
    const load = () => fetch(`${API}/agents?category=trading`).then(r=>r.json()).then(d=>{
      const list = Array.isArray(d) ? d : [];
      agentsRef.current = list;
      setAgents(list);
    }).catch(()=>{});
    load(); const iv=setInterval(load,8000); return ()=>clearInterval(iv);
  }, []);

  useEffect(() => {
    const ws = new WebSocket(WS);
    ws.onmessage = (e) => {
      const ev = JSON.parse(e.data);
      if (ev.type === "agent_call_start" || ev.type === "pipeline_step_start") {
        const agent = agentsRef.current.find(a => a.id === ev.agent_id);
        if (agent) showToast(`🎰 ${agent.name} is running`);
      }
      if (ev.type === "agent_call_done" || ev.type === "pipeline_step_done") {
        const agent = agentsRef.current.find(a => a.id === ev.agent_id);
        if (agent) showToast(`💰 ${agent.name} paid out $${agent.price_per_request}`);
      }
      if (ev.type === "agent_registered") {
        fetch(`${API}/agents?category=trading`).then(r=>r.json()).then(d=>{
          const list = Array.isArray(d) ? d : [];
          agentsRef.current = list; setAgents(list);
        }).catch(()=>{});
        showToast(`🎲 New agent on the Strip: ${ev.agent_name}`, 5000);
      }
    };
    ws.onerror = () => {};
    ws.onclose = () => setTimeout(() => setWsRetry(n => n + 1), 3000);
    return () => { ws.onclose = null; ws.close(); };
  }, [wsRetry]);

  const activeCount = agents.filter(a=>a.last_run_ms&&Date.now()-a.last_run_ms<12000).length;
  const targetZ = SEGMENTS[seg].z;

  return (
    <div style={{width:"100%",height:"100%",position:"relative",background:"#060611"}}>
      <Canvas
        camera={{position:[0,38,95],fov:60}}
        gl={{antialias:true,toneMapping:THREE.ACESFilmicToneMapping,toneMappingExposure:0.85}}
      >
        <VegasScene agents={agents} targetZ={targetZ} controlsRef={controlsRef} myAgents={myAgents} selected={selected} onSelect={setSelected} />
        <OrbitControls ref={controlsRef} enablePan maxPolarAngle={Math.PI/2.15} minDistance={12} maxDistance={170} />
      </Canvas>

      {/* HUD top-left */}
      <div style={{position:"absolute",top:16,left:16,background:"rgba(6,6,17,0.88)",border:"1px solid #FFD70038",borderRadius:12,padding:"12px 18px",fontFamily:"inherit"}}>
        <div style={{color:"#FFD700",fontSize:10,fontWeight:700,letterSpacing:2.5,marginBottom:5}}>LAS VEGAS STRIP</div>
        <div style={{color:"#ffffff",fontSize:20,fontWeight:800}}>{agents.length} <span style={{color:"#9aabb8",fontSize:12,fontWeight:600}}>agents</span></div>
        {activeCount>0&&<div style={{marginTop:6,display:"flex",alignItems:"center",gap:6}}><div style={{width:7,height:7,borderRadius:"50%",background:"#FFD700"}} /><span style={{color:"#FFD700",fontSize:11,fontWeight:700}}>{activeCount} LIVE</span></div>}
      </div>

      {/* Section label top-center */}
      <div style={{position:"absolute",top:16,left:"50%",transform:"translateX(-50%)",textAlign:"center",pointerEvents:"none"}}>
        <div style={{color:"#FFD700",fontSize:15,fontWeight:800,letterSpacing:1,textShadow:"0 0 16px #FFD700"}}>{SEGMENTS[seg].label}</div>
        <div style={{color:"#9aabb8",fontSize:11,marginTop:3}}>{SEGMENTS[seg].sub}</div>
      </div>

      {/* Navigation arrows */}
      <div style={{position:"absolute",bottom:28,left:"50%",transform:"translateX(-50%)",display:"flex",alignItems:"center",gap:12}}>
        <button
          disabled={seg===0}
          onClick={()=>setSeg(s=>Math.max(0,s-1))}
          style={{background:seg===0?"rgba(20,20,40,0.4)":"rgba(20,20,40,0.9)",border:`1px solid ${seg===0?"#333":"#FFD70060"}`,color:seg===0?"#444":"#FFD700",borderRadius:10,padding:"10px 22px",fontSize:15,fontWeight:800,cursor:seg===0?"default":"pointer",transition:"all 0.2s",letterSpacing:1}}>
          ◀ South
        </button>

        {/* Progress dots */}
        <div style={{display:"flex",gap:7,alignItems:"center"}}>
          {SEGMENTS.map((s,i)=>(
            <div key={i} onClick={()=>setSeg(i)} style={{width:i===seg?10:7,height:i===seg?10:7,borderRadius:"50%",background:i===seg?"#FFD700":i<seg?"#8B6914":"#333",cursor:"pointer",transition:"all 0.2s",boxShadow:i===seg?"0 0 8px #FFD700":"none"}} />
          ))}
        </div>

        <button
          disabled={seg===SEGMENTS.length-1}
          onClick={()=>setSeg(s=>Math.min(SEGMENTS.length-1,s+1))}
          style={{background:seg===SEGMENTS.length-1?"rgba(20,20,40,0.4)":"rgba(20,20,40,0.9)",border:`1px solid ${seg===SEGMENTS.length-1?"#333":"#FFD70060"}`,color:seg===SEGMENTS.length-1?"#444":"#FFD700",borderRadius:10,padding:"10px 22px",fontSize:15,fontWeight:800,cursor:seg===SEGMENTS.length-1?"default":"pointer",transition:"all 0.2s",letterSpacing:1}}>
          North ▶
        </button>
      </div>

      {/* Card suits */}
      <div style={{position:"absolute",bottom:84,left:"50%",transform:"translateX(-50%)",display:"flex",gap:20,alignItems:"center"}}>
        {["♠","♥","♦","♣"].map((s,i)=>(
          <div key={i} style={{color:i%2===0?"#cc0000":"#FFD700",fontSize:22,textShadow:`0 0 10px ${i%2===0?"#cc0000":"#FFD700"}`,animation:`vegasPulse ${0.8+i*0.18}s ease-in-out infinite alternate`}}>{s}</div>
        ))}
      </div>
      {toast && (
        <div style={{position:"absolute",top:70,left:"50%",transform:"translateX(-50%)",
          background:"rgba(6,6,17,0.92)",border:"1px solid #FFD70060",borderRadius:10,
          padding:"10px 20px",color:"#FFD700",fontSize:13,fontWeight:700,
          fontFamily:"inherit",zIndex:200,whiteSpace:"nowrap",
          boxShadow:"0 0 20px #FFD70030",pointerEvents:"none"}}>
          {toast}
        </div>
      )}

      {/* Selected agent panel */}
      {selected && (() => { const a = agents.find(x => x.id === selected); if (!a) return null; return (
        <div style={{position:"absolute",top:16,right:16,width:240,background:"rgba(6,6,17,0.95)",border:"1px solid #FFD70050",borderRadius:14,padding:"16px 18px",fontFamily:"inherit",zIndex:300}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
            <div style={{color:"#FFD700",fontWeight:800,fontSize:14}}>{a.name}</div>
            <button onClick={()=>setSelected(null)} style={{background:"none",border:"none",color:"#9aabb8",cursor:"pointer",fontSize:16,lineHeight:1}}>×</button>
          </div>
          {myAgents.has(a.id) && <div style={{background:"#7c3aed20",border:"1px solid #7c3aed50",borderRadius:6,padding:"3px 8px",fontSize:10,color:"#a78bfa",fontWeight:700,marginBottom:8,display:"inline-block"}}>⚡ Your Agent</div>}
          <div style={{color:"#9aabb8",fontSize:11,marginBottom:10,lineHeight:1.5}}>{a.description||"No description."}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
            {[["Category",a.category],["Price",`${Math.round((a.price_per_request||0)*100)} cr`],["Status",a.status||"active"]].map(([k,v])=>(
              <div key={k} style={{background:"rgba(255,215,0,0.06)",borderRadius:7,padding:"6px 8px"}}>
                <div style={{color:"#9aabb8",fontSize:9,textTransform:"uppercase",letterSpacing:0.7}}>{k}</div>
                <div style={{color:"#FFD700",fontWeight:700,fontSize:12}}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      ); })()}

      {/* My Agents badge */}
      {myAgents.size > 0 && (
        <div style={{position:"absolute",bottom:130,right:16,background:"rgba(124,58,237,0.15)",border:"1px solid #7c3aed50",borderRadius:10,padding:"6px 12px",fontFamily:"inherit"}}>
          <div style={{color:"#a78bfa",fontSize:11,fontWeight:700}}>⚡ {myAgents.size} of your agents here</div>
        </div>
      )}
      <style>{`@keyframes vegasPulse{from{opacity:0.45}to{opacity:1}}`}</style>
    </div>
  );
}
