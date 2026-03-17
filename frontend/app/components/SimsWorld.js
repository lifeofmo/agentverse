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

const PLOT  = 15; // plot size
const COLS  = 4;

function layoutAgents(agents) {
  return agents.map((a, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    return {
      ...a,
      x: (col - (COLS - 1) / 2) * PLOT,
      z: (row - 1) * PLOT,
    };
  });
}

function houseColor(cat, seed) {
  const hue = Math.floor(rng(seed) * 360);
  return `hsl(${hue},48%,70%)`;
}
function roofColor(cat, seed) {
  const hue = Math.floor(rng(seed) * 360);
  return `hsl(${hue},48%,52%)`;
}

// ── Green grass neighborhood floor ───────────────────────────────────────────
function SimsFloor() {
  return (
    <>
      {/* Grass */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[300, 300]} />
        <meshLambertMaterial color="#5ab55a" />
      </mesh>
      {/* Roads — horizontal */}
      {[-1, 0, 1, 2].map(row => (
        <mesh key={row} rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.01, (row - 0.5) * PLOT]}>
          <planeGeometry args={[300, 3.5]} />
          <meshLambertMaterial color="#888880" />
        </mesh>
      ))}
      {/* Roads — vertical */}
      {[-2, -1, 0, 1, 2].map(col => (
        <mesh key={col} rotation={[-Math.PI / 2, 0, 0]}
          position={[(col - 0.5) * PLOT, 0.01, 0]}>
          <planeGeometry args={[3.5, 300]} />
          <meshLambertMaterial color="#888880" />
        </mesh>
      ))}
      {/* Sidewalk strips */}
      {[-1, 0, 1, 2].map(row => (
        <mesh key={row} rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.015, (row - 0.5) * PLOT + 2.1]}>
          <planeGeometry args={[300, 0.6]} />
          <meshLambertMaterial color="#c8c0b0" />
        </mesh>
      ))}
    </>
  );
}

// ── Spinning Plumbob — THE Sims icon ─────────────────────────────────────────
function Plumbob({ y = 5, active }) {
  const ref    = useRef();
  const glowRef= useRef();

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (ref.current) {
      ref.current.rotation.y = t * 1.4;
      ref.current.position.y = y + Math.sin(t * 1.8) * 0.18;
    }
    if (glowRef.current) {
      glowRef.current.material.opacity = active
        ? 0.35 + Math.sin(t * 3) * 0.15
        : 0.12 + Math.sin(t * 1.2) * 0.06;
    }
  });

  return (
    <group>
      <group ref={ref}>
        {/* Main diamond — elongated octahedron */}
        <mesh scale={[1, 1.65, 1]}>
          <octahedronGeometry args={[0.42, 0]} />
          <meshLambertMaterial
            color={active ? "#00FF44" : "#22DD44"}
            emissive={active ? "#00cc33" : "#006622"}
            emissiveIntensity={active ? 0.7 : 0.25}
          />
        </mesh>
        {/* Inner highlight */}
        <mesh scale={[0.55, 0.9, 0.55]}>
          <octahedronGeometry args={[0.42, 0]} />
          <meshBasicMaterial color="#aaffbb" transparent opacity={0.5} />
        </mesh>
      </group>
      {/* Glow aura */}
      <mesh ref={glowRef} position={[0, y, 0]}>
        <sphereGeometry args={[0.75, 10, 10]} />
        <meshBasicMaterial color="#00FF44" transparent opacity={0.12} side={THREE.BackSide} />
      </mesh>
      {active && <pointLight position={[0, y, 0]} intensity={2.5} color="#00FF44" distance={8} decay={2} />}
    </group>
  );
}

