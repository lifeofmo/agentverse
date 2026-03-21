"use client";

import { useEffect, useRef, useState, useMemo, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text, Line, Billboard } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

import { API, WS, WS_BASE } from "@/app/lib/config";
import { useMyUsername } from "@/app/lib/useMyUsername";

// ── Wii-style palette ─────────────────────────────────────────────────────────
const SKY_COLOR    = "#A8D8F0";   // soft powder blue
const FLOOR_LIGHT  = "#F8F0E4";   // warm cream
const FLOOR_DARK   = "#EDE0CC";   // toasted almond
const FLOOR_BASE   = "#EDE0CC";
const PATH_COLOR   = "#C8B8A0";   // warm stone
const TREE_LEAF    = "#5CC83A";   // vibrant spring green
const TREE_TRUNK   = "#9B6B3A";
const BENCH_WOOD   = "#D4A870";
const BENCH_LEG    = "#7A8A96";
const LAMP_POLE    = "#B0B8C0";
const LAMP_GLOW    = "#FFF0A0";
const SHADOW_TINT  = "#E0EEFF";

// ── Murakami-inspired palette: vibrant + pastel, high saturation + soft hues ──
const CAT = {
  trading:   { primary: "#4DD9B8", dark: "#0e4a3c", emissive: "#2EC4A0", ground: "#c8f5ed", label: "Trading"   },
  analysis:  { primary: "#C8A0F8", dark: "#3a1660", emissive: "#B070F0", ground: "#f0e4ff", label: "Analysis"  },
  data:      { primary: "#38C8F4", dark: "#083858", emissive: "#10AADE", ground: "#cceeff", label: "Data"       },
  risk:      { primary: "#FF8096", dark: "#680020", emissive: "#F04060", ground: "#ffe0e6", label: "Risk"       },
  composite: { primary: "#FFD840", dark: "#5a3a00", emissive: "#F0B800", ground: "#fff4c0", label: "Composite"  },
  default:   { primary: "#90CCF0", dark: "#1a3a58", emissive: "#60B0E0", ground: "#d8eeff", label: "Agent"      },
};
const cat = (c) => CAT[c] ?? CAT.default;

// Walker colors by category (slightly more saturated than buildings)
const WALKER_COLORS = {
  trading:   "#4DD9B8",
  analysis:  "#C8A0F8",
  data:      "#38C8F4",
  risk:      "#FF8096",
  composite: "#FFD840",
  default:   "#A0CCF0",
};
const walkerColor = (c) => WALKER_COLORS[c] ?? WALKER_COLORS.default;

const BSIZE = 3.6; // plaza tile size

// Shop district — cardinal directions around the agent ring
const SHOP_POSITIONS = {
  trading:   { x: -24, z:   0 },  // West
  data:      { x:  24, z:   0 },  // East
  analysis:  { x:   0, z: -24 },  // North
  risk:      { x:   0, z:  24 },  // South
};

// HTML shop panel color scheme (light / friendly)
const SHOP_HTML = {
  trading:   { border: "#10b981", header: "#d1fae5", letter: "T" },
  data:      { border: "#38bdf8", header: "#e0f2fe", letter: "D" },
  analysis:  { border: "#a78bfa", header: "#ede9fe", letter: "A" },
  risk:      { border: "#f87171", header: "#fee2e2", letter: "R" },
  composite: { border: "#fbbf24", header: "#fef3c7", letter: "C" },
  default:   { border: "#94a3b8", header: "#f1f5f9", letter: "·" },
};
const shopHtml = (c) => SHOP_HTML[c] ?? SHOP_HTML.default;

function gridPositions(n) {
  if (n === 0) return [];
  const r = n <= 4 ? 9 : n <= 6 ? 10.5 : 13;
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    return { x: Math.cos(a) * r, z: Math.sin(a) * r };
  });
}

// ── District layout ────────────────────────────────────────────────────────────

// These mirror SHOP_POSITIONS — shops ARE the district gateways
const DISTRICT_CENTERS = {
  trading:  { x: -24, z:   0 },
  data:     { x:  24, z:   0 },
  analysis: { x:   0, z: -24 },
  risk:     { x:   0, z:  24 },
};

const CENTER_CAPACITY = 10; // max agents in central plaza ring

// ── Performance limits ────────────────────────────────────────────────────────
const MAX_WALKERS   = 60;
const MAX_DRONES    = 8;
const MAX_PARTICLES = 200;

// ── Sub-district sector definitions (Level 3 scaling: district > 20 agents) ──
const SUBDISTRICT_CENTERS = {
  trading:  [
    { x: -24, z: -10, label: "Momentum"   },
    { x: -36, z:   0, label: "Arbitrage"  },
    { x: -24, z:  10, label: "Prediction" },
  ],
  data: [
    { x:  24, z: -10, label: "Feeds"      },
    { x:  36, z:   0, label: "Pipeline"   },
    { x:  24, z:  10, label: "Storage"    },
  ],
  analysis: [
    { x: -10, z: -24, label: "Quant"      },
    { x:   0, z: -36, label: "ML"         },
    { x:  10, z: -24, label: "Signals"    },
  ],
  risk: [
    { x: -10, z:  24, label: "Monitor"    },
    { x:   0, z:  36, label: "Alerts"     },
    { x:  10, z:  24, label: "Hedge"      },
  ],
};

function layoutAgents(agents, metricsMap) {
  if (!agents.length) return { positions: [], districtOverflow: {} };

  // Top CENTER_CAPACITY most-active agents go in the central ring
  const sorted = [...agents].sort(
    (a, b) => (metricsMap[b.id]?.requests || 0) - (metricsMap[a.id]?.requests || 0)
  );
  const central  = sorted.slice(0, Math.min(CENTER_CAPACITY, agents.length));
  const overflow = sorted.slice(CENTER_CAPACITY);

  const posMap = {};
  gridPositions(central.length).forEach((p, i) => { posMap[central[i].id] = p; });

  // Pre-bucket overflow by category so we know totals before placing them
  const buckets = {};
  overflow.forEach(ag => {
    const c = DISTRICT_CENTERS[ag.category] ? ag.category : "trading";
    if (!buckets[c]) buckets[c] = [];
    buckets[c].push(ag);
  });

  const districtOverflow = {};
  const subDistrictMap   = {};
  Object.entries(buckets).forEach(([category, ags]) => {
    const dc = DISTRICT_CENTERS[category];
    const n  = ags.length;
    districtOverflow[category] = ags.map(a => a.id);

    if (n > 20 && SUBDISTRICT_CENTERS[category]) {
      // Level 3: distribute across 3 named sub-district sectors
      const subs = SUBDISTRICT_CENTERS[category];
      subDistrictMap[category] = subs;
      subs.forEach((sc, subIdx) => {
        const start  = Math.floor(subIdx * n / subs.length);
        const end    = Math.floor((subIdx + 1) * n / subs.length);
        const group  = ags.slice(start, end);
        const localN = group.length;
        if (!localN) return;
        const r = localN <= 3 ? 4 : localN <= 6 ? 5.5 : 7;
        group.forEach((ag, li) => {
          const angle = (li / localN) * Math.PI * 2 - Math.PI / 2;
          posMap[ag.id] = { x: sc.x + Math.cos(angle) * r, z: sc.z + Math.sin(angle) * r };
        });
      });
    } else {
      // Level 2: single ring around district center
      const r = n <= 3 ? 5 : n <= 6 ? 6.5 : 8;
      ags.forEach((ag, i) => {
        const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
        posMap[ag.id] = { x: dc.x + Math.cos(angle) * r, z: dc.z + Math.sin(angle) * r };
      });
    }
  });

  return {
    positions:     agents.map(ag => posMap[ag.id] || { x: 0, z: 0 }),
    districtOverflow,
    subDistrictMap,
  };
}

// ── Plaza Floor ───────────────────────────────────────────────────────────────

function PlazaFloor({ radius = 30, floorLight = FLOOR_LIGHT, floorDark = FLOOR_DARK }) {
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const refL  = useRef();
  const refD  = useRef();

  const [light, dark] = useMemo(() => {
    const l = [], d = [];
    const half = Math.ceil(radius / BSIZE);
    for (let xi = -half; xi <= half; xi++) {
      for (let zi = -half; zi <= half; zi++) {
        const x = xi * BSIZE, z = zi * BSIZE;
        if (x * x + z * z > radius * radius) continue;
        ((xi + zi) % 2 === 0 ? l : d).push({ x, z });
      }
    }
    return [l, d];
  }, [radius]);

  useEffect(() => {
    [[refL, light], [refD, dark]].forEach(([ref, tiles]) => {
      const m = ref.current;
      if (!m) return;
      tiles.forEach((t, i) => {
        dummy.position.set(t.x, 0.0, t.z);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
      });
      m.instanceMatrix.needsUpdate = true;
    });
  }, [light, dark, dummy]);

  const tileW = BSIZE - 0.14;

  return (
    <>
      {/* Soft base circle */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]}>
        <circleGeometry args={[radius + 2, 72]} />
        <meshLambertMaterial color={FLOOR_BASE} />
      </mesh>
      {/* Light tiles */}
      {light.length > 0 && (
        <instancedMesh ref={refL} args={[null, null, light.length]}>
          <boxGeometry args={[tileW, 0.06, tileW]} />
          <meshLambertMaterial color={floorLight} />
        </instancedMesh>
      )}
      {/* Dark tiles */}
      {dark.length > 0 && (
        <instancedMesh ref={refD} args={[null, null, dark.length]}>
          <boxGeometry args={[tileW, 0.06, tileW]} />
          <meshLambertMaterial color={floorDark} />
        </instancedMesh>
      )}
    </>
  );
}

// ── Color utility ─────────────────────────────────────────────────────────────

function hexBlend(hexA, hexB, t) {
  const parse = h => { const n = parseInt(h.replace('#',''), 16); return [(n>>16)&0xff,(n>>8)&0xff,n&0xff]; };
  const [rA,gA,bA] = parse(hexA); const [rB,gB,bB] = parse(hexB);
  const r = Math.round(rA+(rB-rA)*t), g = Math.round(gA+(gB-gA)*t), b = Math.round(bA+(bB-bA)*t);
  return `#${((r<<16)|(g<<8)|b).toString(16).padStart(6,'0')}`;
}

// ── Outer terrain ring (fills area beyond plaza tiles out to horizon) ──────────

function OuterTerrain({ cityRadius, theme }) {
  const T = theme || {};
  const outerColor = T.floorDark ? hexBlend(T.floorDark, '#000000', 0.12) : '#B0A090';
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.10, 0]}>
      <ringGeometry args={[cityRadius + 0.5, 320, 72]} />
      <meshLambertMaterial color={outerColor} />
    </mesh>
  );
}

// ── Deterministic horizon geometry seeds ──────────────────────────────────────

const MOUNTAIN_SEEDS = Array.from({ length: 16 }, (_, i) => ({
  angle: (i / 16) * Math.PI * 2 + i * 0.41,
  dist:  148 + (i * 37) % 72,
  h:     24 + (i * 13) % 38,
  w:     16 + (i *  7) % 18,
}));

const SKYLINE_SEEDS = Array.from({ length: 24 }, (_, i) => ({
  angle: (i / 24) * Math.PI * 2 + 0.13,
  dist:  96 + (i * 17) % 38,
  h:     10 + (i *  9) % 44,
  w:     2  + (i *  3) %  6,
}));

// ── Horizon scenery: mountains + distant city silhouettes ─────────────────────

function HorizonScenery({ theme }) {
  const T = theme || {};
  const sky    = T.sky    || '#8ED6FF';
  const ground = T.floorDark || '#C8B89A';
  const mountainColor   = hexBlend(sky, ground, 0.38);
  const silhouetteColor = hexBlend(sky, '#111111', 0.60);

  return (
    <>
      {/* Mountain range — cones fade into fog */}
      {MOUNTAIN_SEEDS.map((m, i) => (
        <mesh key={`mt-${i}`}
          position={[Math.cos(m.angle)*m.dist, m.h*0.5 - 2, Math.sin(m.angle)*m.dist]}>
          <coneGeometry args={[m.w, m.h, 5]} />
          <meshLambertMaterial color={mountainColor} />
        </mesh>
      ))}

      {/* Distant city skyline silhouettes */}
      {SKYLINE_SEEDS.map((s, i) => (
        <mesh key={`sl-${i}`}
          position={[Math.cos(s.angle)*s.dist, s.h*0.5, Math.sin(s.angle)*s.dist]}>
          <boxGeometry args={[s.w, s.h, s.w]} />
          <meshLambertMaterial color={silhouetteColor} transparent opacity={0.45} />
        </mesh>
      ))}
    </>
  );
}

// ── Sky layer: sun + drifting clouds ──────────────────────────────────────────

// Deterministic cloud positions (no Math.random at module level)
const CLOUD_DATA = Array.from({ length: 16 }, (_, i) => ({
  x:  Math.cos(i * 2.399) * (88 + (i * 29) % 72),
  y:  44 + (i * 11) % 30,
  z:  Math.sin(i * 2.399) * (88 + (i * 29) % 72),
  sx: 2.4 + (i *  7) % 2.6,
  sz: 1.8 + (i *  5) % 2.0,
  sy: 0.42 + (i * 3) % 0.3,
}));

function SkyLayer({ theme }) {
  const T = theme || {};
  const sunCol = T.sun || "#FFF8E8";
  const cloudRef = useRef();
  useFrame(() => { if (cloudRef.current) cloudRef.current.rotation.y += 0.00006; });

  return (
    <>
      {/* Sun disc + soft halo */}
      <group position={[140, 90, -170]}>
        <mesh>
          <sphereGeometry args={[11, 16, 12]} />
          <meshBasicMaterial color={sunCol} transparent opacity={0.94} />
        </mesh>
        <mesh>
          <sphereGeometry args={[20, 16, 12]} />
          <meshBasicMaterial color={sunCol} transparent opacity={0.14} />
        </mesh>
      </group>

      {/* Clouds — single slow-rotation group for free drift */}
      <group ref={cloudRef}>
        {CLOUD_DATA.map((c, i) => (
          <mesh key={i} position={[c.x, c.y, c.z]} scale={[c.sx, c.sy, c.sz]}>
            <sphereGeometry args={[9, 8, 6]} />
            <meshBasicMaterial color="#FFFFFF" transparent opacity={0.52} />
          </mesh>
        ))}
      </group>
    </>
  );
}

// ── Main artery roads (hub → district centers, wider than local paths) ─────────

function MainArtery({ from, to }) {
  const segs = useMemo(() => {
    const dx = to.x - from.x, dz = to.z - from.z;
    const n  = Math.ceil(Math.sqrt(dx*dx + dz*dz) / (BSIZE * 0.8));
    return Array.from({ length: n }, (_, i) => ({
      x: from.x + dx * (i / n), z: from.z + dz * (i / n),
    }));
  }, [from, to]);
  return (
    <>
      {segs.map((s, i) => (
        <mesh key={i} position={[s.x, 0.05, s.z]}>
          <boxGeometry args={[BSIZE * 1.15, 0.08, BSIZE * 1.15]} />
          <meshLambertMaterial color="#c4b49e" />
        </mesh>
      ))}
    </>
  );
}

// ── District platform ─────────────────────────────────────────────────────────

function District({ color, groundColor, active }) {
  const rimRef = useRef();
  useFrame((state) => {
    if (!rimRef.current) return;
    rimRef.current.material.opacity = active
      ? 0.55 + Math.sin(state.clock.elapsedTime * 2.5) * 0.2
      : 0.25;
  });
  return (
    <group>
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[3.8, 3.8, 0.28, 14]} />
        <meshLambertMaterial color={groundColor} />
      </mesh>
      <mesh ref={rimRef} position={[0, 0.21, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3.55, 3.8, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.25} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// ── District expansion ────────────────────────────────────────────────────────

function DistrictExpansion({ level, agentId, c }) {
  if (level < 2) return null;
  const structures = useMemo(() => {
    const rng   = (s) => ((Math.sin(s) * 43758.5453) % 1 + 1) % 1;
    const seed  = [...agentId].reduce((a, ch) => a + ch.charCodeAt(0), 0);
    const count = level * 2 + 2;
    return Array.from({ length: count }, (_, i) => ({
      x:   Math.cos((i / count) * Math.PI * 2 + rng(seed + i) * 0.8) * (3.6 + rng(seed + i * 10) * 1.2),
      z:   Math.sin((i / count) * Math.PI * 2 + rng(seed + i) * 0.8) * (3.6 + rng(seed + i * 10) * 1.2),
      h:   0.4 + rng(seed + i * 7) * (level * 0.55),
      w:   0.38 + rng(seed + i * 3) * 0.52,
      alt: i % 2 === 0,
    }));
  }, [level, agentId]);
  return (
    <>
      {structures.map((s, i) => (
        <mesh key={i} position={[s.x, s.h / 2 + 0.28, s.z]}>
          <boxGeometry args={[s.w, s.h, s.w]} />
          <meshLambertMaterial color={s.alt ? c.primary : c.ground} emissive={c.emissive} emissiveIntensity={0.1} />
        </mesh>
      ))}
    </>
  );
}

// ── Path segments ─────────────────────────────────────────────────────────────

function Road({ from, to }) {
  const segs = useMemo(() => {
    const dx = to.x - from.x, dz = to.z - from.z;
    const n  = Math.ceil(Math.sqrt(dx * dx + dz * dz) / (BSIZE * 0.85));
    return Array.from({ length: n }, (_, i) => ({
      x: from.x + dx * (i / n), z: from.z + dz * (i / n),
    }));
  }, [from, to]);
  return (
    <>
      {segs.map((s, i) => (
        <mesh key={i} position={[s.x, 0.07, s.z]}>
          <boxGeometry args={[BSIZE * 0.62, 0.1, BSIZE * 0.62]} />
          <meshLambertMaterial color={PATH_COLOR} />
        </mesh>
      ))}
    </>
  );
}

// ── Mii-style NPC walkers ─────────────────────────────────────────────────────

function NPCWalker({ from, to, color, offset, celebrating, onWalkerClick, reactionTarget }) {
  const groupRef   = useRef();
  const lLegRef    = useRef();
  const rLegRef    = useRef();
  const lArmRef    = useRef();
  const rArmRef    = useRef();
  const prog       = useRef(offset % 1);
  const frozenPos  = useRef(null);

  useFrame((state, dt) => {
    if (!groupRef.current) return;

    prog.current = (prog.current + dt * 0.34) % 1;

    if (reactionTarget) {
      if (!frozenPos.current && groupRef.current.position.y > 0.1)
        frozenPos.current = groupRef.current.position.clone();
      if (frozenPos.current) {
        groupRef.current.position.copy(frozenPos.current);
        const dx = reactionTarget.x - frozenPos.current.x;
        const dz = reactionTarget.z - frozenPos.current.z;
        groupRef.current.rotation.y += (Math.atan2(dx, dz) - groupRef.current.rotation.y) * 0.12;
        if (lLegRef.current) lLegRef.current.rotation.x = 0;
        if (rLegRef.current) rLegRef.current.rotation.x = 0;
        if (lArmRef.current) lArmRef.current.rotation.x = 0;
        if (rArmRef.current) rArmRef.current.rotation.x = 0;
        return;
      }
    }
    frozenPos.current = null;
    const t   = prog.current;
    const bob = Math.abs(Math.sin(t * Math.PI * 10)) * 0.05 + (celebrating ? Math.abs(Math.sin(t * Math.PI * 16)) * 0.4 : 0);
    groupRef.current.position.set(
      from.x + (to.x - from.x) * t,
      0.25 + bob,
      from.z + (to.z - from.z) * t
    );
    groupRef.current.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
    const swing = Math.sin(state.clock.elapsedTime * 6 + offset * 10);
    if (lLegRef.current) lLegRef.current.rotation.x =  swing * 0.45;
    if (rLegRef.current) rLegRef.current.rotation.x = -swing * 0.45;
    if (lArmRef.current) lArmRef.current.rotation.x = -swing * 0.35;
    if (rArmRef.current) rArmRef.current.rotation.x =  swing * 0.35;
  });

  return (
    <group ref={groupRef} position={[from.x, 0.25, from.z]}
      onClick={(e) => { e.stopPropagation(); if (onWalkerClick) onWalkerClick(); }}>
      {/* Body */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.3, 0.34, 0.22]} />
        <meshLambertMaterial color={color} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 0.32, 0]}>
        <boxGeometry args={[0.26, 0.26, 0.26]} />
        <meshLambertMaterial color="#F5D5A8" />
      </mesh>
      {/* Eyes */}
      <mesh position={[-0.07, 0.34, 0.13]}><boxGeometry args={[0.06, 0.06, 0.02]} /><meshBasicMaterial color="#2c2c2c" /></mesh>
      <mesh position={[ 0.07, 0.34, 0.13]}><boxGeometry args={[0.06, 0.06, 0.02]} /><meshBasicMaterial color="#2c2c2c" /></mesh>
      {/* Arms */}
      <group ref={lArmRef} position={[-0.22, 0.04, 0]}>
        <mesh position={[0, -0.1, 0]}><boxGeometry args={[0.1, 0.26, 0.1]} /><meshLambertMaterial color={color} /></mesh>
      </group>
      <group ref={rArmRef} position={[ 0.22, 0.04, 0]}>
        <mesh position={[0, -0.1, 0]}><boxGeometry args={[0.1, 0.26, 0.1]} /><meshLambertMaterial color={color} /></mesh>
      </group>
      {/* Legs */}
      <group ref={lLegRef} position={[-0.09, -0.2, 0]}>
        <mesh position={[0, -0.1, 0]}><boxGeometry args={[0.12, 0.2, 0.14]} /><meshLambertMaterial color={color} /></mesh>
      </group>
      <group ref={rLegRef} position={[ 0.09, -0.2, 0]}>
        <mesh position={[0, -0.1, 0]}><boxGeometry args={[0.12, 0.2, 0.14]} /><meshLambertMaterial color={color} /></mesh>
      </group>
    </group>
  );
}

// ── Background Mini Walker (Mii character, always moving) ─────────────────────

function MiniWalker({ positions, agents, seed, reactionTarget }) {
  const groupRef  = useRef();
  const headRef   = useRef();
  const lLegRef   = useRef();
  const rLegRef   = useRef();
  const state     = useRef(null);
  const frozenPos = useRef(null);

  const color = useMemo(() => {
    if (!agents.length) return Object.values(WALKER_COLORS)[seed % Object.values(WALKER_COLORS).length];
    return walkerColor(agents[seed % agents.length]?.category);
  }, [agents, seed]);

  useFrame((frame, dt) => {
    if (positions.length < 2 || !groupRef.current) return;

    if (!state.current) {
      state.current = {
        from:     seed % positions.length,
        to:       (seed + 1) % positions.length,
        progress: (seed * 0.063) % 1,
        speed:    0.15 + (seed * 0.031) % 0.22,
        dwell:    0,
      };
    }

    const s = state.current;

    // Dwell at destination before moving on
    if (s.dwell > 0) {
      s.dwell -= dt;
      // Face the building while paused
      const dest = positions[s.to];
      if (dest && groupRef.current) {
        const dx = dest.x - groupRef.current.position.x;
        const dz = dest.z - groupRef.current.position.z;
        groupRef.current.rotation.y += (Math.atan2(dx, dz) - groupRef.current.rotation.y) * 0.08;
        if (lLegRef.current) lLegRef.current.rotation.x = 0;
        if (rLegRef.current) rLegRef.current.rotation.x = 0;
      }
      return;
    }

    s.progress += s.speed * dt;
    if (s.progress >= 1) {
      s.from = s.to;
      const next = Math.floor(Math.random() * positions.length);
      s.to = next === s.from ? (s.from + 1) % positions.length : next;
      s.progress = 0;
      s.dwell = 0.8 + Math.random() * 1.4; // pause 0.8–2.2s at each building
    }

    const f = positions[s.from], t = positions[s.to];
    if (!f || !t) return;

    const p   = s.progress;
    const bob = Math.abs(Math.sin(p * Math.PI * 16)) * 0.06;
    groupRef.current.position.set(
      f.x + (t.x - f.x) * p,
      0.2 + bob,
      f.z + (t.z - f.z) * p
    );
    groupRef.current.rotation.y = Math.atan2(t.x - f.x, t.z - f.z);

    if (reactionTarget) {
      // Capture current (valid) position and freeze facing the event building
      frozenPos.current = groupRef.current.position.clone();
      const dx = reactionTarget.x - frozenPos.current.x;
      const dz = reactionTarget.z - frozenPos.current.z;
      groupRef.current.rotation.y += (Math.atan2(dx, dz) - groupRef.current.rotation.y) * 0.1;
      if (lLegRef.current) lLegRef.current.rotation.x = 0;
      if (rLegRef.current) rLegRef.current.rotation.x = 0;
      return;
    }
    frozenPos.current = null;

    if (headRef.current) {
      headRef.current.rotation.y = Math.sin(frame.clock.elapsedTime * 1.3 + seed * 0.7) * 0.28;
    }
    const swing = Math.sin(frame.clock.elapsedTime * 6.5 + seed);
    if (lLegRef.current) lLegRef.current.rotation.x =  swing * 0.42;
    if (rLegRef.current) rLegRef.current.rotation.x = -swing * 0.42;
  });

  return (
    <group ref={groupRef}>
      {/* Body */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.24, 0.28, 0.18]} />
        <meshLambertMaterial color={color} />
      </mesh>
      {/* Head */}
      <group ref={headRef} position={[0, 0.28, 0]}>
        <mesh><boxGeometry args={[0.22, 0.22, 0.22]} /><meshLambertMaterial color="#F5D5A8" /></mesh>
        <mesh position={[-0.055, 0.02, 0.11]}><boxGeometry args={[0.055, 0.055, 0.02]} /><meshBasicMaterial color="#2c2c2c" /></mesh>
        <mesh position={[ 0.055, 0.02, 0.11]}><boxGeometry args={[0.055, 0.055, 0.02]} /><meshBasicMaterial color="#2c2c2c" /></mesh>
      </group>
      {/* Legs */}
      <group ref={lLegRef} position={[-0.07, -0.17, 0]}>
        <mesh position={[0, -0.07, 0]}><boxGeometry args={[0.1, 0.14, 0.12]} /><meshLambertMaterial color={color} /></mesh>
      </group>
      <group ref={rLegRef} position={[ 0.07, -0.17, 0]}>
        <mesh position={[0, -0.07, 0]}><boxGeometry args={[0.1, 0.14, 0.12]} /><meshLambertMaterial color={color} /></mesh>
      </group>
    </group>
  );
}

