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
    const ring  = Math.floor(i / 7);
    const slot  = i % 7;
    const r     = 9 + ring * 7;
    const angle = (slot / 7) * Math.PI * 2 + ring * 0.45;
    return { ...a, x: Math.cos(angle) * r, z: Math.sin(angle) * r };
  });
}

// ── 2D Matrix character rain overlay ─────────────────────────────────────────
const MATRIX_CHARS = 'ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ012345789:.=+-|∇∆⊕⊗';

function MatrixRain() {
  const ref = useRef();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const W = canvas.parentElement?.clientWidth  || window.innerWidth;
    const H = canvas.parentElement?.clientHeight || window.innerHeight;
    canvas.width  = W;
    canvas.height = H;

    const ctx    = canvas.getContext('2d');
    const SZ     = 15;
    const cols   = Math.floor(W / SZ);
    const drops  = Array.from({ length: cols }, () => -(Math.random() * 80));
    const speeds = Array.from({ length: cols }, () => 0.4 + Math.random() * 0.5);

    let raf, frame = 0;

    function tick() {
      frame++;
      raf = requestAnimationFrame(tick);
      if (frame % 2 !== 0) return; // ~30 fps

      // Fade everything toward black — creates the trail
      ctx.fillStyle = 'rgba(0,0,0,0.055)';
      ctx.fillRect(0, 0, W, H);

      ctx.font = `bold ${SZ - 1}px monospace`;

      for (let i = 0; i < cols; i++) {
        const y = drops[i] * SZ;
        const char = MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];

        // Leading character — bright white-green
        ctx.fillStyle = '#c8ffd4';
        ctx.fillText(char, i * SZ, y);

        // 4 trailing characters above — fading green
        for (let j = 1; j <= 4; j++) {
          const alpha = 1 - j * 0.22;
          const g     = Math.floor(200 * alpha);
          ctx.fillStyle = `rgba(0,${g},${Math.floor(g * 0.28)},${alpha})`;
          ctx.fillText(
            MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)],
            i * SZ, y - j * SZ
          );
        }

        if (y > H && Math.random() > 0.972) drops[i] = 0;
        drops[i] += speeds[i];
      }
    }

    tick();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas ref={ref} style={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
      opacity: 0.38, mixBlendMode: 'screen',
    }} />
  );
}

// ── "Wake up, Neo..." typewriter intro ────────────────────────────────────────
const INTRO_TEXT = "Wake up, Neo...";

function WakeUpNeo() {
  const [shown,  setShown]  = useState('');
  const [fading, setFading] = useState(false);
  const [gone,   setGone]   = useState(false);

  useEffect(() => {
    let i = 0;
    const type = setInterval(() => {
      i++;
      setShown(INTRO_TEXT.slice(0, i));
      if (i >= INTRO_TEXT.length) {
        clearInterval(type);
        setTimeout(() => setFading(true), 2200);
        setTimeout(() => setGone(true),   3800);
      }
    }, 90);
    return () => clearInterval(type);
  }, []);

  if (gone) return null;

  return (
    <div style={{
      position: 'absolute', top: '38%', left: '50%',
      transform: 'translate(-50%, -50%)',
      color: '#00FF41', fontFamily: 'monospace',
      fontSize: 28, letterSpacing: 6, whiteSpace: 'nowrap',
      textShadow: '0 0 18px #00FF41, 0 0 45px #00b830',
      pointerEvents: 'none', userSelect: 'none',
      opacity: fading ? 0 : 1, transition: 'opacity 1.6s',
    }}>
      {shown}{shown.length < INTRO_TEXT.length && <span style={{ opacity: 0.7 }}>_</span>}
    </div>
  );
}