// ── Sim figure — blocky humanoid ──────────────────────────────────────────────
function SimFigure({ seed, active }) {
  const lLegRef = useRef();
  const rLegRef = useRef();
  const lArmRef = useRef();
  const rArmRef = useRef();
  const bodyRef = useRef();

  const skinColor  = `hsl(${30 + Math.floor(rng(seed + 10) * 20)},55%,${60 + Math.floor(rng(seed+11)*20)}%)`;
  const shirtColor = `hsl(${Math.floor(rng(seed + 20) * 360)},60%,55%)`;
  const pantsColor = `hsl(${Math.floor(rng(seed + 30) * 360)},40%,35%)`;

  useFrame((s) => {
    const t = s.clock.elapsedTime + seed * 2.7;
    const swing = active ? Math.sin(t * 4) * 0.45 : Math.sin(t * 1.2) * 0.08;
    if (lLegRef.current) lLegRef.current.rotation.x =  swing;
    if (rLegRef.current) rLegRef.current.rotation.x = -swing;
    if (lArmRef.current) lArmRef.current.rotation.x = -swing * 0.7;
    if (rArmRef.current) rArmRef.current.rotation.x =  swing * 0.7;
    if (bodyRef.current && active) bodyRef.current.rotation.y = Math.sin(t * 2) * 0.15;
  });

  const BASE = 0.3; // above ground

  return (
    <group position={[1.8, BASE, 1.2]}>
      {/* Legs */}
      <group ref={lLegRef} position={[-0.22, 0.55, 0]}>
        <mesh position={[0, -0.27, 0]}>
          <boxGeometry args={[0.28, 0.55, 0.28]} />
          <meshLambertMaterial color={pantsColor} />
        </mesh>
      </group>
      <group ref={rLegRef} position={[0.22, 0.55, 0]}>
        <mesh position={[0, -0.27, 0]}>
          <boxGeometry args={[0.28, 0.55, 0.28]} />
          <meshLambertMaterial color={pantsColor} />
        </mesh>
      </group>
      {/* Body */}
      <group ref={bodyRef}>
        <mesh position={[0, 1.0, 0]}>
          <boxGeometry args={[0.72, 0.65, 0.38]} />
          <meshLambertMaterial color={shirtColor} />
        </mesh>
        {/* Arms */}
        <group ref={lArmRef} position={[-0.48, 1.05, 0]}>
          <mesh position={[0, -0.22, 0]}>
            <boxGeometry args={[0.22, 0.52, 0.22]} />
            <meshLambertMaterial color={shirtColor} />
          </mesh>
        </group>
        <group ref={rArmRef} position={[0.48, 1.05, 0]}>
          <mesh position={[0, -0.22, 0]}>
            <boxGeometry args={[0.22, 0.52, 0.22]} />
            <meshLambertMaterial color={shirtColor} />
          </mesh>
        </group>
        {/* Head */}
        <mesh position={[0, 1.55, 0]}>
          <boxGeometry args={[0.52, 0.52, 0.48]} />
          <meshLambertMaterial color={skinColor} />
        </mesh>
        {/* Eyes */}
        <mesh position={[-0.13, 1.58, 0.25]}>
          <boxGeometry args={[0.1, 0.09, 0.05]} />
          <meshBasicMaterial color="#222" />
        </mesh>
        <mesh position={[0.13, 1.58, 0.25]}>
          <boxGeometry args={[0.1, 0.09, 0.05]} />
          <meshBasicMaterial color="#222" />
        </mesh>
      </group>
    </group>
  );
}