function BackgroundWalkerPool({ positions, agents, reactionTarget, count = 16 }) {
  if (positions.length < 2) return null;
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <MiniWalker key={i} positions={positions} agents={agents} seed={i} reactionTarget={reactionTarget} />
      ))}
    </>
  );
}

// ── Developer Avatar (Mii-style, walks between own buildings) ─────────────────

function DeveloperAvatar({ developer, agentPositions, celebrating, onClick }) {
  const groupRef = useRef();
  const headRef  = useRef();
  const lArmRef  = useRef();
  const rArmRef  = useRef();
  const lLegRef  = useRef();
  const rLegRef  = useRef();
  const starRef  = useRef();
  const state    = useRef(null);

  useFrame((frame, dt) => {
    if (!groupRef.current) return;
    const t = frame.clock.elapsedTime;

    if (!state.current) {
      const startPos = agentPositions[0] || { x: 0, z: 0 };
      groupRef.current.position.set(startPos.x, 0.2, startPos.z);
      state.current = { from: 0, to: Math.min(1, agentPositions.length - 1), progress: 0, speed: 0.1 + Math.random() * 0.08, dwell: 2 + Math.random() };
    }
    const s = state.current;

    // Celebrate: jump + wave
    if (celebrating) {
      const jump = Math.abs(Math.sin(t * 9)) * 0.28;
      groupRef.current.position.y = 0.2 + jump;
      if (lArmRef.current) lArmRef.current.rotation.z =  Math.sin(t * 9) * 0.9 + 0.4;
      if (rArmRef.current) rArmRef.current.rotation.z = -Math.sin(t * 9) * 0.9 - 0.4;
      if (starRef.current) {
        starRef.current.rotation.y = t * 3;
        starRef.current.material.emissiveIntensity = 1.2 + Math.sin(t * 7) * 0.5;
      }
      return;
    }

    if (agentPositions.length < 2) { groupRef.current.position.y = 0.2; return; }

    if (s.dwell > 0) {
      s.dwell -= dt;
      if (lLegRef.current) lLegRef.current.rotation.x = 0;
      if (rLegRef.current) rLegRef.current.rotation.x = 0;
      if (lArmRef.current) lArmRef.current.rotation.z =  0.15;
      if (rArmRef.current) rArmRef.current.rotation.z = -0.15;
      return;
    }

    s.progress += s.speed * dt;
    if (s.progress >= 1) {
      s.from = s.to;
      const next = Math.floor(Math.random() * agentPositions.length);
      s.to = next === s.from ? (s.from + 1) % agentPositions.length : next;
      s.progress = 0;
      s.dwell = 1.5 + Math.random() * 2.5;
    }

    const f = agentPositions[s.from], tk = agentPositions[s.to];
    if (!f || !tk) return;
    const p   = s.progress;
    const bob = Math.abs(Math.sin(p * Math.PI * 14)) * 0.07;
    groupRef.current.position.set(f.x + (tk.x - f.x) * p, 0.2 + bob, f.z + (tk.z - f.z) * p);
    groupRef.current.rotation.y = Math.atan2(tk.x - f.x, tk.z - f.z);

    const swing = Math.sin(t * 6.5);
    if (lLegRef.current) lLegRef.current.rotation.x =  swing * 0.45;
    if (rLegRef.current) rLegRef.current.rotation.x = -swing * 0.45;
    if (lArmRef.current) lArmRef.current.rotation.z =  Math.sin(t * 6.5 + 1.57) * 0.22 + 0.15;
    if (rArmRef.current) rArmRef.current.rotation.z = -Math.sin(t * 6.5 + 1.57) * 0.22 - 0.15;
    if (headRef.current)  headRef.current.rotation.y = Math.sin(t * 1.1) * 0.2;
    if (starRef.current) { starRef.current.rotation.y = t * 1.4; starRef.current.material.emissiveIntensity = 0.5 + Math.sin(t * 2.2) * 0.2; }
  });

  const devColor = developer.color || "#4a9fd4";

  return (
    <group ref={groupRef} onClick={(e) => { e.stopPropagation(); onClick?.(); }}>
      {/* Body — developer color shirt */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.27, 0.31, 0.19]} />
        <meshLambertMaterial color={devColor} />
      </mesh>
      {/* Head */}
      <group ref={headRef} position={[0, 0.31, 0]}>
        <mesh><boxGeometry args={[0.25, 0.25, 0.25]} /><meshLambertMaterial color="#F5D5A8" /></mesh>
        <mesh position={[-0.065, 0.02, 0.125]}><boxGeometry args={[0.06, 0.065, 0.02]} /><meshBasicMaterial color="#2c2c2c" /></mesh>
        <mesh position={[ 0.065, 0.02, 0.125]}><boxGeometry args={[0.06, 0.065, 0.02]} /><meshBasicMaterial color="#2c2c2c" /></mesh>
        {/* Hair band in dev color */}
        <mesh position={[0, 0.115, 0]}><boxGeometry args={[0.27, 0.045, 0.27]} /><meshLambertMaterial color={devColor} /></mesh>
      </group>
      {/* Gold star badge */}
      <mesh ref={starRef} position={[0.19, 0.56, 0]}>
        <octahedronGeometry args={[0.08, 0]} />
        <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={0.5} metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Arms */}
      <group ref={lArmRef} position={[-0.22, 0.05, 0]}>
        <mesh position={[0, -0.1, 0]}><boxGeometry args={[0.1, 0.27, 0.1]} /><meshLambertMaterial color={devColor} /></mesh>
      </group>
      <group ref={rArmRef} position={[ 0.22, 0.05, 0]}>
        <mesh position={[0, -0.1, 0]}><boxGeometry args={[0.1, 0.27, 0.1]} /><meshLambertMaterial color={devColor} /></mesh>
      </group>
      {/* Legs — dark jeans */}
      <group ref={lLegRef} position={[-0.09, -0.21, 0]}>
        <mesh position={[0, -0.1, 0]}><boxGeometry args={[0.12, 0.21, 0.14]} /><meshLambertMaterial color="#2d4a7a" /></mesh>
      </group>
      <group ref={rLegRef} position={[ 0.09, -0.21, 0]}>
        <mesh position={[0, -0.1, 0]}><boxGeometry args={[0.12, 0.21, 0.14]} /><meshLambertMaterial color="#2d4a7a" /></mesh>
      </group>
      {/* Name + DEV label */}
      <Billboard position={[0, 1.15, 0]} follow lockX={false} lockZ={false}>
        <Text fontSize={0.19} color={devColor} anchorX="center"
          outlineWidth={0.04} outlineColor="#ffffff" fontWeight={800}>{developer.name}</Text>
        <Text fontSize={0.13} color="#FFD700" anchorX="center" position={[0, -0.22, 0]}
          outlineWidth={0.03} outlineColor="#000000" fontWeight={700}>DEV</Text>
      </Billboard>
    </group>
  );
}

// ── Developer Profile Panel (HTML overlay) ────────────────────────────────────

function DeveloperProfilePanel({ developer, onClose }) {
  if (!developer) return null;
  const devColor = developer.color || "#4a9fd4";
  return (
    <div style={{
      position: "absolute", top: "50%", left: "50%",
      transform: "translate(-50%, -50%)",
      background: "#fff", borderRadius: 18,
      boxShadow: "0 8px 40px rgba(0,0,0,0.20)",
      padding: "24px 28px", minWidth: 280, maxWidth: 340,
      zIndex: 200, fontFamily: "inherit",
      border: `2px solid ${devColor}50`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{
          width: 46, height: 46, borderRadius: 13, background: devColor,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontSize: 20, fontWeight: 800,
        }}>{developer.name.charAt(0).toUpperCase()}</div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16, color: "#2d3a4a" }}>{developer.name}</div>
          <div style={{ fontSize: 12, color: "#9aabb8", marginTop: 2 }}>
            Developer · {developer.agents.length} agent{developer.agents.length !== 1 ? "s" : ""}
          </div>
        </div>
        <button onClick={onClose} style={{
          marginLeft: "auto", background: "none", border: "none",
          fontSize: 22, cursor: "pointer", color: "#9aabb8", lineHeight: 1,
        }}>×</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
        {[["Total Calls", developer.total_calls], ["Total Earned", `$${(developer.total_earnings || 0).toFixed(2)}`]].map(([k, v]) => (
          <div key={k} style={{ background: "#f8f6f2", borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ color: "#9aabb8", fontSize: 9, textTransform: "uppercase", letterSpacing: 0.7 }}>{k}</div>
            <div style={{ color: "#2d3a4a", fontWeight: 800, fontSize: 18 }}>{String(v)}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: "#9aabb8", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 8 }}>Agents</div>
      {developer.agents.map(a => (
        <div key={a.id} style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 10px", background: "#f8f6f2", borderRadius: 8, marginBottom: 6,
        }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: "#2d3a4a" }}>{a.name}</div>
          <div style={{ display: "flex", gap: 10 }}>
            <span style={{ color: "#9aabb8", fontSize: 11 }}>{a.calls} calls</span>
            <span style={{ color: "#6BCF8B", fontSize: 11, fontWeight: 700 }}>${(a.earnings || 0).toFixed(2)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Agent swarm ───────────────────────────────────────────────────────────────

function AgentSwarm({ c, active, celebrating }) {
  const refs = useRef([]);
  const N    = 5;
  useFrame((state) => {
    const spd = celebrating ? 3.5 : active ? 1.9 : 0.5;
    refs.current.forEach((r, i) => {
      if (!r) return;
      const t      = state.clock.elapsedTime * spd + (i / N) * Math.PI * 2;
      const radius = 2.7 + Math.sin(state.clock.elapsedTime * 0.7 + i) * 0.4;
      r.position.set(Math.cos(t) * radius, 0.5 + Math.abs(Math.sin(t * 0.6 + i)) * 0.6, Math.sin(t) * radius);
      r.material.opacity = active || celebrating ? 0.85 : 0.28;
    });
  });
  return (
    <>
      {Array.from({ length: N }, (_, i) => (
        <mesh key={i} ref={el => { refs.current[i] = el; }}>
          <boxGeometry args={[0.18, 0.18, 0.18]} />
          <meshBasicMaterial color={c.primary} transparent opacity={0.3} />
        </mesh>
      ))}
    </>
  );
}

// ── Plaza props ───────────────────────────────────────────────────────────────

function Tree({ x, z, scale = 1, seed = 0 }) {
  const ref = useRef();
  useFrame((s) => {
    if (!ref.current) return;
    const t = s.clock.elapsedTime * 0.38 + seed * 1.9;
    ref.current.rotation.x = Math.sin(t) * 0.028;
    ref.current.rotation.z = Math.cos(t * 0.73) * 0.022;
  });
  return (
    <group ref={ref} position={[x, 0, z]} scale={[scale, scale, scale]}>
      <mesh position={[0, 0.7, 0]}>
        <cylinderGeometry args={[0.18, 0.24, 1.4, 6]} />
        <meshLambertMaterial color={TREE_TRUNK} />
      </mesh>
      <mesh position={[0, 2.1, 0]}>
        <coneGeometry args={[1.25, 1.9, 7]} />
        <meshLambertMaterial color={TREE_LEAF} />
      </mesh>
      <mesh position={[0, 3.25, 0]}>
        <coneGeometry args={[0.92, 1.55, 7]} />
        <meshLambertMaterial color="#9DE874" />
      </mesh>
      <mesh position={[0, 4.15, 0]}>
        <coneGeometry args={[0.58, 1.2, 6]} />
        <meshLambertMaterial color="#B4F08A" />
      </mesh>
    </group>
  );
}

function LampPost({ x, z, seed = 0 }) {
  const lightRef = useRef();
  useFrame((s) => {
    if (!lightRef.current) return;
    lightRef.current.intensity = 2.1 + Math.sin(s.clock.elapsedTime * 1.1 + seed * 2.3) * 0.45;
  });
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 2.2, 0]}>
        <cylinderGeometry args={[0.07, 0.1, 4.4, 6]} />
        <meshLambertMaterial color={LAMP_POLE} />
      </mesh>
      {/* Arm */}
      <mesh position={[0.3, 4.55, 0]} rotation={[0, 0, -0.38]}>
        <cylinderGeometry args={[0.04, 0.04, 0.72, 5]} />
        <meshLambertMaterial color={LAMP_POLE} />
      </mesh>
      {/* Globe */}
      <mesh position={[0.52, 4.36, 0]}>
        <sphereGeometry args={[0.24, 10, 10]} />
        <meshLambertMaterial color={LAMP_GLOW} emissive={LAMP_GLOW} emissiveIntensity={1.0} />
      </mesh>
      <pointLight ref={lightRef} position={[0.52, 4.36, 0]} intensity={2.5} color={LAMP_GLOW} distance={7} decay={2} />
    </group>
  );
}

function BenchSitter({ offsetX = 0, color = "#4DD9B8" }) {
  const headRef = useRef();
  useFrame((s) => {
    if (headRef.current) headRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.6 + offsetX * 3) * 0.25;
  });
  return (
    <group position={[offsetX, 0.52, 0.04]}>
      {/* Torso — slightly reclined */}
      <mesh position={[0, 0.2, 0]} rotation={[0.28, 0, 0]}>
        <boxGeometry args={[0.28, 0.38, 0.22]} />
        <meshLambertMaterial color={color} />
      </mesh>
      {/* Head */}
      <group ref={headRef} position={[0, 0.56, -0.02]}>
        <mesh><boxGeometry args={[0.22, 0.22, 0.22]} /><meshLambertMaterial color="#f5d0a0" /></mesh>
        {/* Eyes */}
        <mesh position={[-0.06, 0.02, 0.112]}><boxGeometry args={[0.05, 0.04, 0.02]} /><meshBasicMaterial color="#222" /></mesh>
        <mesh position={[ 0.06, 0.02, 0.112]}><boxGeometry args={[0.05, 0.04, 0.02]} /><meshBasicMaterial color="#222" /></mesh>
      </group>
      {/* Legs — hanging down from seat */}
      <mesh position={[-0.08, -0.06, 0.14]} rotation={[0.9, 0, 0]}><boxGeometry args={[0.1, 0.28, 0.1]} /><meshLambertMaterial color={color} /></mesh>
      <mesh position={[ 0.08, -0.06, 0.14]} rotation={[0.9, 0, 0]}><boxGeometry args={[0.1, 0.28, 0.1]} /><meshLambertMaterial color={color} /></mesh>
      {/* Arms resting on lap */}
      <mesh position={[-0.2, 0.12, 0.06]} rotation={[0.4, 0, 0.3]}><boxGeometry args={[0.08, 0.26, 0.09]} /><meshLambertMaterial color={color} /></mesh>
      <mesh position={[ 0.2, 0.12, 0.06]} rotation={[0.4, 0, -0.3]}><boxGeometry args={[0.08, 0.26, 0.09]} /><meshLambertMaterial color={color} /></mesh>
    </group>
  );
}

function Bench({ x, z, rotation = 0 }) {
  // Deterministic color per bench position
  const SITTER_COLORS = ["#4DD9B8", "#C8A0F8", "#38C8F4", "#FF8096"];
  const colorIdx = Math.abs(Math.round(x + z)) % SITTER_COLORS.length;
  const color = SITTER_COLORS[colorIdx];
  return (
    <group position={[x, 0, z]} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.44, 0]}>
        <boxGeometry args={[1.5, 0.1, 0.5]} />
        <meshLambertMaterial color={BENCH_WOOD} />
      </mesh>
      <mesh position={[0, 0.76, -0.2]}>
        <boxGeometry args={[1.5, 0.52, 0.09]} />
        <meshLambertMaterial color={BENCH_WOOD} />
      </mesh>
      <mesh position={[-0.62, 0.22, 0]}><boxGeometry args={[0.09, 0.44, 0.46]} /><meshLambertMaterial color={BENCH_LEG} /></mesh>
      <mesh position={[ 0.62, 0.22, 0]}><boxGeometry args={[0.09, 0.44, 0.46]} /><meshLambertMaterial color={BENCH_LEG} /></mesh>
      {/* Two sitters per bench */}
      <BenchSitter offsetX={-0.38} color={color} />
      <BenchSitter offsetX={ 0.38} color={color} />
    </group>
  );
}

// ── Clouds ────────────────────────────────────────────────────────────────────

function Cloud({ x, z, y = 20, speed = 0.016, phase = 0 }) {
  const ref = useRef();
  useFrame((s) => {
    if (!ref.current) return;
    ref.current.position.x = x + Math.sin(s.clock.elapsedTime * speed + phase) * 22;
    ref.current.position.z = z + Math.cos(s.clock.elapsedTime * speed * 0.55 + phase) * 9;
  });
  return (
    <group ref={ref} position={[x, y, z]}>
      {[
        [0, 0, 0, 5.6, 1.6, 3.6],
        [-3.2, 0.35, 0, 3.4, 1.2, 2.8],
        [ 3.2, 0.35, 0, 3.4, 1.2, 2.8],
        [-1.5, 0.95, 0, 2.8, 1.0, 2.4],
        [ 1.5, 0.95, 0, 2.8, 1.0, 2.4],
      ].map(([cx, cy, cz, w, h, d], i) => (
        <mesh key={i} position={[cx, cy, cz]}>
          <boxGeometry args={[w, h, d]} />
          <meshLambertMaterial color="#ffffff" transparent opacity={0.80} />
        </mesh>
      ))}
    </group>
  );
}

function CloudLayer() {
  return (
    <>
      <Cloud x={-20} z={-15} y={22} speed={0.014} phase={0}    />
      <Cloud x={ 28} z={  8} y={25} speed={0.010} phase={2.1}  />
      <Cloud x={  5} z={ 32} y={21} speed={0.018} phase={4.5}  />
    </>
  );
}

function PlazaProps() {
  const innerTrees = [
    [6.8, 0], [-6.8, 0], [0, 6.8], [0, -6.8],
    [4.9, 4.9], [-4.9, 4.9], [4.9, -4.9], [-4.9, -4.9],
  ];
  const outerTrees = [
    [20, 6], [-20, 6], [20, -6], [-20, -6],
    [6, 20], [-6, 20], [6, -20], [-6, -20],
    [24, 0], [-24, 0], [0, 24], [0, -24],
    [17, 16], [-17, 16], [17, -16], [-17, -16],
    [26, 10], [-26, 10], [10, 26], [-10, -26],
  ];
  const lamps = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    return [Math.cos(a) * 7.6, Math.sin(a) * 7.6];
  });
  const benches = [
    [4.4, 0, 0], [-4.4, 0, Math.PI],
    [0, 4.4, -Math.PI / 2], [0, -4.4, Math.PI / 2],
  ];
  return (
    <>
      {innerTrees.map(([x, z], i) => <Tree key={`it${i}`} x={x} z={z} scale={0.72 + (i % 3) * 0.12} seed={i} />)}
      {outerTrees.map(([x, z], i) => <Tree key={`ot${i}`} x={x} z={z} scale={0.85 + (i % 4) * 0.1} seed={i + 10} />)}
      {lamps.map(([x, z], i)       => <LampPost key={`l${i}`} x={x} z={z} seed={i} />)}
      {benches.map(([x, z, r], i)  => <Bench key={`b${i}`} x={x} z={z} rotation={r} />)}
    </>
  );
}

// ── Agent Characters ──────────────────────────────────────────────────────────

function CharBody({ active, celebrating, children }) {
  const bodyRef = useRef();
  useFrame((state) => {
    if (!bodyRef.current) return;
    const t      = state.clock.elapsedTime;
    const bounce = celebrating ? Math.abs(Math.sin(t * 9)) * 0.55 : 0;
    const ei     = celebrating ? 1.4 : active ? 0.8 + Math.sin(t * 5) * 0.22 : 0.15 + Math.sin(t * 1.2) * 0.06;
    bodyRef.current.position.y = 0.72 + Math.sin(t * 1.8) * 0.06 + bounce;
    bodyRef.current.children.forEach(ch => {
      if (ch.material) ch.material.emissiveIntensity = ei;
    });
  });
  return <group ref={bodyRef} position={[0, 0.72, 0]}>{children}</group>;
}

function TradingChar({ c, active, celebrating }) {
  const ringRef = useRef();
  useFrame(() => { if (ringRef.current) ringRef.current.rotation.y += celebrating ? 0.08 : 0.025; });
  return (
    <CharBody active={active} celebrating={celebrating}>
      <mesh><boxGeometry args={[0.9, 1.1, 0.75]} /><meshLambertMaterial color={c.dark} emissive={c.emissive} emissiveIntensity={0.15} /></mesh>
      <mesh position={[0, 0.9, 0]}><boxGeometry args={[0.75, 0.75, 0.75]} /><meshLambertMaterial color={c.primary} emissive={c.emissive} emissiveIntensity={0.2} /></mesh>
      <mesh position={[-0.18, 0.9, 0.38]}><boxGeometry args={[0.12, 0.12, 0.04]} /><meshBasicMaterial color="#333" /></mesh>
      <mesh position={[0.18, 0.9, 0.38]}><boxGeometry args={[0.12, 0.12, 0.04]} /><meshBasicMaterial color="#333" /></mesh>
      <mesh position={[0, 1.4, 0]}><boxGeometry args={[0.65, 0.15, 0.65]} /><meshLambertMaterial color={c.primary} emissive={c.emissive} emissiveIntensity={0.2} /></mesh>
      <mesh position={[0, 1.65, 0]}><boxGeometry args={[0.45, 0.45, 0.45]} /><meshLambertMaterial color={c.primary} emissive={c.emissive} emissiveIntensity={0.3} /></mesh>
      <group ref={ringRef} position={[0, 0.5, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.75, 0.06, 6, 24]} /><meshBasicMaterial color={c.primary} /></mesh>
      </group>
    </CharBody>
  );
}

function AnalysisChar({ c, active, celebrating }) {
  const orbitRef = useRef();
  useFrame((s) => { if (orbitRef.current) orbitRef.current.rotation.y = s.clock.elapsedTime * (celebrating ? 2.8 : 0.9); });
  return (
    <CharBody active={active} celebrating={celebrating}>
      <mesh><boxGeometry args={[0.85, 1.05, 0.7]} /><meshLambertMaterial color={c.dark} emissive={c.emissive} emissiveIntensity={0.15} /></mesh>
      <mesh position={[0, 0.9, 0]}><boxGeometry args={[0.75, 0.75, 0.75]} /><meshLambertMaterial color={c.primary} emissive={c.emissive} emissiveIntensity={0.2} /></mesh>
      <mesh position={[-0.18, 0.9, 0.38]}><boxGeometry args={[0.12, 0.12, 0.04]} /><meshBasicMaterial color="#333" /></mesh>
      <mesh position={[0.18, 0.9, 0.38]}><boxGeometry args={[0.12, 0.12, 0.04]} /><meshBasicMaterial color="#333" /></mesh>
      <group ref={orbitRef} position={[0, 0.55, 0]}>
        {[0, 1, 2].map(i => { const a = (i / 3) * Math.PI * 2; return (
          <mesh key={i} position={[Math.cos(a) * 0.85, 0, Math.sin(a) * 0.85]}>
            <boxGeometry args={[0.16, 0.16, 0.16]} /><meshBasicMaterial color={c.primary} />
          </mesh>
        ); })}
      </group>
    </CharBody>
  );
}

function DataChar({ c, active, celebrating }) {
  const refs = useRef([]);
  useFrame((s) => {
    refs.current.forEach((m, i) => {
      if (!m) return;
      const t = (s.clock.elapsedTime * (celebrating ? 3.2 : 1.7) + i * 0.33) % 1;
      m.position.y = 1.65 + t * 1.5;
      m.material.opacity = Math.sin(t * Math.PI) * 0.9;
    });
  });
  return (
    <CharBody active={active} celebrating={celebrating}>
      <mesh><boxGeometry args={[0.75, 1.0, 0.65]} /><meshLambertMaterial color={c.dark} emissive={c.emissive} emissiveIntensity={0.15} /></mesh>
      <mesh position={[0, 0.85, 0]}><boxGeometry args={[0.7, 0.7, 0.7]} /><meshLambertMaterial color={c.primary} emissive={c.emissive} emissiveIntensity={0.22} /></mesh>
      <mesh position={[0, 0.87, 0.36]}><boxGeometry args={[0.42, 0.14, 0.04]} /><meshBasicMaterial color="#3498DB" transparent opacity={0.8} /></mesh>
      <mesh position={[0, 1.52, 0]}><boxGeometry args={[0.07, 0.55, 0.07]} /><meshLambertMaterial color={c.primary} emissive={c.emissive} emissiveIntensity={0.5} /></mesh>
      {[0, 1, 2].map(i => (
        <mesh key={i} ref={el => { refs.current[i] = el; }} position={[0, 1.65, 0]}>
          <boxGeometry args={[0.09, 0.09, 0.09]} /><meshBasicMaterial color={c.primary} transparent opacity={0.9} />
        </mesh>
      ))}
    </CharBody>
  );
}