// ── Matrix floor — black with green grid ─────────────────────────────────────
function MatrixFloor() {
  const tex = useMemo(() => {
    const sz  = 512;
    const cnv = document.createElement("canvas");
    cnv.width = cnv.height = sz;
    const ctx = cnv.getContext("2d");
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, sz, sz);
    ctx.strokeStyle = "#003800";
    ctx.lineWidth = 0.9;
    const cells = 16;
    const step  = sz / cells;
    for (let i = 0; i <= cells; i++) {
      ctx.beginPath(); ctx.moveTo(i * step, 0); ctx.lineTo(i * step, sz); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * step); ctx.lineTo(sz, i * step); ctx.stroke();
    }
    // Brighter major grid lines every 4 cells
    ctx.strokeStyle = "#006600";
    ctx.lineWidth = 1.5;
    for (let i = 0; i <= cells; i += 4) {
      ctx.beginPath(); ctx.moveTo(i * step, 0); ctx.lineTo(i * step, sz); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * step); ctx.lineTo(sz, i * step); ctx.stroke();
    }
    const t = new THREE.CanvasTexture(cnv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(16, 16);
    return t;
  }, []);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
      <planeGeometry args={[400, 400]} />
      <meshBasicMaterial map={tex} />
    </mesh>
  );
}

// ── Code towers at perimeter ──────────────────────────────────────────────────
const TOWER_POS = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * Math.PI * 2;
  return { x: Math.cos(a) * 58, z: Math.sin(a) * 58, seed: i * 11 };
});

function CodeTower({ x, z, seed }) {
  const ref   = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const drops = useRef(
    Array.from({ length: 22 }, (_, i) => ({
      y:     rng(seed + i) * 28,
      speed: rng(seed + i + 100) * 0.09 + 0.02,
      len:   rng(seed + i + 200) * 7 + 2,
      tick:  0,
    }))
  );

  useFrame(() => {
    const m = ref.current; if (!m) return;
    drops.current.forEach((d, i) => {
      d.y -= d.speed;
      if (d.y < -5) { d.tick++; d.y = 28 + rng(seed + i + d.tick * 991) * 8; }
      dummy.position.set(0, d.y, 0);
      dummy.scale.set(1, d.len, 1);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <group position={[x, 0, z]}>
      <instancedMesh ref={ref} args={[null, null, 22]}>
        <planeGeometry args={[0.11, 1]} />
        <meshBasicMaterial color="#00FF41" transparent opacity={0.65}
          side={THREE.DoubleSide} depthWrite={false} />
      </instancedMesh>
    </group>
  );
}

// ── The Construct — central rotating wireframe dodecahedron ──────────────────
const DODEC_OUTER_GEO = new THREE.EdgesGeometry(new THREE.DodecahedronGeometry(3.8, 0));
const DODEC_INNER_GEO = new THREE.EdgesGeometry(new THREE.DodecahedronGeometry(2.2, 0));
const ICOSA_GEO       = new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.2, 0));

function TheConstruct() {
  const outerRef = useRef();
  const innerRef = useRef();
  const coreRef  = useRef();
  const glowRef  = useRef();

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (outerRef.current) { outerRef.current.rotation.y = t * 0.18; outerRef.current.rotation.x = t * 0.09; }
    if (innerRef.current) { innerRef.current.rotation.y = -t * 0.28; innerRef.current.rotation.z = t * 0.12; }
    if (coreRef.current)  { coreRef.current.rotation.x = t * 0.35; coreRef.current.rotation.y = t * 0.22; }
    if (glowRef.current)  { glowRef.current.material.opacity = 0.08 + Math.sin(t * 1.8) * 0.05; }
  });

  return (
    <group position={[0, 6, 0]}>
      <lineSegments ref={outerRef} geometry={DODEC_OUTER_GEO}>
        <lineBasicMaterial color="#00FF41" />
      </lineSegments>
      <lineSegments ref={innerRef} geometry={DODEC_INNER_GEO}>
        <lineBasicMaterial color="#00aa22" transparent opacity={0.7} />
      </lineSegments>
      <lineSegments ref={coreRef} geometry={ICOSA_GEO}>
        <lineBasicMaterial color="#c8ffd4" />
      </lineSegments>
      {/* Glow aura */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[5.5, 16, 16]} />
        <meshBasicMaterial color="#00FF41" transparent opacity={0.08} side={THREE.BackSide} />
      </mesh>
      <pointLight intensity={5} color="#00FF41" distance={22} decay={2} />
    </group>
  );
}