// ── Single agent house + plot ─────────────────────────────────────────────────
function AgentHouse({ agent, x, z, isActive, isSelected, isMine, onClick, seed }) {
  const W = 5.2, D = 4.4, H = 3.2;
  const wc = houseColor(agent?.category, seed);
  const rc = roofColor(agent?.category, seed);
  const fW = W + 3.0, fD = D + 3.0;

  const windowGlow = isActive ? "#cceeff" : "#aaccdd";
  const windowEmissive = isActive ? "#88bbff" : "#112233";

  return (
    <group position={[x, 0, z]} onClick={onClick}>
      {/* Lawn */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <planeGeometry args={[fW + 1, fD + 1]} />
        <meshLambertMaterial color={isMine ? "#ffe066" : isSelected ? "#6ecc6e" : "#5ab55a"} />
      </mesh>
      {/* isMine: golden glow under lawn */}
      {isMine && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]}>
          <planeGeometry args={[fW + 2.4, fD + 2.4]} />
          <meshBasicMaterial color="#f59e0b" transparent opacity={0.35} />
        </mesh>
      )}

      {/* White picket fence (gold if isMine) */}
      {/* Front + back rails */}
      {[fD/2, -fD/2].map((fz, i) => (
        <group key={i}>
          <mesh position={[0, 0.55, fz]}>
            <boxGeometry args={[fW, 0.1, 0.08]} />
            <meshLambertMaterial color={isMine ? "#f59e0b" : "#f5f0e8"} />
          </mesh>
          <mesh position={[0, 0.85, fz]}>
            <boxGeometry args={[fW, 0.1, 0.08]} />
            <meshLambertMaterial color="#f5f0e8" />
          </mesh>
          {Array.from({ length: 9 }, (_, j) => (
            <mesh key={j} position={[(j / 8 - 0.5) * fW, 0.55, fz]}>
              <boxGeometry args={[0.12, 0.85, 0.08]} />
              <meshLambertMaterial color="#f5f0e8" />
            </mesh>
          ))}
        </group>
      ))}
      {/* Side rails */}
      {[fW/2, -fW/2].map((fx, i) => (
        <group key={i}>
          <mesh position={[fx, 0.55, 0]}>
            <boxGeometry args={[0.08, 0.1, fD]} />
            <meshLambertMaterial color="#f5f0e8" />
          </mesh>
          <mesh position={[fx, 0.85, 0]}>
            <boxGeometry args={[0.08, 0.1, fD]} />
            <meshLambertMaterial color="#f5f0e8" />
          </mesh>
        </group>
      ))}

      {/* Foundation */}
      <mesh position={[0, 0.18, 0]}>
        <boxGeometry args={[W + 0.5, 0.36, D + 0.5]} />
        <meshLambertMaterial color="#d8d0c0" />
      </mesh>

      {/* Walls */}
      <mesh position={[0, H / 2 + 0.36, 0]}>
        <boxGeometry args={[W, H, D]} />
        <meshLambertMaterial color={wc} />
      </mesh>

      {/* Roof */}
      <mesh position={[0, H + 0.36 + 1.0, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[W * 0.78, 2.0, 4]} />
        <meshLambertMaterial color={rc} />
      </mesh>

      {/* Chimney */}
      <mesh position={[W * 0.28, H + 0.36 + 1.4, D * 0.2]}>
        <boxGeometry args={[0.45, 1.2, 0.45]} />
        <meshLambertMaterial color="#9a8070" />
      </mesh>

      {/* Door */}
      <mesh position={[0, 1.2, D / 2 + 0.02]}>
        <boxGeometry args={[0.95, 2.0, 0.06]} />
        <meshLambertMaterial color="#8B5A2B" />
      </mesh>
      {/* Door knob */}
      <mesh position={[0.35, 1.1, D / 2 + 0.06]}>
        <sphereGeometry args={[0.07, 6, 6]} />
        <meshLambertMaterial color="#d4a020" />
      </mesh>

      {/* Windows */}
      {[[-1.5, D / 2 + 0.02], [1.5, D / 2 + 0.02]].map(([wx, wz], i) => (
        <group key={i}>
          <mesh position={[wx, H / 2 + 0.36, wz]}>
            <boxGeometry args={[1.0, 0.95, 0.06]} />
            <meshLambertMaterial color={windowGlow} emissive={windowEmissive} emissiveIntensity={0.6} />
          </mesh>
          {/* Window cross */}
          <mesh position={[wx, H / 2 + 0.36, wz + 0.04]}>
            <boxGeometry args={[1.02, 0.07, 0.04]} />
            <meshLambertMaterial color="#fff" />
          </mesh>
          <mesh position={[wx, H / 2 + 0.36, wz + 0.04]}>
            <boxGeometry args={[0.07, 0.97, 0.04]} />
            <meshLambertMaterial color="#fff" />
          </mesh>
        </group>
      ))}

      {/* Mailbox */}
      <mesh position={[W / 2 + 0.8, 0.72, fD / 2 - 0.8]}>
        <boxGeometry args={[0.38, 0.58, 0.62]} />
        <meshLambertMaterial color="#1a4a8a" />
      </mesh>
      <mesh position={[W / 2 + 0.8, 0.3, fD / 2 - 0.8]}>
        <cylinderGeometry args={[0.06, 0.06, 0.6, 5]} />
        <meshLambertMaterial color="#555" />
      </mesh>

      {/* Tree */}
      <group position={[-W / 2 - 1.2, 0, fD / 2 - 1.0]}>
        <mesh position={[0, 1.0, 0]}>
          <cylinderGeometry args={[0.18, 0.25, 2.0, 6]} />
          <meshLambertMaterial color="#7a5028" />
        </mesh>
        <mesh position={[0, 3.0, 0]}>
          <sphereGeometry args={[1.35, 8, 8]} />
          <meshLambertMaterial color="#3a9a3a" />
        </mesh>
      </group>

      {/* Plumbob */}
      <Plumbob y={H + 3.2} active={isActive} />

      {/* Sim figure */}
      <SimFigure seed={seed} active={isActive} />
    </group>
  );
}