function RiskChar({ c, active, celebrating }) {
  const bodyRef2 = useRef();
  useFrame(() => {
    if (!bodyRef2.current || (!active && !celebrating)) return;
    bodyRef2.current.material.emissiveIntensity = 0.2 + Math.random() * (celebrating ? 0.8 : 0.3);
  });
  return (
    <CharBody active={active} celebrating={celebrating}>
      <mesh ref={bodyRef2}><boxGeometry args={[1.0, 1.1, 0.8]} /><meshLambertMaterial color={c.dark} emissive={c.emissive} emissiveIntensity={0.15} /></mesh>
      <mesh position={[0, 0.95, 0]}><boxGeometry args={[0.8, 0.8, 0.8]} /><meshLambertMaterial color={c.primary} emissive={c.emissive} emissiveIntensity={0.2} /></mesh>
      <mesh position={[-0.2, 0.97, 0.41]} rotation={[0, 0, 0.4]}><boxGeometry args={[0.14, 0.08, 0.04]} /><meshBasicMaterial color="#E74C3C" /></mesh>
      <mesh position={[0.2, 0.97, 0.41]} rotation={[0, 0, -0.4]}><boxGeometry args={[0.14, 0.08, 0.04]} /><meshBasicMaterial color="#E74C3C" /></mesh>
      <mesh position={[0, 1.5, 0]}><boxGeometry args={[0.82, 0.28, 0.82]} /><meshLambertMaterial color={c.primary} emissive={c.emissive} emissiveIntensity={0.22} /></mesh>
    </CharBody>
  );
}

function CompositeChar({ c, active, celebrating }) {
  const refs = useRef([]);
  useFrame((s) => {
    const cycle = (s.clock.elapsedTime * (celebrating ? 3.2 : 1.4)) % 4;
    refs.current.forEach((m, i) => {
      if (!m) return;
      m.material.opacity = i <= cycle ? 1 : 0;
      m.position.y = 1.7 + i * 0.28;
    });
  });
  return (
    <CharBody active={active} celebrating={celebrating}>
      <mesh><boxGeometry args={[0.95, 1.05, 0.8]} /><meshLambertMaterial color={c.dark} emissive={c.emissive} emissiveIntensity={0.15} /></mesh>
      <mesh position={[0, 0.92, 0]}><boxGeometry args={[0.8, 0.8, 0.8]} /><meshLambertMaterial color={c.primary} emissive={c.emissive} emissiveIntensity={0.2} /></mesh>
      <mesh position={[-0.18, 0.93, 0.41]}><boxGeometry args={[0.14, 0.14, 0.04]} /><meshBasicMaterial color="#333" /></mesh>
      <mesh position={[0.18, 0.93, 0.41]}><boxGeometry args={[0.14, 0.14, 0.04]} /><meshBasicMaterial color="#333" /></mesh>
      {[-0.28, 0, 0.28].map((x, i) => (
        <mesh key={i} position={[x, 1.48 + (i === 1 ? 0.14 : 0), 0]}>
          <boxGeometry args={[0.2, 0.28 + (i === 1 ? 0.14 : 0), 0.2]} /><meshBasicMaterial color={c.primary} />
        </mesh>
      ))}
      {Array.from({ length: 4 }, (_, i) => (
        <mesh key={i} ref={el => { refs.current[i] = el; }} position={[0, 1.7, 0]}>
          <boxGeometry args={[0.45 - i * 0.07, 0.22, 0.45 - i * 0.07]} />
          <meshBasicMaterial color={c.primary} transparent opacity={1} />
        </mesh>
      ))}
    </CharBody>
  );
}

function DefaultChar({ c, active, celebrating }) {
  return (
    <CharBody active={active} celebrating={celebrating}>
      <mesh><boxGeometry args={[0.85, 1.0, 0.7]} /><meshLambertMaterial color={c.dark} emissive={c.emissive} emissiveIntensity={0.15} /></mesh>
      <mesh position={[0, 0.87, 0]}><boxGeometry args={[0.72, 0.72, 0.72]} /><meshLambertMaterial color={c.primary} emissive={c.emissive} emissiveIntensity={0.2} /></mesh>
      <mesh position={[-0.17, 0.87, 0.37]}><boxGeometry args={[0.12, 0.12, 0.04]} /><meshBasicMaterial color="#333" /></mesh>
      <mesh position={[0.17, 0.87, 0.37]}><boxGeometry args={[0.12, 0.12, 0.04]} /><meshBasicMaterial color="#333" /></mesh>
    </CharBody>
  );
}

const CHARS = { trading: TradingChar, analysis: AnalysisChar, data: DataChar, risk: RiskChar, composite: CompositeChar };

// ── Cartoon speech bubble ─────────────────────────────────────────────────────

function SpeechBubble({ text, color }) {
  const w = Math.min(text.length * 0.175 + 0.5, 4.5);
  return (
    <Billboard follow lockX={false} lockZ={false}>
      {/* Colored border */}
      <mesh position={[0, 0, -0.04]}>
        <planeGeometry args={[w + 0.22, 0.72]} />
        <meshBasicMaterial color={color} side={THREE.DoubleSide} />
      </mesh>
      {/* White background */}
      <mesh position={[0, 0, -0.02]}>
        <planeGeometry args={[w + 0.08, 0.58]} />
        <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} />
      </mesh>
      {/* Bubble tail */}
      <mesh position={[0, -0.4, -0.03]} rotation={[0, 0, Math.PI / 4]}>
        <planeGeometry args={[0.2, 0.2]} />
        <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, -0.43, -0.045]} rotation={[0, 0, Math.PI / 4]}>
        <planeGeometry args={[0.26, 0.26]} />
        <meshBasicMaterial color={color} side={THREE.DoubleSide} />
      </mesh>
      <Text fontSize={0.23} color="#1a1a2e" anchorX="center" anchorY="middle" maxWidth={w - 0.15}>
        {text}
      </Text>
    </Billboard>
  );
}

// ── Beacon ────────────────────────────────────────────────────────────────────

function Beacon({ color, h, active }) {
  const ref = useRef();
  useFrame((s) => {
    if (!ref.current) return;
    ref.current.material.opacity = active ? 0.55 + Math.sin(s.clock.elapsedTime * 3.5) * 0.22 : 0.08;
  });
  return (
    <mesh ref={ref} position={[0, h + 4.5, 0]}>
      <cylinderGeometry args={[0.06, 0.06, 7, 6]} />
      <meshBasicMaterial color={color} transparent opacity={0.08} />
    </mesh>
  );
}

// ── Building tower stack (skyscraper growth per level) ───────────────────────

const FLOOR_H = 1.2; // extra height added per level

function BuildingStack({ c, level }) {
  if (level <= 0) return null;
  const floors = level; // one stack-floor per level
  const floorH = FLOOR_H;
  return (
    <>
      {Array.from({ length: floors }, (_, i) => {
        const y   = 0.35 + i * floorH;
        const w   = 1.6 - i * 0.1;          // taper upward
        return (
          <group key={i} position={[0, y, 0]}>
            {/* Floor slab */}
            <mesh>
              <boxGeometry args={[w, floorH * 0.7, w]} />
              <meshLambertMaterial color={i % 2 === 0 ? c.primary : c.dark}
                emissive={c.emissive} emissiveIntensity={0.12 + i * 0.04} />
            </mesh>
            {/* Window strip */}
            <mesh position={[0, floorH * 0.06, w * 0.501]}>
              <boxGeometry args={[w * 0.82, floorH * 0.28, 0.04]} />
              <meshBasicMaterial color={c.primary} transparent opacity={0.55} />
            </mesh>
          </group>
        );
      })}
      {/* Antenna / spire at top */}
      {level >= 3 && (
        <mesh position={[0, 0.35 + floors * floorH + 0.4, 0]}>
          <cylinderGeometry args={[0.04, 0.06, 0.8, 6]} />
          <meshLambertMaterial color={c.primary} emissive={c.emissive} emissiveIntensity={0.5} />
        </mesh>
      )}
    </>
  );
}

// ── Level rings ───────────────────────────────────────────────────────────────

function LevelRings({ c, level }) {
  if (level <= 0) return null;
  return (
    <>
      {Array.from({ length: level }, (_, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.22 + i * 0.12, 0]}>
          <ringGeometry args={[1.2 + i * 0.35, 1.4 + i * 0.35, 16]} />
          <meshBasicMaterial color={c.primary} transparent opacity={0.4 - i * 0.08} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </>
  );
}

// ── Category-specific building stacks ────────────────────────────────────────

function TradingBuildingStack({ c, level }) {
  if (level <= 0) return null;
  return (
    <>
      {Array.from({ length: level }, (_, i) => {
        const y = 0.35 + i * FLOOR_H;
        const w = 1.2 - i * 0.08; // very thin glass tower
        return (
          <group key={i} position={[0, y, 0]}>
            {/* Glass curtain wall */}
            <mesh><boxGeometry args={[w, FLOOR_H * 0.75, w]} /><meshLambertMaterial color={i % 2 === 0 ? c.dark : "#0a1a2a"} emissive={c.emissive} emissiveIntensity={0.1} /></mesh>
            {/* Gold band every other floor */}
            {i % 2 === 0 && <mesh position={[0, FLOOR_H * 0.38, 0]}><boxGeometry args={[w + 0.1, 0.08, w + 0.1]} /><meshBasicMaterial color="#FFD700" /></mesh>}
            {/* Reflective window strip */}
            <mesh position={[0, FLOOR_H * 0.1, w * 0.51]}><boxGeometry args={[w * 0.88, FLOOR_H * 0.55, 0.04]} /><meshBasicMaterial color={c.primary} transparent opacity={0.45} /></mesh>
            <mesh position={[0, FLOOR_H * 0.1, -w * 0.51]}><boxGeometry args={[w * 0.88, FLOOR_H * 0.55, 0.04]} /><meshBasicMaterial color={c.primary} transparent opacity={0.45} /></mesh>
          </group>
        );
      })}
      {/* Gold spire */}
      {level >= 2 && <mesh position={[0, 0.35 + level * FLOOR_H + 0.5, 0]}><coneGeometry args={[0.18, 1.2, 4]} /><meshBasicMaterial color="#FFD700" /></mesh>}
    </>
  );
}

function DataBuildingStack({ c, level }) {
  if (level <= 0) return null;
  return (
    <>
      {Array.from({ length: level }, (_, i) => {
        const y = 0.35 + i * FLOOR_H;
        const w = 1.9 - i * 0.05; // wide flat server racks
        const d = 1.4 - i * 0.04;
        return (
          <group key={i} position={[0, y, 0]}>
            {/* Wide rack body */}
            <mesh><boxGeometry args={[w, FLOOR_H * 0.65, d]} /><meshLambertMaterial color={i % 2 === 0 ? c.dark : "#061318"} emissive={c.emissive} emissiveIntensity={0.08} /></mesh>
            {/* LED strip rows */}
            {[0.18, 0.06, -0.06, -0.18].map((oy, j) => (
              <mesh key={j} position={[0, oy, d * 0.51]}><boxGeometry args={[w * 0.8, 0.05, 0.03]} /><meshBasicMaterial color={j % 2 === 0 ? c.primary : "#0088BB"} /></mesh>
            ))}
            {/* Side panel */}
            <mesh position={[w * 0.51, 0, 0]}><boxGeometry args={[0.04, FLOOR_H * 0.62, d]} /><meshBasicMaterial color={c.primary} transparent opacity={0.3} /></mesh>
          </group>
        );
      })}
      {/* Antenna */}
      {level >= 2 && <mesh position={[0, 0.35 + level * FLOOR_H + 0.6, 0]}><cylinderGeometry args={[0.04, 0.06, 1.2, 6]} /><meshLambertMaterial color={c.primary} emissive={c.emissive} emissiveIntensity={0.6} /></mesh>}
    </>
  );
}

function AnalysisBuildingStack({ c, level }) {
  if (level <= 0) return null;
  return (
    <>
      {Array.from({ length: level }, (_, i) => {
        const y = 0.35 + i * FLOOR_H;
        const r = 1.1 - i * 0.14; // stepped cylinders getting narrower
        return (
          <group key={i} position={[0, y, 0]}>
            <mesh><cylinderGeometry args={[r * 0.88, r, FLOOR_H * 0.72, 12]} /><meshLambertMaterial color={i % 2 === 0 ? c.dark : "#3d2060"} emissive={c.emissive} emissiveIntensity={0.1} /></mesh>
            {/* Glowing ring at each tier */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_H * 0.36, 0]}>
              <ringGeometry args={[r * 0.9, r + 0.08, 16]} />
              <meshBasicMaterial color={c.primary} transparent opacity={0.5} side={THREE.DoubleSide} />
            </mesh>
          </group>
        );
      })}
      {/* Crystal dome cap */}
      {level >= 2 && <mesh position={[0, 0.35 + level * FLOOR_H + 0.3, 0]}><sphereGeometry args={[0.5, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshBasicMaterial color={c.primary} transparent opacity={0.7} /></mesh>}
    </>
  );
}

function RiskBuildingStack({ c, level }) {
  if (level <= 0) return null;
  return (
    <>
      {Array.from({ length: level }, (_, i) => {
        const y = 0.35 + i * FLOOR_H;
        const w = 2.0 - i * 0.06; // wide squat bunker layers
        return (
          <group key={i} position={[0, y, 0]}>
            {/* Bunker wall */}
            <mesh><boxGeometry args={[w, FLOOR_H * 0.7, w]} /><meshLambertMaterial color={i % 2 === 0 ? c.dark : "#2a0808"} emissive={c.emissive} emissiveIntensity={0.1} /></mesh>
            {/* Warning stripe */}
            <mesh position={[0, -FLOOR_H * 0.28, w * 0.501]}><boxGeometry args={[w * 0.9, 0.12, 0.04]} /><meshBasicMaterial color={i % 2 === 0 ? "#FF4060" : "#FFD700"} /></mesh>
            {/* Parapet notches */}
            {[-0.55, 0, 0.55].map((ox, j) => (
              <mesh key={j} position={[ox, FLOOR_H * 0.42, 0]}>
                <boxGeometry args={[0.28, 0.26, w + 0.04]} />
                <meshLambertMaterial color={c.dark} />
              </mesh>
            ))}
          </group>
        );
      })}
      {/* Alert beacon on top */}
      {level >= 1 && <mesh position={[0, 0.35 + level * FLOOR_H + 0.3, 0]}><cylinderGeometry args={[0.22, 0.28, 0.5, 8]} /><meshBasicMaterial color="#FF4060" /></mesh>}
    </>
  );
}

function CategoryStack({ c, category, level }) {
  switch (category) {
    case "trading":  return <TradingBuildingStack  c={c} level={level} />;
    case "data":     return <DataBuildingStack      c={c} level={level} />;
    case "analysis": return <AnalysisBuildingStack  c={c} level={level} />;
    case "risk":     return <RiskBuildingStack      c={c} level={level} />;
    default:         return <BuildingStack          c={c} level={level} />;
  }
}

// ── Agent Building ────────────────────────────────────────────────────────────

function AgentBuilding({ agent, position, active, lastOutput, requests, selected, onClick, bubble, celebrating, battleTeam, isMine }) {
  const c          = cat(agent.category);
  const level      = Math.min(Math.floor(requests / 10), 4);
  const Char       = CHARS[agent.category] ?? DefaultChar;
  const stackH     = level * FLOOR_H;
  const teamColor  = battleTeam === "a" ? "#FF4D6D" : battleTeam === "b" ? "#4DA6FF" : null;

  // ── Reputation-driven visuals ────────────────────────────────────────────
  const rep        = Math.max(0, Math.min(agent.reputation ?? 5.0, 5));
  const repScale   = 0.76 + (rep / 5) * 0.48;   // 0.76 at 0★ → 1.24 at 5★
  const isLegend   = rep >= 4.8;                  // crown
  const isDegraded = rep < 2.0;                   // dim
  const repGlow    = isDegraded ? 0.04 : 0.08 + (rep / 5) * 0.22;
  const crownY     = 3.4 + stackH + level * 0.28;

  // ── Call-counter flash ref ───────────────────────────────────────────────
  const callCountRef = useRef(requests);
  callCountRef.current = requests;

  return (
    <group position={[position.x, 0, position.z]}
      onClick={(e) => { e.stopPropagation(); onClick(agent); }}>

      {/* Battle team highlight ring */}
      {teamColor && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[1.6, 2.2, 40]} />
          <meshBasicMaterial color={teamColor} transparent opacity={0.55} />
        </mesh>
      )}
      {/* isMine: purple ownership ring */}
      {isMine && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
          <ringGeometry args={[2.0, 2.7, 40]} />
          <meshBasicMaterial color="#a855f7" transparent opacity={0.6} />
        </mesh>
      )}
      {isMine && <pointLight position={[0, 4, 0]} intensity={2} color="#a855f7" distance={7} decay={2} />}

      {/* Degraded dim halo */}
      {isDegraded && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
          <circleGeometry args={[2.8, 32]} />
          <meshBasicMaterial color="#888888" transparent opacity={0.18} />
        </mesh>
      )}

      <District color={teamColor || c.primary} groundColor={c.ground} active={active || !!teamColor} />
      <LevelRings c={c} level={level} />

      {/* Reputation-scaled structural group */}
      <group scale={[repScale, repScale, repScale]}>
        <CategoryStack c={c} category={agent.category} level={level} />
        <DistrictExpansion level={level} agentId={agent.id} c={c} />
      </group>

      <AgentSwarm c={c} active={active} celebrating={celebrating} />

      {/* Activity indicator rings */}
      <BusyRing color={c.primary} active={active} />
      <ActiveBurst color={c.primary} active={active} baseY={1.2 + stackH} />

      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.24, 0]}>
          <ringGeometry args={[2.1, 2.45, 40]} />
          <meshBasicMaterial color={c.primary} transparent opacity={0.85} />
        </mesh>
      )}

      {/* Character sits on top of the tower stack */}
      <group position={[0, stackH, 0]}>
        <Char c={c} active={active} celebrating={celebrating} />
      </group>

      {/* Reputation crown — legends only */}
      {isLegend && <ReputationCrown color="#FFD700" y={crownY} />}

      <Beacon color={c.primary} h={2.5 + stackH + level * 0.4} active={active} />

      {/* Compact label — always visible */}
      <Billboard position={[0, 2.8 + stackH + level * 0.25, 0]} follow lockX={false} lockZ={false}>
        <Text fontSize={0.26} color={isDegraded ? "#aaaaaa" : c.primary} anchorX="center" outlineWidth={0.04} outlineColor="#ffffff">
          {agent.name.length > 14 ? agent.name.slice(0, 13) + "…" : agent.name}
        </Text>
        {/* Reputation stars (0–5) */}
        <Text fontSize={0.16} color={isLegend ? "#FFD700" : isDegraded ? "#666" : c.primary}
          anchorX="center" position={[0, -0.30, 0]} transparent opacity={0.85}>
          {"★".repeat(Math.round(rep))}{"☆".repeat(5 - Math.round(rep))}
        </Text>
        {/* Live call count badge when active */}
        {active && (
          <Text fontSize={0.20} color="#ffffff" anchorX="center" position={[0, -0.58, 0]}
            outlineWidth={0.04} outlineColor="#000000">
            ⚡ running
          </Text>
        )}
      </Billboard>

      {/* Selected label — full stats, only when this building is selected */}
      {selected && (
        <Billboard position={[0, 4.2 + stackH + level * 0.3, 0]} follow lockX={false} lockZ={false}>
          <Text fontSize={0.32} color={c.primary} anchorX="center" outlineWidth={0.05} outlineColor="#ffffff">
            {agent.name}
          </Text>
          {lastOutput && (
            <Text fontSize={0.17} color="#666" anchorX="center" position={[0, -0.38, 0]}>
              {Object.entries(lastOutput).filter(([k]) => k !== "market")
                .slice(0, 1).map(([k, v]) => `${k}: ${typeof v === "number" ? (v % 1 ? v.toFixed(2) : v) : String(v).toUpperCase()}`)[0] ?? ""}
            </Text>
          )}
        </Billboard>
      )}

      {bubble && (
        <group position={[0, 5.0 + stackH + level * 0.3, 0]}>
          <SpeechBubble text={bubble} color={c.primary} />
        </group>
      )}
    </group>
  );
}

// ── Plaza Notice Board ────────────────────────────────────────────────────────

function PlazaNoticeBoard({ events }) {
  return (
    <group position={[0, 0, -17]}>
      {/* Post */}
      <mesh position={[0, 1.9, 0]}>
        <cylinderGeometry args={[0.12, 0.16, 3.8, 7]} />
        <meshLambertMaterial color={TREE_TRUNK} />
      </mesh>
      {/* Board backing */}
      <mesh position={[0, 4.6, 0]}>
        <boxGeometry args={[5.6, 4.4, 0.22]} />
        <meshLambertMaterial color="#e8d5b0" />
      </mesh>
      {/* Board border */}
      <mesh position={[0, 4.6, 0.08]}>
        <boxGeometry args={[5.76, 4.56, 0.06]} />
        <meshLambertMaterial color={TREE_TRUNK} />
      </mesh>
      {/* Header stripe */}
      <mesh position={[0, 6.55, 0.14]}>
        <boxGeometry args={[5.4, 0.64, 0.06]} />
        <meshLambertMaterial color="#4DA6FF" />
      </mesh>
      <Billboard position={[0, 6.56, 0.22]} follow>
        <Text fontSize={0.36} color="#ffffff" anchorX="center" fontWeight={700}
          outlineWidth={0.02} outlineColor="#2255aa">AGENTVERSE BOARD</Text>
      </Billboard>

      {/* Event rows */}
      {events.length === 0 ? (
        <Billboard position={[0, 4.5, 0.2]} follow>
          <Text fontSize={0.24} color="#b8a880" anchorX="center">waiting for signals…</Text>
        </Billboard>
      ) : events.slice(0, 4).map((ev, i) => (
        <group key={ev.id}>
          {/* Card background */}
          <mesh position={[0, 5.9 - i * 0.88, 0.15]}>
            <boxGeometry args={[5.1, 0.72, 0.04]} />
            <meshLambertMaterial color={i === 0 ? "#fff8ee" : "#f5f0e8"} />
          </mesh>
          {/* Left color pip */}
          <mesh position={[-2.38, 5.9 - i * 0.88, 0.2]}>
            <boxGeometry args={[0.12, 0.56, 0.04]} />
            <meshBasicMaterial color={ev.color} />
          </mesh>
          <Billboard position={[-1.8, 5.96 - i * 0.88, 0.24]} follow>
            <Text fontSize={i === 0 ? 0.24 : 0.21} color={ev.color} anchorX="left" fontWeight={700}>{ev.agentName}</Text>
          </Billboard>
          <Billboard position={[-1.8, 5.72 - i * 0.88, 0.24]} follow>
            <Text fontSize={0.18} color="#666" anchorX="left">{ev.message}</Text>
          </Billboard>
        </group>
      ))}
    </group>
  );
}

// ── Central Plaza Reactor ─────────────────────────────────────────────────────

function Vortex() {
  const refs = useRef([]);
  const N    = 9;
  useFrame((s) => {
    refs.current.forEach((r, i) => {
      if (!r) return;
      const t     = (s.clock.elapsedTime * 0.75 + i / N) % 1;
      const angle = t * Math.PI * 5 + i * (Math.PI * 2 / N);
      const rad   = (1 - t) * 1.8;
      r.position.set(Math.cos(angle) * rad, 0.6 + t * 5.5, Math.sin(angle) * rad);
      r.material.opacity = Math.sin(t * Math.PI) * 0.8;
    });
  });
  return (
    <>
      {Array.from({ length: N }, (_, i) => (
        <mesh key={i} ref={el => { refs.current[i] = el; }}>
          <sphereGeometry args={[0.1, 5, 5]} />
          <meshBasicMaterial color={i % 2 === 0 ? "#4DA6FF" : "#6BCB77"} transparent opacity={0.8} />
        </mesh>
      ))}
    </>
  );
}

function AgentBeams({ positions, agents }) {
  const refs = useRef([]);
  useFrame((s) => {
    refs.current.forEach((r, i) => {
      if (r?.material) r.material.opacity = 0.06 + Math.sin(s.clock.elapsedTime * 0.5 + i * 0.9) * 0.03;
    });
  });
  return (
    <>
      {positions.map((p, i) => {
        const c = cat(agents[i]?.category);
        return (
          <group key={i} ref={el => { refs.current[i] = el; }}>
            <Line points={[[0, 1.8, 0], [p.x * 0.28, 3.5, p.z * 0.28]]}
              color={c.primary} lineWidth={0.9} transparent opacity={0.06} />
          </group>
        );
      })}
    </>
  );
}