// ── Ground scanline pulse — ring expanding from center ────────────────────────
function ScanPulse() {
  const ref  = useRef();
  const tick = useRef(0);

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (!ref.current) return;
    const r = (t * 8) % 55;
    ref.current.scale.setScalar(r);
    ref.current.material.opacity = Math.max(0, 0.35 * (1 - r / 55));
  });

  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
      <ringGeometry args={[0.98, 1.0, 64]} />
      <meshBasicMaterial color="#00FF41" transparent opacity={0.3} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ── Category accent colors ─────────────────────────────────────────────────────
const CAT_ACCENT = {
  trading:   { hi: "#00FF41", mid: "#00cc33", lo: "#004400", dark: "#001800", pip: "#c8ffd4" },
  data:      { hi: "#41b4ff", mid: "#2288dd", lo: "#003a5c", dark: "#001628", pip: "#b8e4ff" },
  analysis:  { hi: "#c084fc", mid: "#9333ea", lo: "#3b0764", dark: "#1a0030", pip: "#e9d5ff" },
  risk:      { hi: "#ff6b6b", mid: "#dc2626", lo: "#5a0000", dark: "#200000", pip: "#fecaca" },
  composite: { hi: "#fbbf24", mid: "#d97706", lo: "#4a2800", dark: "#1c0a00", pip: "#fef3c7" },
};
const catAccent = (c) => CAT_ACCENT[c] ?? CAT_ACCENT.trading;

// ── Agent construct — floating wireframe data node ────────────────────────────
const BOX_EDGES = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.9, 2.5, 1.9));

function AgentConstruct({ agent, x, z, isActive, isSelected, isMine, onClick }) {
  const groupRef = useRef();
  const shellRef = useRef();
  const ringRef  = useRef();
  const [hov, setHov] = useState(false);
  const ac = catAccent(agent?.category);

  useFrame((s, dt) => {
    const t = s.clock.elapsedTime;
    const baseY = 1.6;
    if (groupRef.current) {
      groupRef.current.position.y = baseY + Math.sin(t * 0.55 + x * 0.28) * 0.22;
      groupRef.current.rotation.y += dt * (isActive ? 1.4 : 0.18);
    }
    if (shellRef.current) {
      shellRef.current.material.opacity = isActive
        ? 0.30 + Math.sin(t * 2.8) * 0.18
        : hov ? 0.12 : 0.04;
    }
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 1.5;
      ringRef.current.material.opacity = 0.4 + Math.sin(t * 3) * 0.3;
    }
  });

  const lit = isActive || hov || isSelected;

  return (
    <group position={[x, 0, z]}
      onClick={onClick}
      onPointerEnter={() => setHov(true)}
      onPointerLeave={() => setHov(false)}>
      <group ref={groupRef}>
        {/* Dark body */}
        <mesh>
          <boxGeometry args={[1.9, 2.5, 1.9]} />
          <meshLambertMaterial color="#010801" emissive={ac.dark} emissiveIntensity={1.0} />
        </mesh>
        {/* Wireframe edges — category color */}
        <lineSegments geometry={BOX_EDGES}>
          <lineBasicMaterial color={isActive ? ac.hi : lit ? ac.mid : ac.lo} />
        </lineSegments>
        {/* Glow shell */}
        <mesh ref={shellRef}>
          <boxGeometry args={[2.2, 2.9, 2.2]} />
          <meshBasicMaterial color={ac.hi} transparent opacity={0.04} side={THREE.BackSide} />
        </mesh>
        {/* Front screen panels */}
        <mesh position={[0,  0.35, 0.96]}>
          <planeGeometry args={[1.3, 0.65]} />
          <meshBasicMaterial color={isActive ? ac.hi : ac.dark} transparent opacity={0.95} />
        </mesh>
        <mesh position={[0, -0.45, 0.96]}>
          <planeGeometry args={[1.3, 0.38]} />
          <meshBasicMaterial color={isActive ? ac.mid : ac.dark} transparent opacity={0.85} />
        </mesh>
        {/* Small corner pips */}
        {[[-0.72, 0.95], [0.72, 0.95], [-0.72, -0.95], [0.72, -0.95]].map(([px, py], i) => (
          <mesh key={i} position={[px, py, 0.97]}>
            <planeGeometry args={[0.14, 0.14]} />
            <meshBasicMaterial color={isActive ? ac.pip : ac.lo} transparent opacity={0.9} />
          </mesh>
        ))}
        {isActive && <pointLight intensity={3.5} color={ac.hi} distance={9} decay={2} />}
      </group>
      {/* isMine: purple ground ring */}
      {isMine && (
        <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.3, 0]}>
          <ringGeometry args={[1.2, 1.8, 24]} />
          <meshBasicMaterial color="#7c3aed" transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
      )}
      {/* isMine: small purple marker above */}
      {isMine && (
        <mesh position={[0, 4.2, 0]}>
          <octahedronGeometry args={[0.28, 0]} />
          <meshBasicMaterial color="#a855f7" />
        </mesh>
      )}
    </group>
  );
}