// ── Central park + swimming pool ─────────────────────────────────────────────
function CentralPark() {
  return (
    <group position={[0, 0, 0]}>
      {/* Park grass */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[11, 11]} />
        <meshLambertMaterial color="#4faa4f" />
      </mesh>
      {/* Pool water */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 1.5]}>
        <planeGeometry args={[5.5, 3.5]} />
        <meshLambertMaterial color="#44aadd" />
      </mesh>
      {/* Pool rim */}
      <mesh position={[0, 0.12, 1.5]}>
        <boxGeometry args={[6.0, 0.25, 4.0]} />
        <meshLambertMaterial color="#d0c8b0" />
      </mesh>
      <mesh position={[0, 0.05, 1.5]}>
        <boxGeometry args={[5.5, 0.22, 3.5]} />
        <meshLambertMaterial color="#44aadd" />
      </mesh>
      {/* Pool ladder */}
      <mesh position={[2.55, 0.4, 0.8]}>
        <cylinderGeometry args={[0.06, 0.06, 0.8, 5]} />
        <meshLambertMaterial color="#aaa" />
      </mesh>
      <mesh position={[2.55, 0.4, 1.4]}>
        <cylinderGeometry args={[0.06, 0.06, 0.8, 5]} />
        <meshLambertMaterial color="#aaa" />
      </mesh>
      {/* Park bench */}
      <group position={[-2.5, 0, -1.8]}>
        <mesh position={[0, 0.45, 0]}>
          <boxGeometry args={[1.8, 0.12, 0.5]} />
          <meshLambertMaterial color="#a06830" />
        </mesh>
        <mesh position={[0, 0.22, 0.15]}>
          <boxGeometry args={[1.8, 0.12, 0.12]} />
          <meshLambertMaterial color="#7a5020" />
        </mesh>
        {[-0.7, 0.7].map((bx, i) => (
          <mesh key={i} position={[bx, 0.25, 0]}>
            <boxGeometry args={[0.12, 0.5, 0.5]} />
            <meshLambertMaterial color="#7a5020" />
          </mesh>
        ))}
      </group>
      {/* Fountain */}
      <group position={[2.5, 0, -2.2]}>
        <mesh position={[0, 0.18, 0]}>
          <cylinderGeometry args={[1.0, 1.1, 0.35, 12]} />
          <meshLambertMaterial color="#c8c0b0" />
        </mesh>
        <mesh position={[0, 0.55, 0]}>
          <cylinderGeometry args={[0.12, 0.15, 0.65, 8]} />
          <meshLambertMaterial color="#c8c0b0" />
        </mesh>
        <mesh position={[0, 0.38, 0]}>
          <cylinderGeometry args={[0.95, 0.95, 0.08, 12]} />
          <meshLambertMaterial color="#55aacc" />
        </mesh>
      </group>
    </group>
  );
}