function CentralPlaza({ agents, positions, worldEvent }) {
  const accentColor = worldEvent?.type === "volatile" ? "#FF6B6B"
    : worldEvent?.type === "storm"    ? "#4DA6FF"
    : worldEvent?.type === "overload" ? "#FFD166"
    : "#4DA6FF";

  const r1 = useRef(), r2 = useRef(), r3 = useRef(), r4 = useRef();
  const crystalRef = useRef(), beamRef = useRef(), pulseRef = useRef();

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (r1.current) r1.current.rotation.y += 0.007;
    if (r2.current) { r2.current.rotation.y -= 0.011; r2.current.rotation.x = Math.PI / 3 + Math.sin(t * 0.35) * 0.1; }
    if (r3.current) { r3.current.rotation.z += 0.005; r3.current.rotation.x = t * 0.03; }
    if (r4.current) { r4.current.rotation.y -= 0.016; r4.current.rotation.z = Math.PI / 4 + Math.sin(t * 0.28) * 0.13; }
    if (crystalRef.current) {
      crystalRef.current.rotation.y += 0.012;
      crystalRef.current.material.emissiveIntensity = 0.9 + Math.sin(t * 2.4) * 0.35;
    }
    if (beamRef.current) beamRef.current.material.opacity = 0.18 + Math.sin(t * 1.4) * 0.1;
    if (pulseRef.current) {
      const sc = 1 + ((t * 0.12) % 1) * 44;
      pulseRef.current.scale.setScalar(sc);
      pulseRef.current.material.opacity = (1 - ((t * 0.12) % 1)) * 0.08;
    }
  });

  return (
    <group>
      {/* Expanding ground pulse */}
      <mesh ref={pulseRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <ringGeometry args={[1, 1.6, 64]} />
        <meshBasicMaterial color={accentColor} transparent opacity={0.07} side={THREE.DoubleSide} />
      </mesh>

      {/* Decorative ground rings */}
      {[7.5, 5.8, 4.2, 2.8].map((r, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.07, 0]}>
          <ringGeometry args={[r - 0.25, r, 48]} />
          <meshBasicMaterial color={i % 2 === 0 ? "#c0d8f0" : "#d8eafc"} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* Monument base — 3 tiered stone steps */}
      <mesh position={[0, 0.14, 0]}><cylinderGeometry args={[3.4, 3.6, 0.28, 16]} /><meshLambertMaterial color="#d8e8f0" /></mesh>
      <mesh position={[0, 0.38, 0]}><cylinderGeometry args={[2.5, 2.7, 0.24, 16]} /><meshLambertMaterial color="#c8dce8" /></mesh>
      <mesh position={[0, 0.58, 0]}><cylinderGeometry args={[1.7, 1.9, 0.2,  16]} /><meshLambertMaterial color="#b8ccd8" /></mesh>

      {/* Obelisk shaft */}
      <mesh position={[0, 3.8, 0]}>
        <boxGeometry args={[0.72, 6.4, 0.72]} />
        <meshLambertMaterial color="#c4d8e8" emissive={accentColor} emissiveIntensity={0.18} />
      </mesh>
      {/* Obelisk taper */}
      <mesh position={[0, 7.2, 0]}>
        <boxGeometry args={[0.56, 1.2, 0.56]} />
        <meshLambertMaterial color="#b8ccd8" emissive={accentColor} emissiveIntensity={0.22} />
      </mesh>
      {/* Pyramid cap */}
      <mesh position={[0, 8.1, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[0.5, 1.0, 4]} />
        <meshLambertMaterial color="#a8c0cc" emissive={accentColor} emissiveIntensity={0.35} />
      </mesh>

      {/* Crystal orb at obelisk base */}
      <mesh ref={crystalRef} position={[0, 0.95, 0]}>
        <octahedronGeometry args={[0.55, 0]} />
        <meshLambertMaterial color="#e8f6ff" emissive={accentColor} emissiveIntensity={0.9} />
      </mesh>

      {/* Orbiting category rings */}
      <group ref={r1} position={[0, 2.8, 0]}>
        <mesh><torusGeometry args={[2.2, 0.07, 8, 52]} /><meshBasicMaterial color="#4DD9B8" /></mesh>
      </group>
      <group ref={r2} position={[0, 2.8, 0]}>
        <mesh rotation={[Math.PI / 3, 0, 0]}><torusGeometry args={[1.7, 0.06, 8, 42]} /><meshBasicMaterial color="#C8A0F8" /></mesh>
      </group>
      <group ref={r3} position={[0, 2.8, 0]}>
        <mesh rotation={[Math.PI / 6, Math.PI / 4, 0]}><torusGeometry args={[1.35, 0.05, 8, 34]} /><meshBasicMaterial color="#38C8F4" /></mesh>
      </group>
      <group ref={r4} position={[0, 2.8, 0]}>
        <mesh rotation={[Math.PI / 2, 0, Math.PI / 6]}><torusGeometry args={[2.9, 0.04, 6, 60]} /><meshBasicMaterial color="#FFD840" transparent opacity={0.5} /></mesh>
      </group>

      {/* Light beam upward */}
      <mesh ref={beamRef} position={[0, 14, 0]}>
        <cylinderGeometry args={[0.1, 0.22, 20, 6]} />
        <meshBasicMaterial color={accentColor} transparent opacity={0.18} />
      </mesh>

      {/* Corner fountain jets (4 water arcs around base) */}
      {[0, 1, 2, 3].map(i => {
        const a = (i / 4) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 2.8, 0.7, Math.sin(a) * 2.8]}
            rotation={[Math.cos(a) * 0.5 - 0.3, 0, Math.sin(a) * -0.5]}>
            <cylinderGeometry args={[0.05, 0.02, 0.9, 5]} />
            <meshBasicMaterial color="#a8d8f0" transparent opacity={0.65} />
          </mesh>
        );
      })}

      {/* Plaque */}
      <mesh position={[0, 0.75, 0.76]}>
        <boxGeometry args={[1.1, 0.38, 0.06]} />
        <meshLambertMaterial color="#b8c8d0" />
      </mesh>
      <Billboard position={[0, 0.75, 0.84]} follow>
        <Text fontSize={0.16} color="#2d5a7a" anchorX="center" fontWeight={800}>AGENTVERSE</Text>
      </Billboard>

      <Vortex />
      {agents.length > 0 && <AgentBeams positions={positions} agents={agents} />}

      <Billboard position={[0, 9.8, 0]} follow lockX={false} lockZ={false}>
        <Text fontSize={0.2} color={accentColor} anchorX="center" transparent opacity={0.8}>
          {agents.length} agents active
        </Text>
      </Billboard>

      <pointLight position={[0, 4, 0]} intensity={4} color={accentColor} distance={12} decay={2} />
    </group>
  );
}

// ── Scoreboard ────────────────────────────────────────────────────────────────

function ScoreBoard({ agents, metrics }) {
  const sorted = useMemo(() =>
    [...agents].sort((a, b) => (metrics[b.id]?.earnings || 0) - (metrics[a.id]?.earnings || 0)).slice(0, 5),
    [agents, metrics]
  );
  const MEDALS = ["1ST", "2ND", "3RD", "4TH", "5TH"];
  return (
    <group position={[-17, 0, 0]}>
      <mesh position={[0, 1.8, 0]}>
        <cylinderGeometry args={[0.1, 0.14, 3.6, 8]} />
        <meshLambertMaterial color={LAMP_POLE} />
      </mesh>
      <mesh position={[0, 4.5, 0]}>
        <boxGeometry args={[5.2, 4.2, 0.18]} />
        <meshLambertMaterial color="#f0ece4" />
      </mesh>
      <mesh position={[0, 4.5, 0.06]}>
        <boxGeometry args={[5.38, 4.38, 0.04]} />
        <meshBasicMaterial color="#4DA6FF" transparent opacity={0.35} />
      </mesh>
      <Billboard position={[0, 6.28, 0.18]} follow>
        <Text fontSize={0.38} color="#4DA6FF" anchorX="center" outlineWidth={0.03} outlineColor="#ffffff">TOP AGENTS</Text>
      </Billboard>
      <mesh position={[0, 5.92, 0.12]}>
        <boxGeometry args={[4.6, 0.04, 0.04]} /><meshBasicMaterial color="#4DA6FF" transparent opacity={0.4} />
      </mesh>
      {sorted.length === 0 ? (
        <Billboard position={[0, 4.5, 0.2]} follow>
          <Text fontSize={0.26} color="#aaa" anchorX="center">no data yet</Text>
        </Billboard>
      ) : sorted.map((a, i) => {
        const c = cat(a.category);
        return (
          <Billboard key={a.id} position={[0, 5.58 - i * 0.72, 0.18]} follow>
            <Text position={[-2.2, 0, 0]} fontSize={i === 0 ? 0.3 : 0.25} color={i === 0 ? "#FFD166" : "#aaa"} anchorX="left">{MEDALS[i]}</Text>
            <Text position={[-1.8, 0, 0]} fontSize={i === 0 ? 0.3 : 0.26} color={c.primary} anchorX="left">{a.name}</Text>
            <Text position={[1.8, 0.07, 0]} fontSize={0.22} color={i === 0 ? "#FFD166" : "#666"} anchorX="right">${metrics[a.id]?.earnings || 0}</Text>
            <Text position={[1.8, -0.2, 0]} fontSize={0.17} color="#aaa" anchorX="right">{metrics[a.id]?.requests || 0} calls</Text>
          </Billboard>
        );
      })}
    </group>
  );
}

// ── Confetti ──────────────────────────────────────────────────────────────────

const CONFETTI_COUNT  = 90;
const CONFETTI_COLS   = ["#FFD166", "#6BCB77", "#4DA6FF", "#BB8FCE", "#FF6B6B", "#F1C40F"];