// ── Connection line between agents ────────────────────────────────────────────
function DataStream({ x1, z1, x2, z2, active }) {
  const ref = useRef();
  useFrame((s) => {
    if (ref.current) ref.current.material.opacity = active
      ? 0.5 + Math.sin(s.clock.elapsedTime * 3) * 0.3
      : 0.08;
  });

  const points = [new THREE.Vector3(x1, 1.6, z1), new THREE.Vector3(x2, 1.6, z2)];
  const geo    = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [x1, z1, x2, z2]);

  return (
    <line ref={ref} geometry={geo}>
      <lineBasicMaterial color="#00FF41" transparent opacity={0.08} />
    </line>
  );
}

// ── Main 3D scene ─────────────────────────────────────────────────────────────
function MatrixScene({ agents, activeAgents, selected, onSelect, positions, myAgents }) {
  return (
    <>
      <color attach="background" args={["#000000"]} />
      <fog attach="fog" color="#000000" near={70} far={190} />
      <ambientLight intensity={0.04} color="#001100" />

      <MatrixFloor />
      <ScanPulse />
      <TheConstruct />

      {TOWER_POS.map((t, i) => <CodeTower key={i} {...t} />)}

      {/* Agent connection web */}
      {positions.slice(0, 18).map((p, i) => {
        const next = positions[(i + 1) % Math.min(positions.length, 18)];
        if (!next) return null;
        const active = activeAgents.has(agents[i]?.id) || activeAgents.has(agents[(i+1) % agents.length]?.id);
        return <DataStream key={i} x1={p.x} z1={p.z} x2={next.x} z2={next.z} active={active} />;
      })}

      {positions.map((p, i) => {
        const ag = agents[i];
        if (!ag) return null;
        return (
          <AgentConstruct
            key={ag.id}
            agent={ag}
            x={p.x}
            z={p.z}
            isActive={activeAgents.has(ag.id)}
            isSelected={selected === ag.id}
            isMine={myAgents.has(ag.id)}
            onClick={() => onSelect(ag.id === selected ? null : ag.id)}
          />
        );
      })}

      <OrbitControls
        makeDefault
        minPolarAngle={0.1}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={8}
        maxDistance={90}
        target={[0, 2, 0]}
      />
      <EffectComposer>
        <Bloom mipmapBlur luminanceThreshold={0.05} luminanceSmoothing={0.25} intensity={2.2} />
      </EffectComposer>
    </>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function MatrixWorld() {
  const [agents,      setAgents]      = useState([]);
  const [activeAgents,setActiveAgents]= useState(new Set());
  const [selected,    setSelected]    = useState(null);
  const [wsRetry,     setWsRetry]     = useState(0);
  const [event,       setEvent]       = useState(null);

  const username = useMyUsername();
  const myAgents = useMemo(
    () => new Set(agents.filter(a => a.developer_name === username).map(a => a.id)),
    [agents, username]
  );

  const positions = useMemo(() => layoutAgents(agents), [agents]);

  useEffect(() => {
    fetch(`${API}/agents`)
      .then(r => r.json())
      .then(setAgents)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const ws = new WebSocket(WS);
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "agent_active") {
          setActiveAgents(prev => new Set([...prev, msg.agent_id]));
          setTimeout(() => setActiveAgents(prev => {
            const next = new Set(prev); next.delete(msg.agent_id); return next;
          }), 4500);
        }
        if (msg.type === "pipeline_complete") {
          setEvent(msg.pipeline_id);
          setTimeout(() => setEvent(null), 3500);
        }
      } catch {}
    };
    ws.onclose = () => setTimeout(() => setWsRetry(n => n + 1), 3000);
    return () => ws.close();
  }, [wsRetry]);

  const selectedAgent = selected ? agents.find(a => a.id === selected) : null;

  return (
    <div style={{ width: "100%", height: "100%", background: "#000", position: "relative", fontFamily: "monospace" }}>
      <Canvas camera={{ position: [0, 20, 30], fov: 58 }} gl={{ antialias: true }}>
        <MatrixScene
          agents={agents}
          activeAgents={activeAgents}
          selected={selected}
          onSelect={setSelected}
          positions={positions}
          myAgents={myAgents}
        />
      </Canvas>

      {/* Actual katakana character rain */}
      <MatrixRain />

      {/* Green tint */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "rgba(0,18,0,0.13)",
      }} />

      {/* CRT scanlines */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,0.07) 1px, rgba(0,0,0,0.07) 2px)",
      }} />

      {/* Intro typewriter */}
      <WakeUpNeo />

      {/* Corner terminal readout */}
      <div style={{
        position: "absolute", top: 16, left: 16, color: "#00FF41",
        fontSize: 11, lineHeight: 2.0, opacity: 0.7, pointerEvents: "none",
        textShadow: "0 0 8px #00FF41",
      }}>
        <div>AGENTVERSE // MATRIX</div>
        <div>NODES ONLINE: {agents.length}</div>
        <div>ACTIVE PROCESSES: {activeAgents.size}</div>
        <div>SYS: {new Date().toTimeString().slice(0,8)}</div>
      </div>

      {/* Pipeline event banner */}
      {event && (
        <div style={{
          position: "absolute", top: 18, left: "50%", transform: "translateX(-50%)",
          color: "#00FF41", fontSize: 12, letterSpacing: 3,
          textShadow: "0 0 14px #00FF41", pointerEvents: "none", whiteSpace: "nowrap",
        }}>
          ▶ PIPELINE COMPLETE: {event.toUpperCase()} ◀
        </div>
      )}

      {/* Selected agent panel */}
      {selectedAgent && (
        <div style={{
          position: "absolute", bottom: 28, left: "50%", transform: "translateX(-50%)",
          background: "rgba(0,8,0,0.94)", border: "1px solid #00FF41",
          borderRadius: 6, padding: "16px 26px", color: "#00FF41",
          maxWidth: 360, width: "90%",
          boxShadow: "0 0 24px #00FF4128, inset 0 0 20px #00FF4108",
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>
            // {selectedAgent.name.toUpperCase()}
          </div>
          <div style={{ fontSize: 10, opacity: 0.65, lineHeight: 1.7 }}>
            {selectedAgent.description}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <div style={{
              fontSize: 10, padding: "3px 10px", border: "1px solid #00FF4166",
              borderRadius: 3, color: "#00FF4199",
            }}>
              CATEGORY: {selectedAgent.category?.toUpperCase()}
            </div>
            <button onClick={() => setSelected(null)} style={{
              marginLeft: "auto", background: "none", border: "1px solid #00FF41",
              color: "#00FF41", cursor: "pointer", padding: "3px 12px",
              borderRadius: 3, fontSize: 10, letterSpacing: 1,
            }}>
              DISCONNECT
            </button>
          </div>
        </div>
      )}

      {/* My Agents badge */}
      {myAgents.size > 0 && (
        <div style={{
          position: "absolute", bottom: 22, right: 22,
          background: "rgba(0,8,0,0.88)", border: "1px solid #7c3aed",
          borderRadius: 6, padding: "8px 16px", color: "#a855f7",
          fontSize: 11, letterSpacing: 1,
          boxShadow: "0 0 14px #7c3aed44",
        }}>
          ◈ {myAgents.size} NODE{myAgents.size !== 1 ? "S" : ""} YOURS
        </div>
      )}
    </div>
  );
}