// ── Street lamps ──────────────────────────────────────────────────────────────
const LAMP_POSITIONS = Array.from({ length: 12 }, (_, i) => {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  return {
    x: (col - (COLS - 1) / 2) * PLOT + PLOT / 2 - 1,
    z: (row - 1) * PLOT - PLOT / 2 + 1,
  };
});

function StreetLamps() {
  return (
    <>
      {LAMP_POSITIONS.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]}>
          <mesh position={[0, 2.5, 0]}>
            <cylinderGeometry args={[0.08, 0.12, 5.0, 6]} />
            <meshLambertMaterial color="#555" />
          </mesh>
          <mesh position={[0, 5.1, 0]}>
            <sphereGeometry args={[0.28, 8, 8]} />
            <meshBasicMaterial color="#ffffcc" />
          </mesh>
          <pointLight position={[0, 5.0, 0]} intensity={0.8} color="#ffffaa" distance={10} decay={2} />
        </group>
      ))}
    </>
  );
}

// ── Main 3D scene ─────────────────────────────────────────────────────────────
function SimsScene({ agents, activeAgents, selected, onSelect, positions, myAgents }) {
  return (
    <>
      <color attach="background" args={["#87ceeb"]} />
      <fog attach="fog" color="#b0d8f0" near={55} far={160} />

      {/* Bright daytime lighting */}
      <ambientLight intensity={1.4} color="#fff8f0" />
      <directionalLight position={[20, 40, 15]} intensity={1.8} color="#fff5e0"
        castShadow shadow-mapSize={[1024, 1024]} />
      <hemisphereLight args={["#87ceeb", "#5ab55a", 0.6]} />

      <SimsFloor />
      <CentralPark />
      <StreetLamps />

      {positions.map((p, i) => {
        const agent = agents[i];
        if (!agent) return null;
        return (
          <AgentHouse
            key={agent.id}
            agent={agent}
            x={p.x}
            z={p.z}
            isActive={activeAgents.has(agent.id)}
            isSelected={selected === agent.id}
            isMine={myAgents.has(agent.id)}
            onClick={() => onSelect(agent.id === selected ? null : agent.id)}
            seed={i + 7}
          />
        );
      })}

      <OrbitControls
        makeDefault
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI / 2.2}
        minDistance={10}
        maxDistance={80}
        target={[0, 2, 0]}
      />
      <EffectComposer>
        <Bloom mipmapBlur luminanceThreshold={0.6} luminanceSmoothing={0.4} intensity={0.8} />
      </EffectComposer>
    </>
  );
}

// ── Needs bars UI ─────────────────────────────────────────────────────────────
const NEEDS = ["Mood", "Energy", "Pipeline", "Network", "Uptime"];