function ConfettiSystem({ active }) {
  const ref   = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const parts = useMemo(() => Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
    x: (((i * 7.1) % 1) - 0.5) * 26, y: 9 + ((i * 3.7) % 1) * 8,
    z: (((i * 5.3) % 1) - 0.5) * 26,
    vy: -(1.4 + ((i * 2.9) % 1) * 1.8),
    rx: (i * 1.2) % (Math.PI * 2), rz: (i * 0.9) % (Math.PI * 2),
    vrx: ((i * 0.7) % 1 - 0.5) * 5, vrz: ((i * 0.4) % 1 - 0.5) * 5,
  })), []);
  useEffect(() => {
    const m = ref.current; if (!m) return;
    for (let i = 0; i < CONFETTI_COUNT; i++) m.setColorAt(i, new THREE.Color(CONFETTI_COLS[i % CONFETTI_COLS.length]));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    for (let i = 0; i < CONFETTI_COUNT; i++) { dummy.position.set(0, -100, 0); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); }
    m.instanceMatrix.needsUpdate = true;
  }, [dummy]);
  useFrame((_, dt) => {
    const m = ref.current; if (!m) return;
    parts.forEach((p, i) => {
      if (active) {
        p.y += p.vy * dt; p.rx += p.vrx * dt; p.rz += p.vrz * dt;
        if (p.y < -2) { p.y = 9 + Math.random() * 7; p.x = (Math.random() - 0.5) * 26; p.z = (Math.random() - 0.5) * 26; }
        dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(p.rx, 0, p.rz);
      } else { dummy.position.set(0, -100, 0); }
      dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[null, null, CONFETTI_COUNT]}>
      <boxGeometry args={[0.22, 0.22, 0.05]} /><meshBasicMaterial vertexColors />
    </instancedMesh>
  );
}

// ── Launch Fireworks ──────────────────────────────────────────────────────────

const FIREWORK_COUNT = 60;
const FW_COLORS = ["#BB8FCE", "#FFD700", "#FF6B6B", "#6BCF8B", "#4DA6FF", "#fff"];

function LaunchFireworks({ x = 0, z = 0 }) {
  const ref   = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const parts = useMemo(() => Array.from({ length: FIREWORK_COUNT }, (_, i) => {
    const angle = (i / FIREWORK_COUNT) * Math.PI * 2;
    const tilt  = ((i * 1.7) % 1) * Math.PI * 0.5;
    return {
      x, y: 2, z,
      vx: Math.cos(angle) * Math.sin(tilt) * (3 + (i * 0.3) % 2),
      vy: 4 + ((i * 2.1) % 1) * 4,
      vz: Math.sin(angle) * Math.sin(tilt) * (3 + (i * 0.3) % 2),
      life: 1, decay: 0.6 + ((i * 0.4) % 1) * 0.8,
    };
  }), [x, z]);

  useEffect(() => {
    const m = ref.current; if (!m) return;
    for (let i = 0; i < FIREWORK_COUNT; i++) m.setColorAt(i, new THREE.Color(FW_COLORS[i % FW_COLORS.length]));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, []);

  useFrame((_, dt) => {
    const m = ref.current; if (!m) return;
    parts.forEach((p, i) => {
      p.life -= p.decay * dt;
      if (p.life <= 0) { dummy.position.set(0, -200, 0); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); return; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.vy -= 5 * dt; // gravity
      dummy.position.set(p.x, p.y, p.z);
      const s = p.life * 0.35; dummy.scale.set(s, s, s);
      dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[null, null, FIREWORK_COUNT]}>
      <sphereGeometry args={[1, 4, 4]} /><meshBasicMaterial vertexColors />
    </instancedMesh>
  );
}

// ── Sky drones ────────────────────────────────────────────────────────────────

function Drone({ seed }) {
  const ref = useRef(), blink = useRef();
  const r = 13 + (seed * 3.7) % 10, h = 13 + (seed * 2.1) % 7;
  const spd = 0.055 + (seed * 0.011) % 0.08, ph = (seed * 1.57) % (Math.PI * 2);
  useFrame((s) => {
    if (!ref.current) return;
    const t = s.clock.elapsedTime * spd + ph;
    ref.current.position.set(Math.cos(t) * r, h + Math.sin(t * 0.4) * 1.2, Math.sin(t) * r);
    ref.current.rotation.y = -t + Math.PI;
    if (blink.current) blink.current.material.opacity = 0.4 + Math.sin(s.clock.elapsedTime * 3.5 + seed) * 0.4;
  });
  return (
    <group ref={ref}>
      <mesh><boxGeometry args={[0.6, 0.12, 0.85]} /><meshLambertMaterial color="#c8d8e8" /></mesh>
      <mesh position={[0.52, 0, 0]}><boxGeometry args={[0.55, 0.07, 0.22]} /><meshLambertMaterial color="#b0c4d8" /></mesh>
      <mesh position={[-0.52, 0, 0]}><boxGeometry args={[0.55, 0.07, 0.22]} /><meshLambertMaterial color="#b0c4d8" /></mesh>
      <mesh ref={blink} position={[0, 0.1, 0]}>
        <sphereGeometry args={[0.1, 6, 6]} /><meshBasicMaterial color="#4DA6FF" transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

// ── Data beams ────────────────────────────────────────────────────────────────

function DataBeam({ x, z, color }) {
  const refs = useRef([]), N = 10;
  const prog = useRef(Array.from({ length: N }, (_, i) => i / N));
  useFrame((_, dt) => {
    prog.current = prog.current.map((p, i) => {
      const next = (p + dt * (0.5 + i * 0.04)) % 1;
      const m    = refs.current[i];
      if (m) { m.position.y = 18 - next * 18; m.material.opacity = Math.sin(next * Math.PI) * 0.55; }
      return next;
    });
  });
  return (
    <>
      <Line points={[[x, 1, z], [x, 18, z]]} color={color} lineWidth={0.5} transparent opacity={0.08} />
      {Array.from({ length: N }, (_, i) => (
        <mesh key={i} ref={el => { refs.current[i] = el; }} position={[x, 9, z]}>
          <boxGeometry args={[0.13, 0.13, 0.13]} /><meshBasicMaterial color={color} transparent opacity={0.55} />
        </mesh>
      ))}
    </>
  );
}

// ── Signal streams ─────────────────────────────────────────────────────────────

const STREAM_N = 8;
function SignalStream({ from, to, color }) {
  const pts = useMemo(() => {
    const a = new THREE.Vector3(from[0], 1.4, from[2]);
    const b = new THREE.Vector3(to[0], 1.4, to[2]);
    const m = a.clone().lerp(b, 0.5); m.y = a.distanceTo(b) * 0.38 + 2;
    return new THREE.QuadraticBezierCurve3(a, m, b).getPoints(60);
  }, [from, to]);
  const refs = useRef([]), head = useRef(), prog = useRef(Math.random());
  useFrame((_, dt) => {
    prog.current = (prog.current + dt * 0.55) % 1;
    for (let i = 0; i < STREAM_N; i++) {
      const mesh = refs.current[i]; if (!mesh) continue;
      const t = (prog.current + i / STREAM_N) % 1;
      const p = pts[Math.min(Math.floor(t * (pts.length - 1)), pts.length - 1)];
      mesh.position.set(p.x, p.y, p.z);
      mesh.material.opacity = Math.sin(t * Math.PI) * 0.9;
      mesh.scale.setScalar(1 - (i / STREAM_N) * 0.6);
    }
    if (refs.current[0] && head.current) head.current.position.copy(refs.current[0].position);
  });
  const linePts = useMemo(() => pts.map(p => [p.x, p.y, p.z]), [pts]);
  return (
    <>
      <Line points={linePts} color={color} lineWidth={3.0} transparent opacity={0.7} />
      {Array.from({ length: STREAM_N }, (_, i) => (
        <mesh key={i} ref={el => { refs.current[i] = el; }}>
          <sphereGeometry args={[0.26, 7, 7]} /><meshBasicMaterial color={color} transparent opacity={0.9} />
        </mesh>
      ))}
      <mesh ref={head}><sphereGeometry args={[0.5, 8, 8]} /><meshBasicMaterial color={color} transparent opacity={0.2} /></mesh>
    </>
  );
}

function IdleArc({ from, to, color }) {
  const pts = useMemo(() => {
    const a = new THREE.Vector3(from[0], 1.4, from[2]);
    const b = new THREE.Vector3(to[0], 1.4, to[2]);
    const m = a.clone().lerp(b, 0.5); m.y = a.distanceTo(b) * 0.38 + 2;
    return new THREE.QuadraticBezierCurve3(a, m, b).getPoints(32).map(p => [p.x, p.y, p.z]);
  }, [from, to]);
  return <Line points={pts} color={color} lineWidth={0.5} transparent opacity={0.12} />;
}

// ── Pipeline highway (heat = usage count, brightens with more runs) ───────────

function PipelineHighway({ from, to, color, heat = 1 }) {
  const pts = useMemo(() => {
    const a = new THREE.Vector3(from[0], 1.6, from[2]);
    const b = new THREE.Vector3(to[0], 1.6, to[2]);
    const m = a.clone().lerp(b, 0.5); m.y = a.distanceTo(b) * 0.4 + 2.5;
    return new THREE.QuadraticBezierCurve3(a, m, b).getPoints(48);
  }, [from, to]);

  const h         = Math.min(heat / 6, 1);         // 0–1 normalised
  const dotCount  = 1 + Math.floor(h * 4);          // 1–5 travelling dots
  const lineW     = 1.4 + h * 3.2;                  // thicker with heat
  const lineOp    = 0.28 + h * 0.55;                // brighter with heat
  const dotR      = 0.18 + h * 0.14;

  const progs = useRef(Array.from({ length: 5 }, (_, i) => i / 5));
  const dotRefs = useRef([]);
  useFrame((_, dt) => {
    progs.current = progs.current.map((p, i) => {
      const next = (p + dt * (0.28 + h * 0.22)) % 1;
      const m = dotRefs.current[i];
      if (m) {
        if (i < dotCount) {
          const pt = pts[Math.min(Math.floor(next * (pts.length - 1)), pts.length - 1)];
          m.position.set(pt.x, pt.y, pt.z);
          m.material.opacity = Math.sin(next * Math.PI) * (0.7 + h * 0.25);
          m.visible = true;
        } else {
          m.visible = false;
        }
      }
      return next;
    });
  });
  const linePts = useMemo(() => pts.map(p => [p.x, p.y, p.z]), [pts]);
  return (
    <>
      <Line points={linePts} color={color} lineWidth={lineW} transparent opacity={lineOp} />
      {/* Heat shimmer — extra glow line for hot routes */}
      {h > 0.5 && <Line points={linePts} color="#ffffff" lineWidth={lineW * 0.3} transparent opacity={h * 0.18} />}
      {Array.from({ length: 5 }, (_, i) => (
        <mesh key={i} ref={el => { dotRefs.current[i] = el; }}>
          <sphereGeometry args={[dotR, 6, 6]} />
          <meshBasicMaterial color={i === 0 && h > 0.7 ? "#ffffff" : color} transparent opacity={0.8} />
        </mesh>
      ))}
    </>
  );
}

// ── Floating rewards ──────────────────────────────────────────────────────────

function FloatingReward({ x, z, text, color }) {
  const ref = useRef(), t0 = useRef(null);
  useFrame((s) => {
    if (!ref.current) return;
    if (!t0.current) t0.current = s.clock.elapsedTime;
    ref.current.position.y = 6.5 + (s.clock.elapsedTime - t0.current) * 2.4;
  });
  return (
    <group ref={ref} position={[x, 6.5, z]}>
      <Billboard follow lockX={false} lockZ={false}>
        <Text fontSize={0.48} color={color} anchorX="center" outlineWidth={0.06} outlineColor="#ffffff">{text}</Text>
      </Billboard>
    </group>
  );
}

// ── Crowd Reaction Beam ───────────────────────────────────────────────────────

function ReactionBeam({ x, z, color }) {
  const beamRef  = useRef();
  const ring1Ref = useRef();
  const ring2Ref = useRef();
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (beamRef.current)  beamRef.current.material.opacity  = 0.38 + Math.sin(t * 5.2) * 0.22;
    if (ring1Ref.current) { ring1Ref.current.scale.setScalar(1 + ((t * 0.8) % 1) * 14); ring1Ref.current.material.opacity = (1 - (t * 0.8) % 1) * 0.5; }
    if (ring2Ref.current) { ring2Ref.current.scale.setScalar(1 + ((t * 0.8 + 0.5) % 1) * 14); ring2Ref.current.material.opacity = (1 - (t * 0.8 + 0.5) % 1) * 0.5; }
  });
  return (
    <group position={[x, 0, z]}>
      <mesh ref={beamRef} position={[0, 11, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 22, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.45} />
      </mesh>
      <mesh ref={ring1Ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.2, 0]}>
        <ringGeometry args={[1, 1.5, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={ring2Ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.2, 0]}>
        <ringGeometry args={[1, 1.5, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// ── Market pulse ──────────────────────────────────────────────────────────────

function PulseRing({ phase, speed, color }) {
  const ref = useRef();
  useFrame((s) => {
    if (!ref.current) return;
    const t = ((s.clock.elapsedTime * speed + phase) % 1);
    ref.current.scale.setScalar(1 + t * 42);
    ref.current.material.opacity = (1 - t) * 0.1;
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
      <ringGeometry args={[1, 1.5, 64]} />
      <meshBasicMaterial color={color} transparent opacity={0.08} side={THREE.DoubleSide} />
    </mesh>
  );
}

function MarketPulse({ active }) {
  const spd = active ? 0.28 : 0.07;
  return (
    <>
      <PulseRing phase={0}    speed={spd} color="#4DA6FF" />
      <PulseRing phase={0.33} speed={spd} color="#6BCB77" />
      <PulseRing phase={0.66} speed={spd} color="#4DA6FF" />
    </>
  );
}

// ── Camera ────────────────────────────────────────────────────────────────────

function CameraDirector({ target, mapMode, spectatorTargets, spectatorMode }) {
  const { camera } = useThree();
  const ctrl         = useRef();
  const camDst       = useRef(null);
  const lookDst      = useRef(null);
  const spectIdx     = useRef(0);
  const spectTimer   = useRef(0);
  const SPECT_DWELL  = 5; // seconds per POI

  useEffect(() => {
    if (mapMode) {
      camDst.current  = new THREE.Vector3(0, 80, 0.1);
      lookDst.current = new THREE.Vector3(0, 0, 0);
    } else if (!spectatorMode) {
      camDst.current  = new THREE.Vector3(18, 16, 20);
      lookDst.current = new THREE.Vector3(0, 0, 0);
    }
  }, [mapMode, spectatorMode]);

  useEffect(() => {
    if (!target || mapMode || spectatorMode) return;
    if (target.type === "district") {
      camDst.current  = new THREE.Vector3(target.x + 14, 20, target.z + 14);
      lookDst.current = new THREE.Vector3(target.x, 0, target.z);
    } else {
      camDst.current  = new THREE.Vector3(target.x + 11, 10, target.z + 9);
      lookDst.current = new THREE.Vector3(target.x, 2, target.z);
    }
  }, [target, mapMode, spectatorMode]);

  useFrame((_, delta) => {
    // Spectator: auto-cycle through POIs
    if (spectatorMode && spectatorTargets?.length) {
      spectTimer.current += delta;
      if (spectTimer.current >= SPECT_DWELL || !camDst.current) {
        spectTimer.current = 0;
        const poi = spectatorTargets[spectIdx.current % spectatorTargets.length];
        spectIdx.current++;
        // Vary angle each shot
        const ang    = (spectIdx.current * 1.9) % (Math.PI * 2);
        const dist   = 10 + Math.random() * 6;
        const height = 7 + Math.random() * 8;
        camDst.current  = new THREE.Vector3(
          poi.x + Math.cos(ang) * dist, height, poi.z + Math.sin(ang) * dist
        );
        lookDst.current = new THREE.Vector3(poi.x, 2, poi.z);
      }
    }
    if (!camDst.current) return;
    const lerpSpeed = spectatorMode ? 0.025 : 0.04;
    camera.position.lerp(camDst.current, lerpSpeed);
    if (ctrl.current && lookDst.current) { ctrl.current.target.lerp(lookDst.current, 0.05); ctrl.current.update(); }
    if (!spectatorMode && camera.position.distanceTo(camDst.current) < 0.8) camDst.current = null;
  });

  return (
    <OrbitControls ref={ctrl} enableDamping dampingFactor={0.08}
      enabled={!spectatorMode}
      minDistance={5} maxDistance={220} maxPolarAngle={mapMode ? Math.PI : Math.PI / 2.2} />
  );
}

// ── Shop District ─────────────────────────────────────────────────────────────

function ShopBuilding({ category, position, onClick, agentCount }) {
  const c          = cat(category);
  const faceAngle  = Math.atan2(-position.x, -position.z); // always face center
  const glowRef    = useRef();
  useFrame((s) => {
    if (!glowRef.current) return;
    glowRef.current.intensity = 1.6 + Math.sin(s.clock.elapsedTime * 1.4) * 0.4;
  });
  return (
    <group position={[position.x, 0, position.z]} rotation={[0, faceAngle, 0]}
      onClick={(e) => { e.stopPropagation(); onClick(category); }}>
      {/* Base */}
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[3.5, 3.7, 0.24, 6]} />
        <meshLambertMaterial color={c.ground} />
      </mesh>
      {/* Steps */}
      <mesh position={[0, 0.25, 2.1]}>
        <boxGeometry args={[2.2, 0.26, 0.9]} />
        <meshLambertMaterial color={c.ground} />
      </mesh>
      {/* Main body */}
      <mesh position={[0, 1.9, 0]}>
        <boxGeometry args={[4.4, 3.8, 4.0]} />
        <meshLambertMaterial color={c.ground} />
      </mesh>
      {/* Front face accent overlay */}
      <mesh position={[0, 1.9, 2.02]}>
        <planeGeometry args={[4.4, 3.8]} />
        <meshBasicMaterial color={c.primary} transparent opacity={0.16} side={THREE.DoubleSide} />
      </mesh>
      {/* Pitched roof */}
      <mesh position={[0, 4.1, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[3.4, 2.2, 4]} />
        <meshLambertMaterial color={c.dark} />
      </mesh>
      {/* Awning */}
      <mesh position={[0, 3.0, 2.45]} rotation={[Math.PI / 5.5, 0, 0]}>
        <boxGeometry args={[4.2, 0.14, 1.6]} />
        <meshLambertMaterial color={c.primary} />
      </mesh>
      {/* Awning stripe */}
      <mesh position={[0, 2.68, 3.04]} rotation={[Math.PI / 5.5, 0, 0]}>
        <boxGeometry args={[4.2, 0.1, 0.12]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      {/* Door */}
      <mesh position={[0, 1.05, 2.03]}>
        <boxGeometry args={[1.0, 2.1, 0.09]} />
        <meshLambertMaterial color={c.dark} />
      </mesh>
      {/* Door knob */}
      <mesh position={[0.43, 1.0, 2.08]}>
        <sphereGeometry args={[0.08, 6, 6]} />
        <meshBasicMaterial color="#FFD166" />
      </mesh>
      {/* Windows */}
      {[-1.5, 1.5].map((wx, i) => (
        <group key={i} position={[wx, 2.1, 2.03]}>
          <mesh><boxGeometry args={[1.1, 0.95, 0.09]} /><meshBasicMaterial color={c.primary} transparent opacity={0.6} /></mesh>
          <mesh position={[0, 0, 0.06]}><boxGeometry args={[1.1, 0.07, 0.05]} /><meshBasicMaterial color={c.dark} transparent opacity={0.45} /></mesh>
          <mesh position={[0, 0, 0.06]}><boxGeometry args={[0.07, 0.95, 0.05]} /><meshBasicMaterial color={c.dark} transparent opacity={0.45} /></mesh>
        </group>
      ))}
      {/* Sign board */}
      <mesh position={[0, 5.6, 0]}><boxGeometry args={[4.6, 1.1, 0.32]} /><meshLambertMaterial color={c.dark} /></mesh>
      <mesh position={[0, 5.6, 0.12]}><boxGeometry args={[4.4, 0.92, 0.18]} /><meshLambertMaterial color="#f5f0e8" /></mesh>
      <Billboard position={[0, 5.6, 0.28]} follow>
        <Text fontSize={0.36} color={c.dark} anchorX="center">
          {CAT[category]?.label ?? category} Shop
        </Text>
        <Text fontSize={0.19} color={c.primary} anchorX="center" position={[0, -0.43, 0]}>
          {agentCount} agent{agentCount !== 1 ? "s" : ""} inside
        </Text>
      </Billboard>
      {/* Ambient shop light */}
      <pointLight ref={glowRef} position={[0, 3.2, 2.4]} intensity={1.8} color={c.primary} distance={9} decay={2} />
    </group>
  );
}

function ShopDistrict({ agents, onShopClick }) {
  const countByCategory = useMemo(() => {
    const m = {};
    agents.forEach(a => { m[a.category] = (m[a.category] || 0) + 1; });
    return m;
  }, [agents]);
  return (
    <>
      {Object.entries(SHOP_POSITIONS).map(([category, pos]) => (
        <ShopBuilding key={category} category={category} position={pos}
          onClick={onShopClick} agentCount={countByCategory[category] || 0} />
      ))}
    </>
  );
}

// ── District Marker ───────────────────────────────────────────────────────────

function DistrictMarker({ category, position, onClick }) {
  const c      = cat(category);
  const rimRef = useRef();
  useFrame((s) => {
    if (rimRef.current)
      rimRef.current.material.opacity = 0.14 + Math.sin(s.clock.elapsedTime * 1.1) * 0.06;
  });
  const label = (CAT[category]?.label ?? category).toUpperCase() + " DISTRICT";
  return (
    <group position={[position.x, 0, position.z]}
      onClick={(e) => { e.stopPropagation(); onClick?.(category); }}>
      <mesh ref={rimRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.09, 0]}>
        <ringGeometry args={[7, 8.2, 48]} />
        <meshBasicMaterial color={c.primary} transparent opacity={0.14} side={THREE.DoubleSide} />
      </mesh>
      <Billboard position={[0, 5.8, 0]} follow lockX={false} lockZ={false}>
        <Text fontSize={0.3} color={c.primary} anchorX="center"
          outlineWidth={0.04} outlineColor="#ffffff">{label}</Text>
      </Billboard>
    </group>
  );
}

// ── Sub-District Marker (Level 3) ─────────────────────────────────────────────

function SubDistrictMarker({ label, position, color }) {
  const rimRef = useRef();
  useFrame((s) => {
    if (rimRef.current)
      rimRef.current.material.opacity = 0.08 + Math.sin(s.clock.elapsedTime * 2.1 + position.x * 0.3) * 0.04;
  });
  return (
    <group position={[position.x, 0, position.z]}>
      <mesh ref={rimRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.09, 0]}>
        <ringGeometry args={[5.8, 6.8, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.08} side={THREE.DoubleSide} />
      </mesh>
      <Billboard position={[0, 3.8, 0]} follow lockX={false} lockZ={false}>
        <Text fontSize={0.2} color={color} anchorX="center"
          outlineWidth={0.03} outlineColor="#ffffff">{label.toUpperCase()}</Text>
      </Billboard>
    </group>
  );
}

// ── Marketplace Trending Board ─────────────────────────────────────────────────

function MarketplaceTrendingBoard({ agents, metrics }) {
  const top3 = useMemo(() =>
    [...agents].sort((a, b) => (metrics[b.id]?.requests || 0) - (metrics[a.id]?.requests || 0)).slice(0, 3),
    [agents, metrics]
  );
  const MEDALS = ["1ST", "2ND", "3RD"];
  return (
    <group position={[28, 0, -28]}>
      {/* Post */}
      <mesh position={[0, 2.2, 0]}><cylinderGeometry args={[0.12, 0.16, 4.4, 7]} /><meshLambertMaterial color={TREE_TRUNK} /></mesh>
      {/* Board backing */}
      <mesh position={[0, 5.4, 0]}><boxGeometry args={[5.8, 4.4, 0.22]} /><meshLambertMaterial color="#e8d5b0" /></mesh>
      <mesh position={[0, 5.4, 0.08]}><boxGeometry args={[5.96, 4.56, 0.06]} /><meshLambertMaterial color={TREE_TRUNK} /></mesh>
      {/* Header stripe */}
      <mesh position={[0, 7.28, 0.14]}><boxGeometry args={[5.6, 0.64, 0.06]} /><meshLambertMaterial color="#FFD166" /></mesh>
      <Billboard position={[0, 7.28, 0.23]} follow>
        <Text fontSize={0.34} color="#333" anchorX="center">TRENDING AGENTS</Text>
      </Billboard>
      {/* Rows */}
      {top3.length === 0 ? (
        <Billboard position={[0, 5.4, 0.2]} follow>
          <Text fontSize={0.22} color="#b8a880" anchorX="center">no activity yet</Text>
        </Billboard>
      ) : top3.map((a, i) => {
        const c = cat(a.category);
        return (
          <group key={a.id}>
            <mesh position={[0, 6.72 - i * 0.88, 0.14]}><boxGeometry args={[5.4, 0.72, 0.04]} /><meshLambertMaterial color={i === 0 ? "#fff8ee" : "#f5f0e8"} /></mesh>
            <mesh position={[-2.55, 6.72 - i * 0.88, 0.19]}><boxGeometry args={[0.12, 0.56, 0.04]} /><meshBasicMaterial color={c.primary} /></mesh>
            <Billboard position={[-1.95, 6.78 - i * 0.88, 0.24]} follow>
              <Text fontSize={i === 0 ? 0.26 : 0.22} color={i === 0 ? "#FFD166" : "#aaa"} anchorX="left">{MEDALS[i]}</Text>
            </Billboard>
            <Billboard position={[-1.35, 6.78 - i * 0.88, 0.24]} follow>
              <Text fontSize={i === 0 ? 0.26 : 0.22} color={c.primary} anchorX="left">{a.name}</Text>
            </Billboard>
            <Billboard position={[2.4, 6.78 - i * 0.88, 0.24]} follow>
              <Text fontSize={0.19} color="#888" anchorX="right">{metrics[a.id]?.requests || 0} calls</Text>
            </Billboard>
          </group>
        );
      })}
    </group>
  );
}

// ── District identity: unique floor tiles per district ────────────────────────

const DISTRICT_IDENTITY = {
  trading: {
    tileLight: "#0e2235", tileDark: "#091929", accent: "#FFD700",
    label: "TRADING DISTRICT", floorAccent: "#FFD70022",
  },
  data: {
    tileLight: "#07202e", tileDark: "#041520", accent: "#00EEFF",
    label: "DATA DISTRICT", floorAccent: "#00EEFF22",
  },
  analysis: {
    tileLight: "#e8e0f8", tileDark: "#d4c8f0", accent: "#B59CE6",
    label: "ANALYSIS DISTRICT", floorAccent: "#B59CE622",
  },
  risk: {
    tileLight: "#2e0c0c", tileDark: "#1c0606", accent: "#FF8096",
    label: "RISK DISTRICT", floorAccent: "#FF809622",
  },
};

function DistrictFloorPatch({ category, cx, cz }) {
  const di = DISTRICT_IDENTITY[category];
  if (!di) return null;
  const dummy  = useMemo(() => new THREE.Object3D(), []);
  const refL   = useRef();
  const refD   = useRef();
  const radius = 11;
  const [light, dark] = useMemo(() => {
    const l = [], d = [];
    const half = Math.ceil(radius / BSIZE);
    for (let xi = -half; xi <= half; xi++) {
      for (let zi = -half; zi <= half; zi++) {
        const lx = xi * BSIZE, lz = zi * BSIZE;
        if (lx * lx + lz * lz > radius * radius) continue;
        ((xi + zi) % 2 === 0 ? l : d).push({ x: cx + lx, z: cz + lz });
      }
    }
    return [l, d];
  }, [cx, cz]);
  useEffect(() => {
    [[refL, light], [refD, dark]].forEach(([ref, tiles]) => {
      const m = ref.current; if (!m) return;
      tiles.forEach((t, i) => {
        dummy.position.set(t.x, 0.03, t.z);
        dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix);
      });
      m.instanceMatrix.needsUpdate = true;
    });
  }, [light, dark, dummy]);
  const tw = BSIZE - 0.14;
  return (
    <>
      {/* Glow disc under district */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.01, cz]}>
        <circleGeometry args={[radius + 1, 48]} />
        <meshBasicMaterial color={di.accent} transparent opacity={0.07} />
      </mesh>
      {light.length > 0 && (
        <instancedMesh ref={refL} args={[null, null, light.length]}>
          <boxGeometry args={[tw, 0.07, tw]} />
          <meshLambertMaterial color={di.tileLight} />
        </instancedMesh>
      )}
      {dark.length > 0 && (
        <instancedMesh ref={refD} args={[null, null, dark.length]}>
          <boxGeometry args={[tw, 0.07, tw]} />
          <meshLambertMaterial color={di.tileDark} />
        </instancedMesh>
      )}
    </>
  );
}

// ── District landmark buildings (one unique structure per district) ────────────

function TradingLandmark({ cx, cz }) {
  const spinRef = useRef();
  useFrame((s) => { if (spinRef.current) spinRef.current.rotation.y = s.clock.elapsedTime * 0.4; });
  return (
    <group position={[cx - 6, 0, cz + 6]}>
      {/* Base plinth */}
      <mesh position={[0, 0.2, 0]}><boxGeometry args={[2.4, 0.4, 2.4]} /><meshLambertMaterial color="#0e2235" /></mesh>
      {/* Tower body */}
      <mesh position={[0, 2.8, 0]}><boxGeometry args={[1.5, 5.2, 1.5]} /><meshLambertMaterial color="#0a1a2a" /></mesh>
      {/* Gold band */}
      <mesh position={[0, 5.45, 0]}><boxGeometry args={[1.62, 0.22, 1.62]} /><meshBasicMaterial color="#FFD700" /></mesh>
      {/* Spire */}
      <mesh position={[0, 6.9, 0]}><coneGeometry args={[0.5, 2.8, 4]} /><meshBasicMaterial color="#FFD700" /></mesh>
      {/* Glowing ticker strip */}
      <mesh position={[0, 1.9, 0.77]}><boxGeometry args={[1.48, 0.18, 0.04]} /><meshBasicMaterial color="#00FF88" /></mesh>
      <mesh position={[0, 2.3, 0.77]}><boxGeometry args={[1.48, 0.12, 0.04]} /><meshBasicMaterial color="#FFD700" /></mesh>
      {/* Rotating ring */}
      <group ref={spinRef} position={[0, 5.5, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[1.1, 0.07, 8, 24]} /><meshBasicMaterial color="#FFD700" /></mesh>
      </group>
      <pointLight position={[0, 5, 0]} intensity={2.5} color="#FFD700" distance={8} decay={2} />
    </group>
  );
}

function DataLandmark({ cx, cz }) {
  const pulseRef = useRef();
  useFrame((s) => {
    if (pulseRef.current) pulseRef.current.material.opacity = 0.5 + Math.sin(s.clock.elapsedTime * 2.2) * 0.3;
  });
  return (
    <group position={[cx + 6, 0, cz - 5]}>
      {/* Server block cluster */}
      {[-0.9, 0, 0.9].map((ox, i) => (
        <group key={i} position={[ox, 0, 0]}>
          <mesh position={[0, 0.9, 0]}><boxGeometry args={[0.7, 1.8, 1.2]} /><meshLambertMaterial color="#041520" /></mesh>
          <mesh position={[0, 0.9, 0.62]}><boxGeometry args={[0.68, 1.76, 0.04]} /><meshBasicMaterial color="#00EEFF" transparent opacity={0.4} /></mesh>
          {[0.4, 0.8, 1.2, 1.6].map((oy, j) => (
            <mesh key={j} position={[0, oy, 0.64]}><boxGeometry args={[0.5, 0.06, 0.02]} /><meshBasicMaterial color={j % 2 === 0 ? "#00EEFF" : "#0088BB"} /></mesh>
          ))}
        </group>
      ))}
      {/* Antenna */}
      <mesh position={[0, 4.8, 0]}><cylinderGeometry args={[0.06, 0.09, 5.2, 6]} /><meshLambertMaterial color="#1a3040" /></mesh>
      <mesh ref={pulseRef} position={[0, 7.5, 0]}><sphereGeometry args={[0.22, 8, 8]} /><meshBasicMaterial color="#00EEFF" transparent opacity={0.8} /></mesh>
      {[1.8, 3.0, 4.2].map((oy, i) => (
        <mesh key={i} position={[0, oy, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.55 - i * 0.06, 0.04, 6, 16]} />
          <meshBasicMaterial color="#00EEFF" transparent opacity={0.5 - i * 0.1} />
        </mesh>
      ))}
      <pointLight position={[0, 5, 0]} intensity={2.0} color="#00EEFF" distance={7} decay={2} />
    </group>
  );
}

function AnalysisLandmark({ cx, cz }) {
  const floatRef = useRef();
  useFrame((s) => {
    if (floatRef.current) floatRef.current.position.y = 4.8 + Math.sin(s.clock.elapsedTime * 0.9) * 0.3;
  });
  return (
    <group position={[cx - 5, 0, cz - 6]}>
      {/* Observatory base */}
      <mesh position={[0, 0.3, 0]}><cylinderGeometry args={[2.2, 2.4, 0.6, 16]} /><meshLambertMaterial color="#d4c8f0" /></mesh>
      {/* Dome */}
      <mesh position={[0, 1.8, 0]}><sphereGeometry args={[2.0, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshLambertMaterial color="#e8e0f8" /></mesh>
      {/* Dome ring */}
      <mesh position={[0, 0.65, 0]} rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[2.05, 0.12, 8, 32]} /><meshBasicMaterial color="#B59CE6" /></mesh>
      {/* Floating analysis orb */}
      <group ref={floatRef} position={[0, 4.8, 0]}>
        <mesh><sphereGeometry args={[0.55, 12, 10]} /><meshBasicMaterial color="#B59CE6" transparent opacity={0.85} /></mesh>
        <mesh rotation={[0.4, 0, 0.3]}><torusGeometry args={[0.85, 0.04, 8, 24]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.6} /></mesh>
        <mesh rotation={[-0.4, 0.6, 0]}><torusGeometry args={[0.85, 0.04, 8, 24]} /><meshBasicMaterial color="#B59CE6" transparent opacity={0.5} /></mesh>
      </group>
      <pointLight position={[0, 4, 0]} intensity={1.8} color="#B59CE6" distance={7} decay={2} />
    </group>
  );
}

function RiskLandmark({ cx, cz }) {
  const spinRef  = useRef();
  const flashRef = useRef();
  useFrame((s) => {
    if (spinRef.current)  spinRef.current.rotation.y  = s.clock.elapsedTime * 1.2;
    if (flashRef.current) flashRef.current.material.opacity = 0.3 + Math.abs(Math.sin(s.clock.elapsedTime * 2.8)) * 0.7;
  });
  return (
    <group position={[cx + 5, 0, cz + 6]}>
      {/* Warning pillar — black + red stripes */}
      {[0, 0.6, 1.2, 1.8, 2.4, 3.0, 3.6].map((oy, i) => (
        <mesh key={i} position={[0, oy + 0.3, 0]}><cylinderGeometry args={[0.52, 0.52, 0.58, 8]} /><meshLambertMaterial color={i % 2 === 0 ? "#1c0606" : "#FF8096"} /></mesh>
      ))}
      {/* Rotating warning ring */}
      <group ref={spinRef} position={[0, 4.4, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[1.3, 0.1, 8, 24]} /><meshBasicMaterial color="#FF8096" /></mesh>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} position={[Math.cos(i * Math.PI / 2) * 1.3, 0, Math.sin(i * Math.PI / 2) * 1.3]}>
            <boxGeometry args={[0.2, 0.35, 0.2]} />
            <meshBasicMaterial color="#FF4060" />
          </mesh>
        ))}
      </group>
      {/* Alert beacon */}
      <mesh ref={flashRef} position={[0, 5.4, 0]}><sphereGeometry args={[0.4, 10, 8]} /><meshBasicMaterial color="#FF4060" transparent opacity={0.9} /></mesh>
      <pointLight position={[0, 5, 0]} intensity={3.0} color="#FF4060" distance={9} decay={2} />
    </group>
  );
}

// ── Portal gate at each district entrance ─────────────────────────────────────

const PORTAL_GATES = [
  { category: "trading",  x: -12, z:   0, ry: Math.PI / 2 },
  { category: "data",     x:  12, z:   0, ry: Math.PI / 2 },
  { category: "analysis", x:   0, z: -12, ry: 0 },
  { category: "risk",     x:   0, z:  12, ry: 0 },
];

function PortalGate({ category, x, z, ry }) {
  const c       = cat(category);
  const di      = DISTRICT_IDENTITY[category] || {};
  const glowRef = useRef();
  useFrame((s) => {
    if (glowRef.current) glowRef.current.material.opacity = 0.35 + Math.sin(s.clock.elapsedTime * 1.8 + x) * 0.2;
  });
  return (
    <group position={[x, 0, z]} rotation={[0, ry, 0]}>
      {/* Left post */}
      <mesh position={[-1.9, 1.8, 0]}><cylinderGeometry args={[0.18, 0.22, 3.6, 7]} /><meshLambertMaterial color={di.tileDark || "#333"} /></mesh>
      {/* Right post */}
      <mesh position={[ 1.9, 1.8, 0]}><cylinderGeometry args={[0.18, 0.22, 3.6, 7]} /><meshLambertMaterial color={di.tileDark || "#333"} /></mesh>
      {/* Top arch bar */}
      <mesh position={[0, 3.72, 0]}><boxGeometry args={[4.0, 0.32, 0.32]} /><meshLambertMaterial color={di.tileDark || "#333"} /></mesh>
      {/* Glow arch ring */}
      <mesh ref={glowRef} position={[0, 2.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.1, 0.12, 10, 32, Math.PI]} />
        <meshBasicMaterial color={c.primary} transparent opacity={0.55} />
      </mesh>
      {/* District label */}
      <Billboard position={[0, 4.4, 0]} follow>
        <Text fontSize={0.28} color={c.primary} anchorX="center" outlineWidth={0.04} outlineColor="#000">
          {(di.label || category.toUpperCase())}
        </Text>
      </Billboard>
      {/* Portal light */}
      <pointLight position={[0, 2.5, 0]} intensity={1.4} color={c.primary} distance={6} decay={2} />
    </group>
  );
}

// ── Deploy Burst (3D shockwave at agent spawn position) ───────────────────────

function DeployBurst({ x, z, color }) {
  const r0 = useRef(), r1 = useRef(), r2 = useRef(), col = useRef();
  const t0  = useRef(null);
  useFrame((s) => {
    if (t0.current === null) t0.current = s.clock.elapsedTime;
    const age = s.clock.elapsedTime - t0.current;
    [[r0, 0, 0.7], [r1, 0.2, 0.55], [r2, 0.4, 0.4]].forEach(([r, delay, peak]) => {
      if (!r.current) return;
      const t = Math.max(0, age - delay);
      const progress = Math.min(t / 1.8, 1);
      r.current.scale.x = r.current.scale.z = 1 + progress * 24;
      r.current.scale.y = 1;
      r.current.material.opacity = (1 - progress) * peak;
    });
    if (col.current) {
      col.current.material.opacity = Math.sin(Math.min(age / 2.5, 1) * Math.PI) * 0.6;
    }
  });
  return (
    <group position={[x, 0, z]}>
      <mesh ref={r0} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.3, 0]}>
        <ringGeometry args={[0.4, 0.9, 64]} />
        <meshBasicMaterial color={color} transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={r1} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.6, 0]}>
        <ringGeometry args={[0.4, 0.7, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.55} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={r2} rotation={[-Math.PI / 2, 0, 0]} position={[0, 1.0, 0]}>
        <ringGeometry args={[0.4, 0.6, 40]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>
      {/* Light column upward */}
      <mesh ref={col} position={[0, 17, 0]}>
        <cylinderGeometry args={[0.28, 3.2, 34, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0} />
      </mesh>
      <pointLight position={[0, 5, 0]} intensity={30} color={color} distance={22} decay={2} />
    </group>
  );
}

// ── Reputation Crown (rendered above high-rep agents) ─────────────────────────

function ReputationCrown({ color, y }) {
  const rotRef = useRef();
  useFrame((s) => { if (rotRef.current) rotRef.current.rotation.y = s.clock.elapsedTime * 0.7; });
  return (
    <group ref={rotRef} position={[0, y, 0]}>
      {[0, 1, 2, 3, 4].map(i => {
        const a = (i / 5) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.52, 0, Math.sin(a) * 0.52]}>
            <coneGeometry args={[0.09, 0.36, 4]} />
            <meshBasicMaterial color={color} />
          </mesh>
        );
      })}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.48, 0.055, 6, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.08, 0]}>
        <octahedronGeometry args={[0.14, 0]} />
        <meshBasicMaterial color="#FFD700" />
      </mesh>
    </group>
  );
}

// ── Busy Ring (activity indicator around building base) ───────────────────────

function BusyRing({ color, active }) {
  const ringRef = useRef();
  useFrame((_, dt) => {
    if (!ringRef.current) return;
    const speed = active ? 5.5 : 0.25;
    ringRef.current.rotation.y += dt * speed;
    const targetOp = active ? 0.9 : 0.12;
    ringRef.current.children[0].material.opacity +=
      (targetOp - ringRef.current.children[0].material.opacity) * 0.08;
  });
  return (
    <group ref={ringRef} position={[0, 0.35, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.85, active ? 0.1 : 0.055, 8, 40, Math.PI * 1.5]} />
        <meshBasicMaterial color={color} transparent opacity={0.12} />
      </mesh>
    </group>
  );
}

// ── Active Burst (particles shooting upward during agent execution) ───────────

const BURST_N = 14;
function ActiveBurst({ color, active, baseY }) {
  const refs  = useRef([]);
  const progs = useRef(Array.from({ length: BURST_N }, (_, i) => i / BURST_N));
  useFrame((_, dt) => {
    if (!active) { refs.current.forEach(m => { if (m) m.visible = false; }); return; }
    progs.current = progs.current.map((p, i) => {
      const next = (p + dt * (0.55 + i * 0.02)) % 1;
      const m = refs.current[i];
      if (m) {
        m.visible = true;
        const spiral = next * Math.PI * 6 + i * 0.9;
        m.position.set(
          Math.sin(spiral) * 0.28,
          (baseY ?? 1) + next * 9,
          Math.cos(spiral) * 0.28
        );
        const s = (1 - next * 0.6) * 0.2;
        m.scale.setScalar(s);
        m.material.opacity = Math.sin(next * Math.PI) * 0.9;
      }
      return next;
    });
  });
  return (
    <>
      {Array.from({ length: BURST_N }, (_, i) => (
        <mesh key={i} ref={el => { refs.current[i] = el; }} visible={false}>
          <sphereGeometry args={[1, 4, 4]} />
          <meshBasicMaterial color={i % 3 === 0 ? "#ffffff" : color} transparent opacity={0} />
        </mesh>
      ))}
    </>
  );
}

// ── Deploy Announcement Banner (HTML overlay) ─────────────────────────────────

function DeployBanner({ agent, onDone }) {
  const c = cat(agent?.category || "default");
  const [mounted, setMounted] = useState(false);
  const [fading, setFading]   = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
    const t1 = setTimeout(() => setFading(true), 3200);
    const t2 = setTimeout(onDone, 4000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (!agent) return null;
  return (
    <div style={{
      position: "absolute", inset: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      pointerEvents: "none", zIndex: 500,
      opacity: fading ? 0 : 1, transition: "opacity 0.8s ease",
    }}>
      {/* Flash overlay */}
      <div style={{
        position: "absolute", inset: 0,
        background: c.primary,
        opacity: mounted ? 0 : 0.22,
        transition: "opacity 0.4s ease",
      }} />
      {/* Card */}
      <div style={{
        background: "rgba(5,10,20,0.88)",
        border: `2px solid ${c.primary}`,
        borderRadius: 22,
        padding: "30px 52px",
        textAlign: "center",
        backdropFilter: "blur(16px)",
        transform: mounted ? "scale(1) translateY(0)" : "scale(0.55) translateY(50px)",
        transition: "transform 0.45s cubic-bezier(0.17,0.67,0.38,1.3)",
        boxShadow: `0 0 60px ${c.primary}55, 0 0 120px ${c.primary}22`,
        minWidth: 320,
      }}>
        <div style={{ color: c.primary, fontSize: 10, fontWeight: 900, letterSpacing: 4, textTransform: "uppercase", marginBottom: 8, fontFamily: "monospace" }}>
          ◆ NEW AGENT DEPLOYED ◆
        </div>
        <div style={{ color: "#ffffff", fontSize: 30, fontWeight: 900, letterSpacing: "-0.5px", marginBottom: 12, fontFamily: "inherit" }}>
          {agent.name}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ background: c.primary + "33", color: c.primary, border: `1px solid ${c.primary}55`, padding: "3px 14px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
            {(agent.category || "default").toUpperCase()}
          </span>
          <span style={{ background: "#0534213a", color: "#6ee7b7", border: "1px solid #065f4655", padding: "3px 14px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
            ● ONLINE
          </span>
        </div>
        {agent.developer_name && (
          <div style={{ color: "#64748b", fontSize: 12, fontStyle: "italic" }}>
            deployed by {agent.developer_name}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Scene ─────────────────────────────────────────────────────────────────────

function CityScene({ agents, positions, activeAgents, activeArcs, lastOutputs, metrics,
                     rewards, bubbles, selected, onSelect, cameraTarget, anyActive,
                     celebrating, worldEvent, pipelineRoutes, boardEvents, mapMode,
                     onShopClick, reactionTarget, districtOverflow, subDistrictMap, onDistrictClick,
                     developers, celebDevs, onDevSelect, launchPos, theme, battleTeams, spectatorMode,
                     pipelineUsage, myAgents }) {
  const T = theme || {};
  if (!positions.length && agents.length) return null; // wait for layout
  // ── Zone-specific walker position pools ───────────────────────────────────

  // Central plaza: top CENTER_CAPACITY agents + 4 shop buildings
  const centralPositions = useMemo(() => {
    const centralCount = Math.min(agents.length, CENTER_CAPACITY);
    return [...positions.slice(0, centralCount), ...Object.values(SHOP_POSITIONS)];
  }, [positions, agents.length]);

  // Per-district: overflow agent positions + district center point
  const districtPositions = useMemo(() => {
    const result = {};
    Object.entries(districtOverflow || {}).forEach(([category, agentIds]) => {
      if (!agentIds.length) return;
      const dc   = DISTRICT_CENTERS[category];
      const dPos = agentIds
        .map(id => { const idx = agents.findIndex(a => a.id === id); return idx >= 0 ? positions[idx] : null; })
        .filter(Boolean);
      if (dPos.length >= 2 && dc) result[category] = [dc, ...dPos];
    });
    return result;
  }, [districtOverflow, agents, positions]);

  // Per sub-district: positions of agents belonging to each sector
  const subDistrictPositions = useMemo(() => {
    const result = {};
    Object.entries(subDistrictMap || {}).forEach(([category, subs]) => {
      const agentIds = districtOverflow?.[category] || [];
      const n = agentIds.length;
      if (!n) return;
      subs.forEach((sc, i) => {
        const start       = Math.floor(i * n / subs.length);
        const end         = Math.floor((i + 1) * n / subs.length);
        const subAgentIds = agentIds.slice(start, end);
        const dPos        = subAgentIds
          .map(id => { const idx = agents.findIndex(a => a.id === id); return idx >= 0 ? positions[idx] : null; })
          .filter(Boolean);
        if (dPos.length >= 2) result[`${category}-${i}`] = [sc, ...dPos];
      });
    });
    return result;
  }, [subDistrictMap, districtOverflow, agents, positions]);

  // ── Walker budget: proportionally scale ideal counts to MAX_WALKERS ────────
  const npcWalkerCount = Math.min(agents.length, 12); // NPCWalkers: 2 per agent, max 24
  const bgBudget       = MAX_WALKERS - npcWalkerCount * 2;
  const distCount      = Object.keys(districtPositions).length;
  const sdCount        = Object.keys(subDistrictPositions).length;
  const idealTotal     = 20 + distCount * 10 + sdCount * 6;
  const scale          = idealTotal > bgBudget ? bgBudget / idealTotal : 1.0;
  const centralWalkers  = Math.max(2, Math.round(20 * scale));
  const distWalkers     = Math.max(2, Math.round(10 * scale));
  const subDistWalkers  = Math.max(2, Math.round(6  * scale));

  // ── City size expands as districts and sub-districts come online ─────────
  const hasSubDistricts = Object.keys(subDistrictMap  || {}).length > 0;
  const cityRadius      = hasSubDistricts ? 46 : 30;
  const fogNear         = hasSubDistricts ? 130 : 90;
  const fogFar          = hasSubDistricts ? 320 : 240;

  const bloomIntensity = celebrating ? 2.0 : worldEvent ? 1.4 : 0.55;
  const bloomRadius    = celebrating ? 0.7 : worldEvent ? 0.6 : 0.35;

  return (
    <>
      {/* ── Lighting — driven by world theme ── */}
      <color attach="background" args={[T.sky || SKY_COLOR]} />
      <ambientLight intensity={T.ambientInt ?? 2.2} color={T.ambient || "#ffffff"} />
      <directionalLight position={[20, 40, 15]} intensity={T.sunInt ?? 1.8} color={T.sun || "#fffcf0"} />
      <directionalLight position={[-12, 20, -8]} intensity={T.fillInt ?? 0.75} color={T.fill || SHADOW_TINT} />
      <hemisphereLight args={[T.hemiSky || SKY_COLOR, T.hemiGround || "#c8e6c9", 0.75]} />

      {/* Per-building accent lights (subtle in daylight) */}
      {agents.map((a, i) => {
        const p = positions[i]; const c = cat(a.category);
        return (
          <pointLight key={`l-${a.id}`} position={[p.x, 4, p.z]}
            intensity={celebrating ? 8 : worldEvent ? 6 : activeAgents.has(a.id) ? 4 : 0.8}
            color={worldEvent?.color ?? c.primary} distance={10} decay={2} />
        );
      })}

      {/* Fog pushes out as the city expands */}
      <fog attach="fog" color={T.fog || SKY_COLOR} near={fogNear} far={fogFar} />

      {/* Outer terrain + horizon (mountain range + distant city) */}
      <OuterTerrain cityRadius={cityRadius} theme={T} />
      <HorizonScenery theme={T} />
      <SkyLayer theme={T} />

      {/* Floor expands to cover sub-district sectors (radius grows from 30 → 46) */}
      <PlazaFloor radius={cityRadius} floorLight={T.floorLight || FLOOR_LIGHT} floorDark={T.floorDark || FLOOR_DARK} />

      {/* District floor identity patches */}
      {Object.entries(DISTRICT_IDENTITY).map(([category, _]) => {
        const dc = DISTRICT_CENTERS[category];
        return dc ? <DistrictFloorPatch key={category} category={category} cx={dc.x} cz={dc.z} /> : null;
      })}

      {/* District landmark buildings */}
      <TradingLandmark  cx={DISTRICT_CENTERS.trading.x}  cz={DISTRICT_CENTERS.trading.z}  />
      <DataLandmark     cx={DISTRICT_CENTERS.data.x}     cz={DISTRICT_CENTERS.data.z}     />
      <AnalysisLandmark cx={DISTRICT_CENTERS.analysis.x} cz={DISTRICT_CENTERS.analysis.z} />
      <RiskLandmark     cx={DISTRICT_CENTERS.risk.x}     cz={DISTRICT_CENTERS.risk.z}     />

      {/* Portal gates at each district entrance */}
      {PORTAL_GATES.map(g => <PortalGate key={g.category} {...g} />)}

      {/* Main arteries: hub → each district center */}
      {Object.values(DISTRICT_CENTERS).map((dc, i) => (
        <MainArtery key={`art-${i}`} from={{ x: 0, z: 0 }} to={dc} />
      ))}

      {/* Local paths: center → each agent building */}
      {agents.map((a, i) => {
        const p = positions[i];
        return <Road key={a.id} from={{ x: 0, z: 0 }} to={{ x: p.x, z: p.z }} />;
      })}

      {/* Sub-district connector roads: district gateway → each sector center */}
      {Object.entries(subDistrictMap || {}).map(([category, subs]) => {
        const dc = DISTRICT_CENTERS[category];
        if (!dc) return null;
        return subs.map((sc, i) => (
          <Road key={`sdroad-${category}-${i}`} from={dc} to={sc} />
        ));
      })}

      {/* NPC walkers — capped at npcWalkerCount agents (max MAX_WALKERS*0.6/2) */}
      {agents.slice(0, npcWalkerCount).map((a, i) => {
        const p = positions[i]; const color = walkerColor(a.category);
        return [0, 0.5].map(offset => (
          <NPCWalker key={`${a.id}-${offset}`}
            from={{ x: 0, z: 0 }} to={{ x: p.x, z: p.z }}
            color={color} offset={offset + i * 0.17} celebrating={celebrating}
            onWalkerClick={() => onSelect(a)} reactionTarget={reactionTarget} />
        ));
      })}

      {/* Central plaza walkers — up to 20 (scaled by budget) */}
      <BackgroundWalkerPool positions={centralPositions} agents={agents}
        reactionTarget={reactionTarget} count={centralWalkers} />

      {/* District walkers — up to 10 per district with overflow agents */}
      {Object.entries(districtPositions).map(([category, dpos]) => (
        <BackgroundWalkerPool key={`dw-${category}`} positions={dpos} agents={agents}
          reactionTarget={reactionTarget} count={distWalkers} />
      ))}

      {/* Sub-district walkers — up to 6 per sector */}
      {Object.entries(subDistrictPositions).map(([key, sdpos]) => (
        <BackgroundWalkerPool key={`sdw-${key}`} positions={sdpos} agents={agents}
          reactionTarget={reactionTarget} count={subDistWalkers} />
      ))}

      {/* Developer avatars — one per developer that has published agents */}
      {(developers || []).map((dev) => {
        const devAgentPositions = dev.agents
          .map(da => { const idx = agents.findIndex(a => a.id === da.id); return idx >= 0 ? positions[idx] : null; })
          .filter(Boolean);
        if (!devAgentPositions.length) return null;
        return (
          <DeveloperAvatar
            key={dev.name}
            developer={dev}
            agentPositions={devAgentPositions}
            celebrating={celebDevs?.has(dev.name) || false}
            onClick={() => onDevSelect?.(dev)}
          />
        );
      })}

      {/* Plaza props */}
      <PlazaProps />

      {/* Shop district */}
      <ShopDistrict agents={agents} onShopClick={onShopClick} />
      {Object.keys(districtOverflow || {}).map(category =>
        DISTRICT_CENTERS[category] ? (
          <DistrictMarker key={category} category={category}
            position={DISTRICT_CENTERS[category]} onClick={onDistrictClick} />
        ) : null
      )}
      {/* Sub-district sector markers (Level 3) */}
      {Object.entries(subDistrictMap || {}).map(([category, subs]) =>
        subs.map((sc, i) => (
          <SubDistrictMarker key={`${category}-sub-${i}`}
            label={sc.label} position={sc} color={cat(category).primary} />
        ))
      )}
      <MarketplaceTrendingBoard agents={agents} metrics={metrics} />

      {/* Sky — drone count scales with city, capped at MAX_DRONES */}
      {Array.from({ length: Math.min(MAX_DRONES, 3 + Math.ceil(agents.length / 4)) }, (_, i) => (
        <Drone key={i} seed={i} />
      ))}
      {/* DataBeams capped so total particles stay under MAX_PARTICLES */}
      {agents.filter(a => a.category === "data").slice(0, Math.floor(MAX_PARTICLES / 10)).map(a => {
        const idx = agents.indexOf(a); const p = positions[idx];
        return p ? <DataBeam key={a.id} x={p.x} z={p.z} color={cat("data").primary} /> : null;
      })}
      {worldEvent?.type === "storm" && agents.filter(a => a.category !== "data").map(a => {
        const p = positions[agents.indexOf(a)];
        return p ? <DataBeam key={`storm-${a.id}`} x={p.x} z={p.z} color={cat(a.category).primary} /> : null;
      })}

      <CloudLayer />
      <MarketPulse active={anyActive || !!worldEvent || celebrating} />
      <CentralPlaza agents={agents} positions={positions} worldEvent={worldEvent} />
      <ScoreBoard agents={agents} metrics={metrics} />
      <PlazaNoticeBoard events={boardEvents} />
      <ConfettiSystem active={celebrating} />

      {/* Launch fireworks + deploy burst — triggered on agent_launch event */}
      {worldEvent?.type === "agent_launch" && launchPos && (
        <>
          <LaunchFireworks x={launchPos.x} z={launchPos.z} />
          <DeployBurst x={launchPos.x} z={launchPos.z} color="#BB8FCE" />
        </>
      )}

      {/* Revenue burst — golden confetti from sky */}
      {worldEvent?.type === "revenue_burst" && (
        <ConfettiSystem active={true} />
      )}

      {/* Agent connections */}
      {agents.map((a, i) => {
        const p = positions[i]; const color = cat(a.category).primary;
        return activeAgents.has(a.id)
          ? <SignalStream key={a.id} from={[0,1,0]} to={[p.x,1,p.z]} color={color} />
          : <IdleArc     key={a.id} from={[0,1,0]} to={[p.x,1,p.z]} color={color} />;
      })}

      {[...activeArcs].map(key => {
        const [fId, tId] = key.split("->"); const fi = agents.findIndex(a => a.id === fId); const ti = agents.findIndex(a => a.id === tId);
        if (fi < 0 || ti < 0) return null;
        return <SignalStream key={key} from={[positions[fi].x,1,positions[fi].z]} to={[positions[ti].x,1,positions[ti].z]} color={cat(agents[ti].category).primary} />;
      })}

      {[...pipelineRoutes].map(key => {
        const [fId, tId] = key.split("->"); const fi = agents.findIndex(a => a.id === fId); const ti = agents.findIndex(a => a.id === tId);
        if (fi < 0 || ti < 0 || activeArcs.has(key)) return null;
        return <PipelineHighway key={`hw-${key}`} from={[positions[fi].x,1,positions[fi].z]} to={[positions[ti].x,1,positions[ti].z]} color={cat(agents[ti].category).primary} heat={pipelineUsage?.[key] || 1} />;
      })}

      {agents.map((a, i) => {
        const team = battleTeams
          ? battleTeams.a.has(a.id) ? "a" : battleTeams.b.has(a.id) ? "b" : null
          : null;
        return (
          <AgentBuilding key={a.id} agent={a} position={positions[i]}
            active={activeAgents.has(a.id)} lastOutput={lastOutputs[a.id]}
            requests={metrics[a.id]?.requests || 0}
            selected={selected?.id === a.id} onClick={onSelect}
            bubble={bubbles[a.id] ?? null} celebrating={celebrating}
            battleTeam={team} isMine={myAgents.has(a.id)} />
        );
      })}

      {rewards.map(r => <FloatingReward key={r.id} x={r.x} z={r.z} text={r.text} color={r.color} />)}
      {reactionTarget && <ReactionBeam x={reactionTarget.x} z={reactionTarget.z} color={reactionTarget.color} />}

      <CameraDirector target={cameraTarget} mapMode={mapMode}
        spectatorMode={spectatorMode}
        spectatorTargets={positions.length ? positions.map((p, i) => ({ x: p.x, z: p.z, label: agents[i]?.name })) : [{ x: 0, z: 0 }]}
      />
      <EffectComposer>
        <Bloom luminanceThreshold={0.5} luminanceSmoothing={0.9} intensity={bloomIntensity} radius={bloomRadius} />
      </EffectComposer>
    </>
  );
}

// ── HUD ───────────────────────────────────────────────────────────────────────

function HUD({ selected, metrics, lastOutputs, onClose }) {
  if (!selected) return null;
  const c = cat(selected.category), m = metrics[selected.id] || {}, out = lastOutputs[selected.id];
  return (
    <div style={{
      position: "absolute", right: 20, top: 20, width: 240,
      background: "rgba(255,255,255,0.96)", border: `2px solid ${c.primary}`,
      borderRadius: 16, padding: "16px 14px", zIndex: 100,
      backdropFilter: "blur(20px)", fontFamily: "monospace",
      boxShadow: `0 4px 24px rgba(0,0,0,0.12)`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ color: c.primary, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>{selected.category}</div>
          <div style={{ color: "#1a1a2e", fontWeight: 700, fontSize: 15, marginTop: 3 }}>{selected.name}</div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#aaa", cursor: "pointer", fontSize: 20 }}>×</button>
      </div>
      <div style={{ background: "#f8f4ee", borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>
        {[["Requests", m.requests||0], ["Avg latency", m.avg_latency_ms ? `${m.avg_latency_ms}ms` : "—"],
          ["Earnings", m.earnings ? `$${m.earnings}` : "—"], ["Price/req", `$${selected.price_per_request}`]
        ].map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 11, borderBottom: "1px solid #eee" }}>
            <span style={{ color: "#888" }}>{k}</span><span style={{ color: "#333" }}>{v}</span>
          </div>
        ))}
      </div>
      {out && (
        <div style={{ background: "#f8f4ee", borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>
          <div style={{ color: "#aaa", fontSize: 9, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>Last Signal</div>
          {Object.entries(out).filter(([k]) => k !== "market").map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: 11 }}>
              <span style={{ color: "#888" }}>{k}</span>
              <span style={{ color: c.primary, fontWeight: 700 }}>{typeof v === "number" ? (v % 1 ? v.toFixed(3) : v) : String(v).toUpperCase()}</span>
            </div>
          ))}
        </div>
      )}
      <button onClick={() => fetch(`${API}/call-agent/${selected.id}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ market: "BTC" }),
      })} style={{
        width: "100%", background: c.primary, color: "#fff",
        border: "none", borderRadius: 10, padding: "9px",
        fontSize: 13, cursor: "pointer", fontWeight: 700,
      }}>▶ Transmit Signal</button>
    </div>
  );
}

function Toast({ msg }) {
  if (!msg) return null;
  return (
    <div style={{
      position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)",
      zIndex: 200, background: "rgba(255,255,255,0.97)", border: "2px solid #6BCB77",
      borderRadius: 12, padding: "8px 24px", color: "#2d6a38", fontSize: 13,
      fontWeight: 600, backdropFilter: "blur(12px)", whiteSpace: "nowrap",
      boxShadow: "0 4px 24px rgba(0,0,0,0.1)", fontFamily: "monospace",
    }}>{msg}</div>
  );
}

// ── Shop Panel (HTML overlay) ─────────────────────────────────────────────────

function AgentShopCard({ agent, metrics }) {
  const m  = metrics || {};
  const sc = shopHtml(agent.category);
  return (
    <div style={{
      background: "#fff", border: `2px solid ${sc.border}33`,
      borderTop: `4px solid ${sc.border}`, borderRadius: 16,
      padding: "18px 16px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
        <div style={{
          width: 46, height: 46, borderRadius: 12, flexShrink: 0,
          background: sc.border, fontSize: 20, fontWeight: 800, color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>{sc.letter}</div>
        <div>
          <div style={{ color: "#1a1a2e", fontWeight: 700, fontSize: 15 }}>{agent.name}</div>
          <span style={{
            display: "inline-block", marginTop: 3, background: `${sc.border}18`,
            color: sc.border, borderRadius: 4, padding: "1px 8px",
            fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8,
          }}>{agent.category}</span>
        </div>
      </div>
      <div style={{ color: "#64748b", fontSize: 12, lineHeight: 1.5, marginBottom: 12 }}>
        {agent.description || "No description."}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 14 }}>
        {[
          ["Price / call", `$${agent.price_per_request}`],
          ["Requests",     m.requests || 0],
          ["Avg latency",  m.avg_latency_ms ? `${m.avg_latency_ms}ms` : "—"],
          ["Earnings",     m.earnings ? `$${m.earnings}` : "—"],
        ].map(([k, v]) => (
          <div key={k} style={{ background: "#f8f4ee", borderRadius: 8, padding: "7px 9px" }}>
            <div style={{ color: "#aaa", fontSize: 9, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 2 }}>{k}</div>
            <div style={{ color: "#1a1a2e", fontWeight: 700, fontSize: 14 }}>{String(v)}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <a href="/build" style={{
          flex: 1, textAlign: "center", background: sc.border, color: "#fff",
          borderRadius: 10, padding: "9px", fontSize: 12, fontWeight: 700,
          textDecoration: "none", display: "block",
        }}>+ Add to Pipeline</a>
        <button onClick={() =>
          fetch(`${API}/call-agent/${agent.id}`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ market: "BTC" }),
          }).catch(() => {})
        } style={{
          flex: 1, background: "#f8f4ee", color: sc.border,
          border: `2px solid ${sc.border}33`, borderRadius: 10, padding: "9px",
          fontSize: 12, cursor: "pointer", fontWeight: 700,
        }}>▶ Try Signal</button>
      </div>
    </div>
  );
}

function ShopPanel({ category, agents, metrics, onClose }) {
  const shopAgents = agents.filter(a => a.category === category);
  const sc = shopHtml(category);
  return (
    <div style={{
      position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)",
      zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center",
      backdropFilter: "blur(6px)",
    }} onClick={onClose}>
      <div style={{
        background: "#fffdf8", borderRadius: 24, padding: "26px 26px 30px",
        maxWidth: 800, width: "92%", maxHeight: "88vh", overflowY: "auto",
        boxShadow: "0 20px 80px rgba(0,0,0,0.28)", border: `4px solid ${sc.border}`,
        fontFamily: "monospace",
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 26 }}>
          <div style={{
            width: 60, height: 60, borderRadius: 16, flexShrink: 0,
            background: sc.border, fontSize: 28, fontWeight: 800, color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>{sc.letter}</div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1a1a2e" }}>
              {CAT[category]?.label ?? category} Shop
            </div>
            <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 3 }}>
              {shopAgents.length} agent{shopAgents.length !== 1 ? "s" : ""} available
            </div>
          </div>
          <button onClick={onClose} style={{
            marginLeft: "auto", background: "none", border: "2px solid #e2e8f0",
            color: "#94a3b8", borderRadius: 10, width: 36, height: 36,
            fontSize: 18, cursor: "pointer",
          }}>×</button>
        </div>
        {shopAgents.length === 0 ? (
          <div style={{ textAlign: "center", color: "#94a3b8", padding: "40px 0", fontSize: 14 }}>
            No agents in this shop yet.<br />
            <span style={{ fontSize: 11, display: "block", marginTop: 6 }}>
              Register an agent with category "{category}" to appear here.
            </span>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px,1fr))", gap: 16 }}>
            {shopAgents.map(a => <AgentShopCard key={a.id} agent={a} metrics={metrics[a.id]} />)}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Live Event Board (HTML sidebar) ──────────────────────────────────────────

function LiveEventBoard({ worldEvent, activePipelineCount, boardEvents }) {
  if (!worldEvent && activePipelineCount === 0 && boardEvents.length === 0) return null;

  return (
    <div style={{
      position: "absolute", left: 14, bottom: 60, zIndex: 100,
      width: 220, display: "flex", flexDirection: "column", gap: 8,
      pointerEvents: "none",
    }}>
      {/* Active event */}
      {worldEvent && (
        <div style={{
          background: "rgba(255,255,255,0.96)", borderRadius: 12,
          border: `2px solid ${worldEvent.color}`,
          padding: "10px 14px",
          boxShadow: `0 4px 20px ${worldEvent.color}44`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: worldEvent.color,
              boxShadow: `0 0 6px ${worldEvent.color}` }} />
            <span style={{ color: worldEvent.color, fontWeight: 800, fontSize: 11,
              letterSpacing: "0.6px", textTransform: "uppercase", fontFamily: "monospace" }}>
              LIVE EVENT
            </span>
          </div>
          <div style={{ color: "#2d3a4a", fontWeight: 700, fontSize: 13 }}>{worldEvent.label}</div>
          {worldEvent.detail && (
            <div style={{ color: "#9aabb8", fontSize: 11, marginTop: 2 }}>{worldEvent.detail}</div>
          )}
        </div>
      )}

      {/* Active pipelines */}
      {activePipelineCount > 0 && (
        <div style={{
          background: "rgba(255,255,255,0.92)", borderRadius: 10,
          border: "1px solid #6BCF8B50", padding: "8px 12px",
        }}>
          <div style={{ color: "#6BCF8B", fontWeight: 700, fontSize: 11, letterSpacing: "0.5px" }}>
            ⚡ {activePipelineCount} PIPELINE{activePipelineCount > 1 ? "S" : ""} ACTIVE
          </div>
        </div>
      )}

      {/* Recent board events */}
      {boardEvents.slice(0, 3).map(ev => (
        <div key={ev.id} style={{
          background: "rgba(255,255,255,0.88)", borderRadius: 10,
          borderLeft: `3px solid ${ev.color}`, padding: "7px 10px",
        }}>
          <div style={{ fontWeight: 700, fontSize: 11, color: ev.color }}>{ev.agentName}</div>
          <div style={{ color: "#9aabb8", fontSize: 10, marginTop: 1, whiteSpace: "nowrap",
            overflow: "hidden", textOverflow: "ellipsis" }}>{ev.message}</div>
        </div>
      ))}
    </div>
  );
}

// ── Agent Leaderboard Panel (HTML overlay, toggleable) ────────────────────────

function AgentLeaderboardPanel({ agents, metrics, onClose }) {
  const byEarnings = useMemo(() =>
    [...agents].sort((a, b) => (metrics[b.id]?.earnings || 0) - (metrics[a.id]?.earnings || 0)).slice(0, 5),
    [agents, metrics]
  );
  const byCalls = useMemo(() =>
    [...agents].sort((a, b) => (metrics[b.id]?.requests || 0) - (metrics[a.id]?.requests || 0)).slice(0, 5),
    [agents, metrics]
  );
  const MEDALS = ["🥇", "🥈", "🥉", "4th", "5th"];

  const Row = ({ agent, value, color, i }) => (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "8px 0", borderBottom: "1px solid #f0ece4",
    }}>
      <span style={{ fontSize: i < 3 ? 14 : 11, width: 22, textAlign: "center",
        color: i === 0 ? "#FFD700" : "#9aabb8", fontWeight: 700 }}>{MEDALS[i]}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: "#2d3a4a",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{agent.name}</div>
        <div style={{ fontSize: 10, color: cat(agent.category).primary, textTransform: "uppercase",
          letterSpacing: 0.5 }}>{agent.category}</div>
      </div>
      <div style={{ fontWeight: 800, fontSize: 13, color, flexShrink: 0 }}>{value}</div>
    </div>
  );

  return (
    <div style={{
      position: "absolute", top: "50%", right: 14, transform: "translateY(-50%)",
      background: "#fff", borderRadius: 18, padding: "20px 22px",
      boxShadow: "0 8px 40px rgba(0,0,0,0.16)",
      width: 260, zIndex: 200, fontFamily: "inherit",
      border: "1px solid #e6d6bd",
    }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: "#2d3a4a", flex: 1 }}>Leaderboard</div>
        <button onClick={onClose} style={{ background: "none", border: "none",
          fontSize: 18, cursor: "pointer", color: "#9aabb8", lineHeight: 1 }}>×</button>
      </div>

      <div style={{ fontSize: 10, color: "#9aabb8", textTransform: "uppercase",
        letterSpacing: 0.7, marginBottom: 8 }}>Top Earners</div>
      {byEarnings.map((a, i) => (
        <Row key={a.id} agent={a} value={`$${(metrics[a.id]?.earnings || 0).toFixed(2)}`}
          color="#FFD700" i={i} />
      ))}

      <div style={{ fontSize: 10, color: "#9aabb8", textTransform: "uppercase",
        letterSpacing: 0.7, margin: "14px 0 8px" }}>Most Active</div>
      {byCalls.map((a, i) => (
        <Row key={a.id} agent={a} value={`${metrics[a.id]?.requests || 0} calls`}
          color="#4a9fd4" i={i} />
      ))}
    </div>
  );
}

// ── World Event Banner ────────────────────────────────────────────────────────

function WorldEventBanner({ event }) {
  if (!event) return null;
  return (
    <div style={{
      position: "absolute", top: 58, left: "50%", transform: "translateX(-50%)",
      zIndex: 200, background: "rgba(255,255,255,0.97)",
      border: `2px solid ${event.color}`,
      borderRadius: 14, padding: "10px 28px",
      backdropFilter: "blur(14px)", fontFamily: "monospace",
      boxShadow: `0 4px 30px ${event.color}55`,
      display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
      whiteSpace: "nowrap",
    }}>
      <div style={{ color: event.color, fontSize: 15, fontWeight: 800, letterSpacing: "1px" }}>
        {event.label}
      </div>
      {event.detail && (
        <div style={{ color: "#9aabb8", fontSize: 11, fontWeight: 600, letterSpacing: "0.4px" }}>
          {event.detail}
        </div>
      )}
    </div>
  );
}

// ── Share Card ────────────────────────────────────────────────────────────────

function ShareCard({ agents, metrics, onClose }) {
  const [imgUrl, setImgUrl] = useState(null);
  useEffect(() => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return;
    try { setImgUrl(canvas.toDataURL("image/png")); } catch { setImgUrl(null); }
  }, []);

  const totalEarnings = agents.reduce((s, a) => s + (metrics[a.id]?.earnings || 0), 0);
  const totalCalls    = agents.reduce((s, a) => s + (metrics[a.id]?.requests  || 0), 0);
  const tweetText     = encodeURIComponent(`My AgentVerse city has ${agents.length} AI agents — ${totalCalls} calls, $${totalEarnings} earned 🤖🏙️`);

  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 24, maxWidth: 500, width: "90%", boxShadow: "0 8px 40px rgba(0,0,0,0.2)" }} onClick={e => e.stopPropagation()}>
        {imgUrl
          ? <img src={imgUrl} alt="city" style={{ width: "100%", borderRadius: 12, marginBottom: 16, display: "block" }} />
          : <div style={{ height: 140, display: "flex", alignItems: "center", justifyContent: "center", color: "#ccc", fontFamily: "monospace", marginBottom: 16, fontSize: 12 }}>screenshot unavailable</div>
        }
        <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
          {[["Agents", agents.length, "#4DA6FF"], ["Calls", totalCalls, "#6BCB77"], ["Earned", `$${totalEarnings}`, "#FFD166"]].map(([label, val, color]) => (
            <div key={label} style={{ flex: 1, textAlign: "center", background: "#f8f4ee", borderRadius: 12, padding: "10px 6px", border: `2px solid ${color}` }}>
              <div style={{ color, fontWeight: 800, fontSize: 18, fontFamily: "monospace" }}>{val}</div>
              <div style={{ color: "#aaa", fontSize: 10, marginTop: 2, fontFamily: "monospace" }}>{label}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <a href={`https://twitter.com/intent/tweet?text=${tweetText}`} target="_blank" rel="noopener noreferrer"
            style={{ flex: 1, textAlign: "center", background: "#1d9bf0", color: "#fff", borderRadius: 12, padding: "11px", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
            Share on X
          </a>
          {imgUrl && (
            <a href={imgUrl} download="agentverse.png"
              style={{ flex: 1, textAlign: "center", background: "#f0f8ff", color: "#4DA6FF", border: "2px solid #4DA6FF", borderRadius: 12, padding: "11px", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
              Download
            </a>
          )}
          <button onClick={onClose} style={{ background: "none", border: "2px solid #eee", color: "#aaa", borderRadius: 12, padding: "11px 16px", fontSize: 13, cursor: "pointer" }}>×</button>
        </div>
      </div>
    </div>
  );
}

// ── World events ──────────────────────────────────────────────────────────────

const WORLD_EVENTS = [
  { type: "volatile",      label: "MARKET VOLATILE",  color: "#FF6B6B", bloomBoost: 0.8, speedBoost: 2.2 },
  { type: "storm",         label: "SIGNAL STORM",      color: "#4DA6FF", bloomBoost: 1.0, speedBoost: 3.0 },
  { type: "overload",      label: "AGENT OVERLOAD",    color: "#FFD166", bloomBoost: 0.9, speedBoost: 2.5 },
  { type: "signal_storm",  label: "⚡ SIGNAL STORM",   color: "#4DA6FF", bloomBoost: 1.2, speedBoost: 3.5 },
  { type: "revenue_burst", label: "💰 REVENUE BURST",  color: "#FFD700", bloomBoost: 1.0, speedBoost: 1.8 },
  { type: "pipeline_race", label: "🏁 PIPELINE RACE",  color: "#6BCF8B", bloomBoost: 0.8, speedBoost: 2.8 },
  { type: "agent_launch",  label: "🚀 AGENT LAUNCH",   color: "#BB8FCE", bloomBoost: 0.9, speedBoost: 1.5 },
];

// ── Main ──────────────────────────────────────────────────────────────────────

// ── Mini-Map overlay ─────────────────────────────────────────────────────────

const MINIMAP_SIZE = 136;
const MINIMAP_WORLD_R = 58; // world units shown
const MINIMAP_SCALE   = (MINIMAP_SIZE / 2) / MINIMAP_WORLD_R;
const MINIMAP_CENTER  = MINIMAP_SIZE / 2;

function w2m(x, z) {
  return { mx: MINIMAP_CENTER + x * MINIMAP_SCALE, my: MINIMAP_CENTER + z * MINIMAP_SCALE };
}

function MiniMap({ agents, positions, metrics, lobbyColor, onTeleport }) {
  return (
    <div style={{
      position: "absolute", top: 54, left: 14, zIndex: 100,
      width: MINIMAP_SIZE,
      background: "rgba(5,10,20,0.82)", backdropFilter: "blur(8px)",
      borderRadius: 10, border: `1px solid rgba(255,255,255,0.09)`,
      overflow: "hidden",
      boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
    }}>
      <div style={{
        fontSize: 9, color: "#6b7d92", textAlign: "center",
        padding: "4px 0 2px", fontFamily: "monospace", letterSpacing: 1.5,
      }}>MAP</div>
      <svg width={MINIMAP_SIZE} height={MINIMAP_SIZE} style={{ display: "block" }}>
        {/* Roads hub → districts */}
        {Object.entries(DISTRICT_CENTERS).map(([name, dc]) => {
          const { mx, my } = w2m(dc.x, dc.z);
          const c = cat(name);
          return <line key={`rl-${name}`} x1={MINIMAP_CENTER} y1={MINIMAP_CENTER}
            x2={mx} y2={my} stroke={c.primary} strokeWidth={1} opacity={0.3} />;
        })}

        {/* Agent dots */}
        {agents.map((a, i) => {
          if (!positions[i]) return null;
          const { mx, my } = w2m(positions[i].x, positions[i].z);
          const c = cat(a.category);
          const hot = (metrics[a.id]?.requests || 0) > 5;
          return <circle key={a.id} cx={mx} cy={my} r={hot ? 2.8 : 1.8}
            fill={c.primary} opacity={hot ? 1 : 0.65} />;
        })}

        {/* District labels */}
        {Object.entries(DISTRICT_CENTERS).map(([name, dc]) => {
          const { mx, my } = w2m(dc.x, dc.z);
          const c = cat(name);
          return (
            <g key={name} onClick={() => onTeleport(dc)} style={{ cursor: "pointer" }}>
              <circle cx={mx} cy={my} r={8} fill={c.primary + "50"} stroke={c.primary} strokeWidth={1.2} />
              <text x={mx} y={my + 0.5} textAnchor="middle" dominantBaseline="middle"
                fill={c.primary} fontSize={5.5} fontFamily="monospace" fontWeight="bold">
                {name[0].toUpperCase()}
              </text>
            </g>
          );
        })}

        {/* Hub */}
        <circle cx={MINIMAP_CENTER} cy={MINIMAP_CENTER} r={5}
          fill={lobbyColor + "60"} stroke={lobbyColor} strokeWidth={1.5} />
        <text x={MINIMAP_CENTER} y={MINIMAP_CENTER + 0.5} textAnchor="middle"
          dominantBaseline="middle" fill={lobbyColor} fontSize={4.5} fontFamily="monospace">H</text>
      </svg>
    </div>
  );
}

// ── Agent Wars ───────────────────────────────────────────────────────────────

function BattleScoreboard({ battle, onClose }) {
  if (!battle) return null;
  const { pipelineA, pipelineB, scoreA, scoreB, winner, phase, stepEvents } = battle;
  const barA = Math.round((scoreA / Math.max(scoreA + scoreB, 0.0001)) * 100);
  const barB = 100 - barA;

  return (
    <div style={{
      position: "absolute", top: "50%", left: "50%",
      transform: "translate(-50%, -50%)", zIndex: 300,
      width: 360, background: "rgba(5,10,20,0.96)", backdropFilter: "blur(16px)",
      borderRadius: 18, overflow: "hidden",
      boxShadow: "0 16px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.08)",
      fontFamily: "monospace",
    }}>
      {/* Header */}
      <div style={{
        textAlign: "center", padding: "16px 20px 10px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ fontSize: 11, color: "#6b7d92", letterSpacing: 2, marginBottom: 4 }}>
          ⚔ AGENT BATTLE
        </div>
        <div style={{ fontSize: 13, color: "#c8d8e8", fontWeight: 700 }}>
          {pipelineA.name} <span style={{ color: "#3a4a5a" }}>vs</span> {pipelineB.name}
        </div>
      </div>

      {/* Score bars */}
      <div style={{ padding: "16px 20px" }}>
        {/* Team A */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
            <span style={{ color: "#FF4D6D", fontSize: 11, fontWeight: 700 }}>
              {pipelineA.name}
            </span>
            <span style={{ color: "#FF4D6D", fontSize: 12, fontWeight: 800 }}>
              {(scoreA * 100).toFixed(1)}%
            </span>
          </div>
          <div style={{ height: 10, background: "rgba(255,255,255,0.06)", borderRadius: 5, overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${barA}%`,
              background: "linear-gradient(90deg, #FF4D6D, #FF8C99)",
              borderRadius: 5, transition: "width 0.6s ease",
            }} />
          </div>
        </div>
        {/* Team B */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
            <span style={{ color: "#4DA6FF", fontSize: 11, fontWeight: 700 }}>
              {pipelineB.name}
            </span>
            <span style={{ color: "#4DA6FF", fontSize: 12, fontWeight: 800 }}>
              {(scoreB * 100).toFixed(1)}%
            </span>
          </div>
          <div style={{ height: 10, background: "rgba(255,255,255,0.06)", borderRadius: 5, overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${barB}%`,
              background: "linear-gradient(90deg, #4DA6FF, #80C4FF)",
              borderRadius: 5, transition: "width 0.6s ease",
            }} />
          </div>
        </div>

        {/* Live steps feed */}
        <div style={{
          maxHeight: 100, overflowY: "auto", marginBottom: 12,
          borderRadius: 8, background: "rgba(255,255,255,0.03)",
          padding: "6px 10px",
        }}>
          {stepEvents.slice(-6).map((s, i) => (
            <div key={i} style={{
              fontSize: 10, color: s.color, lineHeight: 1.6, display: "flex", gap: 6,
            }}>
              <span style={{ opacity: 0.5 }}>{s.team === "a" ? "🔴" : "🔵"}</span>
              <span style={{ flex: 1, color: "#9aabb8" }}>{s.agentName}</span>
              <span style={{ fontWeight: 700 }}>{(s.stepScore * 100).toFixed(0)}%</span>
            </div>
          ))}
          {stepEvents.length === 0 && (
            <div style={{ color: "#3a4a5a", fontSize: 10, textAlign: "center" }}>
              Waiting for first step…
            </div>
          )}
        </div>

        {/* Winner banner */}
        {phase === "done" && (
          <div style={{
            textAlign: "center", padding: "10px",
            background: winner === "tie" ? "rgba(255,200,0,0.12)"
              : winner === "a" ? "rgba(255,77,109,0.15)" : "rgba(77,166,255,0.15)",
            borderRadius: 10, marginBottom: 10,
            border: `1px solid ${winner === "tie" ? "#FFD700" : winner === "a" ? "#FF4D6D" : "#4DA6FF"}40`,
          }}>
            {winner === "tie" ? (
              <span style={{ color: "#FFD700", fontSize: 14, fontWeight: 800 }}>🤝 TIE</span>
            ) : (
              <span style={{
                color: winner === "a" ? "#FF4D6D" : "#4DA6FF",
                fontSize: 14, fontWeight: 800,
              }}>
                🏆 {winner === "a" ? pipelineA.name : pipelineB.name} WINS
              </span>
            )}
          </div>
        )}

        {phase !== "done" && (
          <div style={{ textAlign: "center", color: "#4a5a6a", fontSize: 10 }}>
            ⚡ Battle in progress…
          </div>
        )}
      </div>

      {phase === "done" && (
        <button onClick={onClose} style={{
          width: "100%", background: "rgba(255,255,255,0.06)",
          border: "none", borderTop: "1px solid rgba(255,255,255,0.06)",
          color: "#6b7d92", fontSize: 12, fontWeight: 700, padding: "12px",
          cursor: "pointer", fontFamily: "monospace",
        }}>Dismiss</button>
      )}
    </div>
  );
}

function BattleSetup({ pipelines, onStart, onClose }) {
  const [selA, setSelA] = useState("");
  const [selB, setSelB] = useState("");

  return (
    <div style={{
      position: "absolute", top: "50%", left: "50%",
      transform: "translate(-50%, -50%)", zIndex: 300,
      width: 320, background: "rgba(5,10,20,0.96)", backdropFilter: "blur(16px)",
      borderRadius: 16, padding: "20px",
      boxShadow: "0 16px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.08)",
      fontFamily: "monospace",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ color: "#c8d8e8", fontSize: 14, fontWeight: 800 }}>⚔ Agent War</div>
        <button onClick={onClose} style={{
          background: "none", border: "none", color: "#6b7d92", fontSize: 16, cursor: "pointer",
        }}>✕</button>
      </div>

      {[["🔴 Pipeline A", selA, setSelA], ["🔵 Pipeline B", selB, setSelB]].map(([label, val, set]) => (
        <div key={label} style={{ marginBottom: 12 }}>
          <div style={{ color: "#6b7d92", fontSize: 10, marginBottom: 5, letterSpacing: 1 }}>{label}</div>
          <select value={val} onChange={e => set(e.target.value)} style={{
            width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
            color: "#c8d8e8", borderRadius: 8, padding: "8px 10px", fontSize: 12,
            fontFamily: "monospace", outline: "none", cursor: "pointer",
          }}>
            <option value="" style={{ background: "#0a1018" }}>— select pipeline —</option>
            {pipelines.map(p => <option key={p.id} value={p.id} style={{ background: "#0a1018" }}>{p.name}</option>)}
          </select>
        </div>
      ))}

      <button
        onClick={() => { if (selA && selB && selA !== selB) onStart(selA, selB); }}
        disabled={!selA || !selB || selA === selB}
        style={{
          width: "100%", marginTop: 8,
          background: (selA && selB && selA !== selB) ? "linear-gradient(90deg, #FF4D6D, #4DA6FF)" : "#1a2a3a",
          border: "none", borderRadius: 10, padding: "12px",
          color: (selA && selB && selA !== selB) ? "#fff" : "#3a4a5a",
          fontSize: 13, fontWeight: 800, cursor: (selA && selB && selA !== selB) ? "pointer" : "default",
          fontFamily: "monospace",
        }}
      >
        ⚔ Start Battle
      </button>
      {(!selA || !selB || selA === selB) && (
        <div style={{ color: "#6b7d92", fontSize: 10, textAlign: "center", marginTop: 6 }}>
          Select two different pipelines
        </div>
      )}
    </div>
  );
}

// ── Lobby Chat ───────────────────────────────────────────────────────────────

function LobbyChat({ lobbyId, lobbyColor, onClose }) {
  const [messages,   setMessages]   = useState([]);
  const [draft,      setDraft]      = useState("");
  const [nick,       setNick]       = useState(() => "Visitor" + Math.floor(Math.random() * 9000 + 1000));
  const [connState,  setConnState]  = useState("connecting"); // "connecting" | "open" | "closed"
  const wsRef     = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    setConnState("connecting");
    setMessages([]);
    const ws = new WebSocket(`${WS_BASE}/ws/chat/${lobbyId}`);
    wsRef.current = ws;

    ws.onopen  = () => setConnState("open");
    ws.onerror = () => setConnState("closed");
    ws.onclose = () => setConnState("closed");

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "chat" && msg.user && msg.text) {
          setMessages(prev => [...prev.slice(-99), msg]);
        }
      } catch {}
    };

    return () => { ws.onopen = ws.onerror = ws.onclose = ws.onmessage = null; ws.close(); };
  }, [lobbyId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      setMessages(prev => [...prev, {
        type: "chat", user: "system", text: "Not connected — try reopening chat.", ts: new Date().toISOString(),
      }]);
      return;
    }
    wsRef.current.send(JSON.stringify({ user: nick, text }));
    setDraft("");
  };

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const statusColor = connState === "open" ? "#4BCF8B" : connState === "connecting" ? "#E6C36B" : "#E67B7B";
  const statusLabel = connState === "open" ? "connected" : connState === "connecting" ? "connecting…" : "disconnected";

  return (
    <div style={{
      position: "absolute", bottom: 20, right: 20, zIndex: 200,
      width: 300, height: 390,
      background: "rgba(10,16,26,0.93)", backdropFilter: "blur(12px)",
      borderRadius: 14, border: `1px solid ${lobbyColor}40`,
      display: "flex", flexDirection: "column",
      fontFamily: "monospace", overflow: "hidden",
      boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px ${lobbyColor}20`,
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px", borderBottom: `1px solid ${lobbyColor}30`,
        background: `${lobbyColor}12`, flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: statusColor,
            boxShadow: connState === "open" ? `0 0 6px ${statusColor}` : "none",
            transition: "background 0.3s" }} />
          <span style={{ color: lobbyColor, fontSize: 12, fontWeight: 700 }}>World Chat</span>
          <span style={{ color: statusColor, fontSize: 9, opacity: 0.8 }}>{statusLabel}</span>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none",
          color: "#6b7d92", fontSize: 14, cursor: "pointer", lineHeight: 1, padding: 0 }}>✕</button>
      </div>

      {/* Nick row */}
      <div style={{ display: "flex", alignItems: "center", gap: 6,
        padding: "6px 10px", borderBottom: `1px solid ${lobbyColor}20`, flexShrink: 0 }}>
        <span style={{ color: "#6b7d92", fontSize: 10 }}>Nick:</span>
        <input
          value={nick}
          onChange={e => setNick(e.target.value.slice(0, 20))}
          style={{ flex: 1, background: "none", border: "none", outline: "none",
            color: lobbyColor, fontSize: 11, fontWeight: 700, fontFamily: "monospace" }}
        />
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px",
        display: "flex", flexDirection: "column", gap: 6 }}>
        {connState === "connecting" && messages.length === 0 && (
          <div style={{ color: "#E6C36B", fontSize: 11, textAlign: "center", marginTop: 40, opacity: 0.7 }}>
            Connecting…
          </div>
        )}
        {connState === "closed" && (
          <div style={{ color: "#E67B7B", fontSize: 11, textAlign: "center", marginTop: 20,
            background: "rgba(230,123,123,0.1)", borderRadius: 8, padding: "10px 12px" }}>
            Could not connect to chat server.<br />
            <span style={{ opacity: 0.7, fontSize: 10 }}>Make sure the backend is running on port 8000.</span>
          </div>
        )}
        {connState === "open" && messages.length === 0 && (
          <div style={{ color: "#3a4a5a", fontSize: 11, textAlign: "center", marginTop: 40 }}>
            No messages yet — say hello!
          </div>
        )}
        {messages.filter(m => m.type === "chat" || m.user === "system").map((m, i) => (
          <div key={i} style={{ fontSize: 11, lineHeight: 1.5 }}>
            <span style={{ color: m.user === "system" ? "#E67B7B" : lobbyColor, fontWeight: 700 }}>
              {m.user}
            </span>
            {m.user !== "system" && (
              <span style={{ color: "#4a5a6a", fontSize: 10, marginLeft: 6 }}>
                {m.ts ? m.ts.slice(11, 16) : ""}
              </span>
            )}
            <div style={{ color: m.user === "system" ? "#E67B7B" : "#c8d8e8", marginTop: 1 }}>
              {m.text}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ display: "flex", gap: 6, padding: "8px 10px",
        borderTop: `1px solid ${lobbyColor}20`, flexShrink: 0 }}>
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={onKey}
          placeholder={connState === "open" ? "Message…" : "Not connected"}
          maxLength={300}
          disabled={connState === "closed"}
          style={{ flex: 1, background: "rgba(255,255,255,0.06)",
            border: `1px solid ${connState === "open" ? `${lobbyColor}30` : "#3a4a5a"}`,
            borderRadius: 8, padding: "6px 10px",
            color: connState === "closed" ? "#3a4a5a" : "#c8d8e8",
            fontSize: 11, outline: "none", fontFamily: "monospace" }}
        />
        <button onClick={send} disabled={connState !== "open"} style={{
          background: connState === "open" ? lobbyColor : "#1a2a3a",
          border: "none", borderRadius: 8, padding: "6px 12px",
          color: connState === "open" ? "#0a1018" : "#3a4a5a",
          fontSize: 12, fontWeight: 800,
          cursor: connState === "open" ? "pointer" : "default",
        }}>↑</button>
      </div>
    </div>
  );
}

let _rid = 0;

const DEFAULT_THEME = {
  sky: "#8ED6FF", fog: "#8ED6FF",
  floorLight: "#F4E7D0", floorDark: "#EAD9BE",
  ambient: "#ffffff", ambientInt: 2.2,
  sun: "#fffcf0", sunInt: 1.8,
  fill: "#DCEBFF", fillInt: 0.75,
  hemiSky: "#8ED6FF", hemiGround: "#c8e6c9",
  bgStyle: "linear-gradient(180deg, #cfe9ff 0%, #f4e7d0 100%)",
};

export default function AgentCity({ lobbyId = "all", lobbyCategories = null, lobbyLabel = "All Worlds", lobbyColor = "#4a9fd4", theme = null }) {
  const T = theme || DEFAULT_THEME;
  const [agents,         setAgents]         = useState([]);
  const [metrics,        setMetrics]        = useState({});
  const [activeAgents,   setActiveAgents]   = useState(new Set());
  const [activeArcs,     setActiveArcs]     = useState(new Set());
  const [lastOutputs,    setLastOutputs]    = useState({});
  const [rewards,        setRewards]        = useState([]);
  const [bubbles,        setBubbles]        = useState({});
  const [selected,       setSelected]       = useState(null);
  const [developers,     setDevelopers]     = useState([]);
  const [celebDevs,      setCelebDevs]      = useState(new Set());
  const [selectedDev,    setSelectedDev]    = useState(null);
  const [toast,          setToast]          = useState(null);
  const [cameraTarget,   setCameraTarget]   = useState(null);
  const [celebrating,    setCelebrating]    = useState(false);
  const [showShare,      setShowShare]      = useState(false);
  const [worldEvent,     setWorldEvent]     = useState(null);
  const [pipelineRoutes, setPipelineRoutes] = useState(new Set());
  const [boardEvents,    setBoardEvents]    = useState([]);
  const [mapMode,        setMapMode]        = useState(false);
  const [selectedShop,      setSelectedShop]      = useState(null);
  const [crowdReaction,     setCrowdReaction]     = useState(null);
  const [positions,         setPositions]         = useState([]);
  const [districtOverflow,  setDistrictOverflow]  = useState({});
  const [subDistrictMap,    setSubDistrictMap]    = useState({});

  const posMap           = useRef({});
  let   _bid = useRef(0);
  const agentsRef        = useRef([]);
  const pipeHistory      = useRef({});
  const pipelineUsageRef = useRef({});
  const [pipelineUsage,  setPipelineUsage]  = useState({});
  const [deployAnnounce, setDeployAnnounce] = useState(null);

  // ── Activity-driven event engine ────────────────────────────────────────────
  const callTimestampsRef   = useRef([]);  // rolling 10s window
  const eventCooldownRef    = useRef(false);
  const activePipelinesRef  = useRef(new Set());
  const [launchPos,  setLaunchPos]  = useState(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showChat,        setShowChat]        = useState(false);
  const [showBattleSetup, setShowBattleSetup] = useState(false);
  const [activeBattle,    setActiveBattle]    = useState(null);  // { pipelineA, pipelineB, scoreA, scoreB, winner, phase, stepEvents, teamAgents }
  const [pipelines,       setPipelines]       = useState([]);
  const [spectatorMode,   setSpectatorMode]   = useState(false);

  const username = useMyUsername();
  const myAgents = useMemo(
    () => new Set(agents.filter(a => a.developer_name === username).map(a => a.id)),
    [agents, username]
  );

  const fireActivityEvent = (type, detail = null, extra = {}) => {
    if (eventCooldownRef.current) return;
    eventCooldownRef.current = true;
    const base = WORLD_EVENTS.find(e => e.type === type) || WORLD_EVENTS[0];
    setWorldEvent({ ...base, detail });
    Object.assign(extra); // extend if needed
    const duration = type === "agent_launch" ? 10000 : 7000;
    setTimeout(() => {
      setWorldEvent(null);
      if (type === "agent_launch") setLaunchPos(null);
      eventCooldownRef.current = false;
    }, duration);
  };

  const showToast = (msg, ms = 4000) => { setToast(msg); setTimeout(() => setToast(null), ms); };

  const handleDistrictClick = (category) => {
    const dc = DISTRICT_CENTERS[category];
    if (dc) setCameraTarget({ x: dc.x, z: dc.z, type: "district" });
    setMapMode(false);
  };

  const handleMiniMapTeleport = (dc) => {
    setCameraTarget({ x: dc.x, z: dc.z, type: "district" });
  };

  const triggerCrowdReaction = (agentId) => {
    const pos   = posMap.current[agentId];
    const agent = agentsRef.current.find(a => a.id === agentId);
    if (!pos || !agent) return;
    setCrowdReaction({ x: pos.x, z: pos.z, color: cat(agent.category).primary });
    setTimeout(() => setCrowdReaction(null), 4000);
  };

  const spawnReward = (agentId) => {
    const pos = posMap.current[agentId]; const agent = agentsRef.current.find(a => a.id === agentId);
    if (!pos || !agent) return;
    const id = ++_rid;
    setRewards(r => [...r, { id, x: pos.x, z: pos.z, text: `+$${agent.price_per_request}`, color: cat(agent.category).primary }]);
    setTimeout(() => setRewards(r => r.filter(x => x.id !== id)), 2800);
  };

  const pushBoardEvent = (agentName, message, color) => {
    const id = ++_bid.current;
    setBoardEvents(ev => [{ id, agentName, message, color }, ...ev].slice(0, 4));
  };

  const spawnBubble = (agentId, output) => {
    const line = Object.entries(output)
      .filter(([k]) => k !== "market" && k !== "agent_id").slice(0, 2)
      .map(([k, v]) => `${k}: ${typeof v === "number" ? (v % 1 ? v.toFixed(2) : v) : String(v).toUpperCase()}`).join("  ");
    if (!line) return;
    setBubbles(b => ({ ...b, [agentId]: line }));
    setTimeout(() => setBubbles(b => { const n = { ...b }; delete n[agentId]; return n; }), 4500);
  };

  useEffect(() => {
    Promise.all([
      fetch(`${API}/agents`).then(r => r.json()),
      fetch(`${API}/metrics`).then(r => r.json()),
    ]).then(([a, m]) => {
      const metricsMap = Object.fromEntries(m.map(x => [x.agent_id, x]));
      agentsRef.current = a; // keep ALL agents for WS event lookups
      const visible = lobbyCategories ? a.filter(ag => lobbyCategories.includes(ag.category)) : a;
      setAgents(visible);
      setMetrics(metricsMap);
      const { positions: pos, districtOverflow: overflow, subDistrictMap: sdm } = layoutAgents(visible, metricsMap);
      setPositions(pos);
      setDistrictOverflow(overflow);
      setSubDistrictMap(sdm);
      visible.forEach((ag, i) => { if (pos[i]) posMap.current[ag.id] = pos[i]; });
    });
    const loadDevs = () => fetch(`${API}/developers`).then(r => r.json()).then(setDevelopers).catch(() => {});
    loadDevs();
    const devInterval = setInterval(loadDevs, 10000);
    fetch(`${API}/pipelines`).then(r => r.json()).then(setPipelines).catch(() => {});
    return () => clearInterval(devInterval);
  }, []);

  // Autonomous background calls
  useEffect(() => {
    if (!agents.length) return;
    const MARKETS = ["BTC", "ETH", "SOL", "AVAX", "BNB"];
    let timer;
    const fire = () => {
      const a = agentsRef.current[Math.floor(Math.random() * agentsRef.current.length)];
      if (a) fetch(`${API}/call-agent/${a.id}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ market: MARKETS[Math.floor(Math.random() * MARKETS.length)] }),
      }).catch(() => {});
      timer = setTimeout(fire, 5000 + Math.random() * 6000);
    };
    timer = setTimeout(fire, 2500);
    return () => clearTimeout(timer);
  }, [agents.length]);

  // World events
  useEffect(() => {
    let timer;
    const fireEvent = () => {
      const ev = WORLD_EVENTS[Math.floor(Math.random() * WORLD_EVENTS.length)];
      setWorldEvent(ev);
      for (let i = 0; i < 3; i++) setTimeout(() => {
        const a = agentsRef.current[Math.floor(Math.random() * agentsRef.current.length)];
        if (a) fetch(`${API}/call-agent/${a.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ market: "BTC" }) }).catch(() => {});
      }, i * 1200);
      setTimeout(() => setWorldEvent(null), 8000 + Math.random() * 5000);
      timer = setTimeout(fireEvent, 18000 + Math.random() * 22000);
    };
    timer = setTimeout(fireEvent, 12000);
    return () => clearTimeout(timer);
  }, []);

  // WebSocket (auto-reconnects on close)
  const [wsRetry, setWsRetry] = useState(0);
  useEffect(() => {
    const ws = new WebSocket(WS);
    ws.onmessage = (e) => {
      const ev = JSON.parse(e.data);
      if (ev.type === "agent_call_start") {
        setActiveAgents(s => new Set([...s, ev.agent_id]));
        const p = posMap.current[ev.agent_id]; if (p) setCameraTarget({ x: p.x, z: p.z });
      }
      if (ev.type === "agent_call_done") {
        setActiveAgents(s => { const n = new Set(s); n.delete(ev.agent_id); return n; });
        setLastOutputs(p => ({ ...p, [ev.agent_id]: ev.result }));
        setMetrics(m => ({ ...m, [ev.agent_id]: ev.metrics }));
        spawnReward(ev.agent_id); spawnBubble(ev.agent_id, ev.result);
        triggerCrowdReaction(ev.agent_id);
        const parts = ev.result ? Object.entries(ev.result).filter(([k]) => k !== "market").slice(0,3).map(([k,v]) => `${k}: ${v}`).join("  ·  ") : "";
        showToast(`${ev.agent_name}  →  ${parts}`);
        const agent = agentsRef.current.find(a => a.id === ev.agent_id);
        pushBoardEvent(ev.agent_name, parts, agent ? cat(agent.category).primary : "#4DA6FF");
        // Developer celebration
        if (agent?.developer_name) {
          setCelebDevs(s => new Set([...s, agent.developer_name]));
          setTimeout(() => setCelebDevs(s => { const n = new Set(s); n.delete(agent.developer_name); return n; }), 4000);
        }
        // ── Activity event detection ──────────────────────────────────────────
        // Signal Storm: 5+ calls in a 10s window
        const now = Date.now();
        callTimestampsRef.current = callTimestampsRef.current.filter(t => now - t < 10000);
        callTimestampsRef.current.push(now);
        const recentCount = callTimestampsRef.current.length;
        if (recentCount >= 5) {
          callTimestampsRef.current = [];
          fireActivityEvent("signal_storm", `${recentCount} calls in 10s`);
        }
        // Revenue Burst: agent earned over $1 in a single call
        if ((ev.metrics?.earnings || 0) > 1) {
          fireActivityEvent("revenue_burst", `${ev.agent_name} earned $${ev.metrics.earnings.toFixed(2)}`);
        }
      }
      if (ev.type === "pipeline_step_start") {
        setActiveAgents(s => new Set([...s, ev.agent_id]));
        if (!pipeHistory.current[ev.pipeline_id]) pipeHistory.current[ev.pipeline_id] = [];
        activePipelinesRef.current.add(ev.pipeline_id);
        const hist = pipeHistory.current[ev.pipeline_id];
        if (hist.length > 0) {
          const key = `${hist[hist.length - 1]}->${ev.agent_id}`;
          setActiveArcs(s => new Set([...s, key]));
          setPipelineRoutes(r => new Set([...r, key]));
          pipelineUsageRef.current[key] = (pipelineUsageRef.current[key] || 0) + 1;
          setPipelineUsage({ ...pipelineUsageRef.current });
          setTimeout(() => setActiveArcs(s => { const n = new Set(s); n.delete(key); return n; }), 3500);
        }
        hist.push(ev.agent_id);
        const p = posMap.current[ev.agent_id]; if (p) setCameraTarget({ x: p.x, z: p.z });
        // Pipeline Race: 2+ concurrent pipelines
        if (activePipelinesRef.current.size >= 2) {
          fireActivityEvent("pipeline_race", `${activePipelinesRef.current.size} pipelines racing`);
        }
      }
      if (ev.type === "pipeline_step_done") {
        setActiveAgents(s => { const n = new Set(s); n.delete(ev.agent_id); return n; });
        setLastOutputs(p => ({ ...p, [ev.agent_id]: ev.output }));
        setMetrics(m => ({ ...m, [ev.agent_id]: ev.metrics }));
        spawnReward(ev.agent_id); spawnBubble(ev.agent_id, ev.output);
        triggerCrowdReaction(ev.agent_id);
      }
      if (ev.type === "pipeline_done") {
        delete pipeHistory.current[ev.pipeline_id];
        activePipelinesRef.current.delete(ev.pipeline_id);
        showToast("✓ Pipeline complete", 4500);
        setTimeout(() => setCameraTarget(null), 5000);
        setCelebrating(true); setTimeout(() => setCelebrating(false), 4000);
        pushBoardEvent("Pipeline", `${ev.pipeline_name} complete ✓`, "#6BCB77");
      }
      // ── Battle events ─────────────────────────────────────────────────────
      if (ev.type === "battle_start") {
        setActiveBattle({
          battleId:  ev.battle_id,
          pipelineA: ev.pipeline_a,
          pipelineB: ev.pipeline_b,
          scoreA:    0,
          scoreB:    0,
          winner:    null,
          phase:     "running",
          stepEvents: [],
          teamAgents: {
            a: new Set(ev.pipeline_a.agent_ids),
            b: new Set(ev.pipeline_b.agent_ids),
          },
        });
        pushBoardEvent("⚔ BATTLE", `${ev.pipeline_a.name} vs ${ev.pipeline_b.name}`, "#FF4D6D");
        showToast(`⚔ Battle: ${ev.pipeline_a.name} vs ${ev.pipeline_b.name}`, 5000);
      }
      if (ev.type === "battle_step") {
        setActiveBattle(prev => {
          if (!prev || prev.battleId !== ev.battle_id) return prev;
          const newScore = ev.team === "a"
            ? { scoreA: Math.max(prev.scoreA, ev.step_score) }
            : { scoreB: Math.max(prev.scoreB, ev.step_score) };
          return {
            ...prev, ...newScore,
            stepEvents: [...prev.stepEvents, {
              team: ev.team, agentName: ev.agent_name,
              stepScore: ev.step_score, color: ev.color,
            }],
          };
        });
        // Flash agent building
        setActiveAgents(s => new Set([...s, ev.agent_id]));
        setTimeout(() => setActiveAgents(s => { const n = new Set(s); n.delete(ev.agent_id); return n; }), 1200);
      }
      if (ev.type === "battle_end") {
        setActiveBattle(prev => prev ? {
          ...prev,
          scoreA: ev.score_a,
          scoreB: ev.score_b,
          winner: ev.winner,
          phase: "done",
        } : null);
        const winName = ev.winner === "tie" ? "TIE"
          : ev.winner === "a" ? ev.pipeline_a_name : ev.pipeline_b_name;
        pushBoardEvent("🏆 BATTLE END", `${winName} wins!`, ev.winner === "a" ? "#FF4D6D" : "#4DA6FF");
        showToast(`🏆 Battle over — ${winName} wins!`, 6000);
        setCelebrating(true); setTimeout(() => setCelebrating(false), 5000);
      }

      // Agent Launch event
      if (ev.type === "agent_registered") {
        const pos = posMap.current[ev.agent_id] || { x: 0, z: 0 };
        setLaunchPos(pos);
        fireActivityEvent("agent_launch", `${ev.agent_name} deployed`);
        pushBoardEvent(ev.agent_name, "NEW AGENT DEPLOYED", "#BB8FCE");
        showToast(`🚀 New agent deployed: ${ev.agent_name}`, 6000);
        // Reload visible agents then set announce with full agent data
        fetch(`${API}/agents`).then(r => r.json()).then(a => {
          agentsRef.current = a;
          const visible = lobbyCategories ? a.filter(ag => lobbyCategories.includes(ag.category)) : a;
          setAgents(visible);
          const newAgent = a.find(ag => ag.id === ev.agent_id) || { name: ev.agent_name, category: "default" };
          setDeployAnnounce(newAgent);
        }).catch(() => { setDeployAnnounce({ name: ev.agent_name, category: "default" }); });
      }
    };
    ws.onerror = () => {};
    ws.onclose = () => setTimeout(() => setWsRetry(n => n + 1), 3000);
    return () => { ws.onclose = null; ws.close(); };
  }, [wsRetry]);


  return (
    <div style={{ width: "100%", height: "100%", position: "relative", background: T.bgStyle }}>
      <Toast msg={toast} />
      <WorldEventBanner event={worldEvent} />
      <HUD selected={selected} metrics={metrics} lastOutputs={lastOutputs} onClose={() => setSelected(null)} />

      {/* Lobby label badge */}
      <div style={{
        position: "absolute", top: 14, left: 14, zIndex: 100,
        display: "flex", alignItems: "center", gap: 7,
        background: `${lobbyColor}18`, border: `1px solid ${lobbyColor}50`,
        borderRadius: 10, padding: "5px 12px",
        pointerEvents: "none",
      }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: lobbyColor }} />
        <span style={{ color: lobbyColor, fontSize: 12, fontWeight: 700, fontFamily: "monospace" }}>
          {lobbyLabel}
        </span>
      </div>

      {/* Mini-map — only visible when not in full map view */}
      {!mapMode && (
        <MiniMap
          agents={agents}
          positions={positions}
          metrics={metrics}
          lobbyColor={lobbyColor}
          onTeleport={handleMiniMapTeleport}
        />
      )}

      {/* Top-right controls */}
      <div style={{
        position: "absolute", top: 14, right: 14, zIndex: 100,
        display: "flex", gap: 8,
      }}>
        <button onClick={() => setShowLeaderboard(s => !s)} style={{
          background: showLeaderboard ? "#FFD700" : "rgba(255,255,255,0.9)",
          color: showLeaderboard ? "#7a5a00" : "#9aabb8",
          border: `2px solid ${showLeaderboard ? "#FFD700" : "#e6d6bd"}`,
          borderRadius: 10, padding: "6px 14px", fontSize: 12, fontWeight: 700,
          cursor: "pointer", fontFamily: "monospace",
        }}>🏆 Ranks</button>
        <button onClick={() => setShowChat(s => !s)} style={{
          background: showChat ? lobbyColor : "rgba(255,255,255,0.9)",
          color: showChat ? "#0a1018" : "#9aabb8",
          border: `2px solid ${showChat ? lobbyColor : "#e6d6bd"}`,
          borderRadius: 10, padding: "6px 14px", fontSize: 12, fontWeight: 700,
          cursor: "pointer", fontFamily: "monospace",
        }}>💬 Chat</button>
        <button onClick={() => {
          fetch(`${API}/pipelines`).then(r => r.json()).then(setPipelines).catch(() => {});
          setShowBattleSetup(true);
        }} style={{
          background: activeBattle ? "linear-gradient(90deg,#FF4D6D,#4DA6FF)" : "rgba(255,255,255,0.9)",
          color: activeBattle ? "#fff" : "#9aabb8",
          border: `2px solid ${activeBattle ? "#FF4D6D" : "#e6d6bd"}`,
          borderRadius: 10, padding: "6px 14px", fontSize: 12, fontWeight: 700,
          cursor: "pointer", fontFamily: "monospace",
        }}>⚔ Battle</button>
        <button onClick={() => setMapMode(m => !m)} style={{
          background: mapMode ? "#4DA6FF" : "rgba(255,255,255,0.9)",
          color: mapMode ? "#fff" : "#4DA6FF",
          border: "2px solid #4DA6FF", borderRadius: 10,
          padding: "6px 16px", fontSize: 12, fontWeight: 700,
          cursor: "pointer", fontFamily: "monospace",
          boxShadow: "0 2px 10px rgba(77,166,255,0.25)",
        }}>{mapMode ? "⬡ Plaza View" : "▦ Map View"}</button>
        <button onClick={() => setSpectatorMode(s => !s)} style={{
          background: spectatorMode ? "#BB8FCE" : "rgba(255,255,255,0.9)",
          color: spectatorMode ? "#fff" : "#BB8FCE",
          border: `2px solid #BB8FCE`, borderRadius: 10,
          padding: "6px 14px", fontSize: 12, fontWeight: 700,
          cursor: "pointer", fontFamily: "monospace",
          boxShadow: spectatorMode ? "0 0 12px #BB8FCE60" : "none",
          transition: "all 0.15s",
        }}>▶ {spectatorMode ? "Stop" : "Watch"}</button>
      </div>

      <button onClick={() => setShowShare(true)} style={{
        position: "absolute", bottom: 20, right: showChat ? 330 : 20, zIndex: 100,
        background: "#4DA6FF", color: "#fff",
        border: "none", borderRadius: 10,
        padding: "8px 18px", fontSize: 12, fontWeight: 700,
        cursor: "pointer", fontFamily: "monospace",
        boxShadow: "0 2px 12px rgba(77,166,255,0.4)",
        transition: "right 0.2s",
      }}>↗ Share City</button>

      {/* Live event board — bottom left */}
      <LiveEventBoard
        worldEvent={worldEvent}
        activePipelineCount={activePipelinesRef.current.size}
        boardEvents={boardEvents}
      />

      {showShare && <ShareCard agents={agents} metrics={metrics} onClose={() => setShowShare(false)} />}
      {selectedShop && (
        <ShopPanel category={selectedShop} agents={agents} metrics={metrics} onClose={() => setSelectedShop(null)} />
      )}
      {selectedDev && (
        <DeveloperProfilePanel developer={selectedDev} onClose={() => setSelectedDev(null)} />
      )}
      {showLeaderboard && (
        <AgentLeaderboardPanel agents={agents} metrics={metrics} onClose={() => setShowLeaderboard(false)} />
      )}
      {showChat && (
        <LobbyChat lobbyId={lobbyId} lobbyColor={lobbyColor} onClose={() => setShowChat(false)} />
      )}
      {showBattleSetup && !activeBattle && (
        <BattleSetup
          pipelines={pipelines}
          onStart={(a, b) => {
            setShowBattleSetup(false);
            fetch(`${API}/battles`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ pipeline_a_id: a, pipeline_b_id: b }),
            }).catch(() => {});
          }}
          onClose={() => setShowBattleSetup(false)}
        />
      )}
      {activeBattle && (
        <BattleScoreboard
          battle={activeBattle}
          onClose={() => setActiveBattle(null)}
        />
      )}

      {spectatorMode ? (
        <div style={{
          position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)",
          background: "rgba(187,143,206,0.18)", border: "1px solid #BB8FCE60",
          borderRadius: 20, padding: "5px 16px",
          color: "#BB8FCE", fontSize: 11, fontFamily: "monospace",
          zIndex: 10, pointerEvents: "none", backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#BB8FCE",
            boxShadow: "0 0 6px #BB8FCE", animation: "none" }} />
          WATCH MODE  ·  camera auto-touring
        </div>
      ) : (
        <div style={{
          position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)",
          color: "rgba(0,0,0,0.3)", fontSize: 11, fontFamily: "monospace", zIndex: 10, pointerEvents: "none",
        }}>scroll to zoom  ·  drag to orbit  ·  click a character to inspect</div>
      )}

      {deployAnnounce && <DeployBanner agent={deployAnnounce} onDone={() => setDeployAnnounce(null)} />}

      {myAgents.size > 0 && (
        <div style={{
          position: "absolute", bottom: 20, right: 20, zIndex: 20,
          background: "rgba(255,255,255,0.92)", border: "1.5px solid #a855f7",
          borderRadius: 10, padding: "7px 14px",
          fontSize: 12, fontWeight: 600, color: "#7e22ce",
          boxShadow: "0 2px 14px #a855f733",
        }}>
          ◈ {myAgents.size} building{myAgents.size !== 1 ? "s" : ""} yours
        </div>
      )}

      <Canvas camera={{ position: [26, 22, 30], fov: 55 }}
        gl={{ antialias: true, toneMappingExposure: 1.1, preserveDrawingBuffer: true }}
        style={{ background: T.sky }}>
        <Suspense fallback={null}>
          <CityScene agents={agents} positions={positions} activeAgents={activeAgents}
            activeArcs={activeArcs} lastOutputs={lastOutputs} metrics={metrics}
            rewards={rewards} bubbles={bubbles} selected={selected} onSelect={setSelected}
            cameraTarget={cameraTarget} anyActive={activeAgents.size > 0}
            celebrating={celebrating} worldEvent={worldEvent} pipelineRoutes={pipelineRoutes}
            boardEvents={boardEvents} mapMode={mapMode}
            onShopClick={setSelectedShop} reactionTarget={crowdReaction}
            districtOverflow={districtOverflow} subDistrictMap={subDistrictMap}
            onDistrictClick={handleDistrictClick}
            developers={developers} celebDevs={celebDevs} onDevSelect={setSelectedDev}
            launchPos={launchPos} theme={T}
            battleTeams={activeBattle?.teamAgents ?? null}
            spectatorMode={spectatorMode}
            pipelineUsage={pipelineUsage}
            myAgents={myAgents}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