function NeedsBar({ label, value }) {
  const color = value > 65 ? "#44cc44" : value > 35 ? "#ddaa22" : "#dd3333";
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
        <span style={{ fontSize: 10, color: "#555", fontWeight: 700, letterSpacing: 0.5 }}>
          {label.toUpperCase()}
        </span>
        <span style={{ fontSize: 10, color, fontWeight: 700 }}>{value}%</span>
      </div>
      <div style={{ height: 8, background: "#ddd", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${value}%`, height: "100%", background: color,
          borderRadius: 4, transition: "width 0.5s" }} />
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function SimsWorld() {
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
            setToasts(t => [...t, { id, text: `${agent.name} completed a task! §${Math.floor(Math.random()*500+100)}` }]);
            setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
          }
          setTimeout(() => setActiveAgents(prev => {
            const next = new Set(prev); next.delete(msg.agent_id); return next;
          }), 5000);
        }
      } catch {}
    };
    ws.onclose = () => setTimeout(() => setWsRetry(n => n + 1), 3000);
    return () => ws.close();
  }, [wsRetry, agents]);

  const selectedAgent = selected ? agents.find(a => a.id === selected) : null;
  const needs = useMemo(() => selectedAgent
    ? NEEDS.map((n, i) => ({ label: n, value: 40 + Math.floor(rng(selectedAgent.id * 7 + i) * 55) }))
    : [], [selectedAgent]);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", fontFamily: "sans-serif" }}>
      <Canvas camera={{ position: [0, 28, 32], fov: 55 }} gl={{ antialias: true }}>
        <SimsScene
          agents={agents}
          activeAgents={activeAgents}
          selected={selected}
          onSelect={setSelected}
          positions={positions}
          myAgents={myAgents}
        />
      </Canvas>

      {/* Toast notifications */}
      <div style={{ position: "absolute", top: 16, right: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background: "#fff", border: "2px solid #44cc44",
            borderRadius: 8, padding: "8px 14px",
            fontSize: 12, fontWeight: 600, color: "#2a4a2a",
            boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
            animation: "fadeIn 0.3s ease",
          }}>
            🏠 {t.text}
          </div>
        ))}
      </div>

      {/* § Simoleons counter */}
      <div style={{
        position: "absolute", top: 16, left: 16,
        background: "#fff", borderRadius: 10, padding: "8px 14px",
        border: "2px solid #44cc44", fontSize: 13, fontWeight: 800,
        color: "#2a4a2a", boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
      }}>
        § {(agents.length * 1247 + activeAgents.size * 500).toLocaleString()}
      </div>

      {/* Selected agent panel */}
      {selectedAgent && (
        <div style={{
          position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: "#fff", border: "2px solid #44cc44",
          borderRadius: 12, padding: "16px 22px",
          maxWidth: 380, width: "90%",
          boxShadow: "0 6px 28px rgba(0,0,0,0.15)",
          display: "flex", gap: 16,
        }}>
          {/* Portrait */}
          <div style={{
            width: 54, height: 54, borderRadius: 10, flexShrink: 0,
            background: `hsl(${Math.floor(rng(selectedAgent.id) * 360)},50%,70%)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, border: "2px solid #44cc44",
          }}>
            🧑
          </div>
          {/* Info */}
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: "#2a4a2a", marginBottom: 2 }}>
              {selectedAgent.name}
            </div>
            <div style={{ fontSize: 10, color: "#888", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.8 }}>
              {selectedAgent.category} Agent
            </div>
            {needs.map(n => <NeedsBar key={n.label} label={n.label} value={n.value} />)}
          </div>
          <button onClick={() => setSelected(null)} style={{
            position: "absolute", top: 10, right: 12,
            background: "none", border: "none", fontSize: 16,
            cursor: "pointer", color: "#aaa",
          }}>✕</button>
        </div>
      )}

      {/* My Agents badge */}
      {myAgents.size > 0 && (
        <div style={{
          position: "absolute", bottom: 22, right: 22,
          background: "#fff", border: "2px solid #f59e0b",
          borderRadius: 10, padding: "8px 16px",
          fontSize: 12, fontWeight: 700, color: "#92400e",
          boxShadow: "0 4px 16px rgba(245,158,11,0.25)",
        }}>
          🏠 {myAgents.size} home{myAgents.size !== 1 ? "s" : ""} yours
        </div>
      )}

      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; } }`}</style>
    </div>
  );
}
