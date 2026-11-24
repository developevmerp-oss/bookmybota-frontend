"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/**
 * 3D "view from your seat". Everything is built from the stadium layout the admin drew:
 * the pitch, every block and every seat position come from the saved layout and event seats,
 * so any stadium drawn in the designer gets its own 3D view without a hand-made model.
 */

export type Seat3D = {
  id: string;
  row_label?: string;
  seat_label?: string;
  coordinate_x?: number | string;
  coordinate_y?: number | string;
  block_id?: string | null;
  tier_id?: string | null;
  section_name?: string;
};

const KX = 0.21; // metres per layout pixel along the pitch length
const KZ = 0.3; // metres per layout pixel across the pitch

function metres(seat: Seat3D): [number, number] {
  return [(Number(seat.coordinate_x) - 800) * KX, (Number(seat.coordinate_y) - 600) * KZ];
}

/** Distance from the pitch edge, so rows climb the further they are from the pitch whatever their letter */
function edgeDistance(seat: Seat3D): number {
  const [x, z] = metres(seat);
  return Math.hypot(Math.max(Math.abs(x) - 52.5, 0), Math.max(Math.abs(z) - 34, 0));
}

/** Seat heights above the pitch: the lower tier climbs from the touchline, the upper tier sits on top of it */
function buildHeights(seats: Seat3D[]): Map<string, number> {
  const minD: Record<string, number> = {};
  seats.forEach((s) => {
    const t = String(s.tier_id || "").toLowerCase() === "lower" ? "lower" : "upper";
    const d = edgeDistance(s);
    minD[t] = Math.min(minD[t] ?? Infinity, d);
  });
  const out = new Map<string, number>();
  seats.forEach((s) => {
    const lower = String(s.tier_id || "").toLowerCase() === "lower";
    const d = edgeDistance(s) - (minD[lower ? "lower" : "upper"] ?? 0);
    out.set(s.id, lower ? 0.9 + d * 0.32 : 9.5 + d * 0.5);
  });
  return out;
}

function Pitch() {
  const lines = useMemo(() => {
    const L = 52.5;
    const W = 34;
    const seg = (pts: Array<[number, number]>) => pts.map(([x, z]) => new THREE.Vector3(x, 0.05, z));
    const circle: THREE.Vector3[] = [];
    for (let a = 0; a <= 360; a += 6) circle.push(new THREE.Vector3(9.15 * Math.cos((a * Math.PI) / 180), 0.05, 9.15 * Math.sin((a * Math.PI) / 180)));
    return [
      seg([[-L, -W], [L, -W], [L, W], [-L, W], [-L, -W]]),
      seg([[0, -W], [0, W]]),
      circle,
      seg([[-L, -20.16], [-36, -20.16], [-36, 20.16], [-L, 20.16]]),
      seg([[L, -20.16], [36, -20.16], [36, 20.16], [L, 20.16]]),
      seg([[-L, -9.16], [-47, -9.16], [-47, 9.16], [-L, 9.16]]),
      seg([[L, -9.16], [47, -9.16], [47, 9.16], [L, 9.16]]),
    ];
  }, []);
  const stripes = useMemo(() => Array.from({ length: 10 }, (_, i) => i), []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[400, 300]} />
        <meshStandardMaterial color="#0f3d22" />
      </mesh>
      {stripes.map((i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[-47.25 + i * 10.5, 0.01, 0]}>
          <planeGeometry args={[10.5, 68]} />
          <meshStandardMaterial color={i % 2 ? "#2f9b46" : "#278a3c"} />
        </mesh>
      ))}
      {lines.map((pts, i) => (
        <line key={i}>
          <bufferGeometry attach="geometry" onUpdate={(g) => g.setFromPoints(pts)} />
          <lineBasicMaterial attach="material" color="#ffffff" />
        </line>
      ))}
      {[-52.5, 52.5].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh position={[0, 1.22, -3.66]}>
            <boxGeometry args={[0.12, 2.44, 0.12]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
          <mesh position={[0, 1.22, 3.66]}>
            <boxGeometry args={[0.12, 2.44, 0.12]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
          <mesh position={[0, 2.44, 0]}>
            <boxGeometry args={[0.12, 0.12, 7.32]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Stands({ seats, selectedId, heights }: { seats: Seat3D[]; selectedId: string | null; heights: Map<string, number> }) {
  const seatRef = useRef<THREE.InstancedMesh>(null);
  const treadRef = useRef<THREE.InstancedMesh>(null);

  const placed = useMemo(
    () =>
      seats.map((s) => {
        const x = (Number(s.coordinate_x) - 800) * KX;
        const z = (Number(s.coordinate_y) - 600) * KZ;
        const y = heights.get(s.id) ?? 1;
        const rot = Math.atan2(-x, -z); // face the centre spot
        return { s, x, y, z, rot, lower: String(s.tier_id || "").toLowerCase() === "lower" };
      }),
    [seats, heights]
  );

  useEffect(() => {
    const m = new THREE.Object3D();
    const c = new THREE.Color();
    placed.forEach((p, i) => {
      if (seatRef.current) {
        m.position.set(p.x, p.y + 0.2, p.z);
        m.rotation.set(0, p.rot, 0);
        m.scale.set(1, 1, 1);
        m.updateMatrix();
        seatRef.current.setMatrixAt(i, m.matrix);
        seatRef.current.setColorAt(i, c.set(p.s.id === selectedId ? "#ffbd24" : p.lower ? "#7c3aed" : "#1d4ed8"));
      }
      if (treadRef.current) {
        m.position.set(p.x, p.y / 2, p.z);
        m.rotation.set(0, p.rot, 0);
        m.scale.set(1, p.y, 1);
        m.updateMatrix();
        treadRef.current.setMatrixAt(i, m.matrix);
      }
    });
    if (seatRef.current) {
      seatRef.current.instanceMatrix.needsUpdate = true;
      if (seatRef.current.instanceColor) seatRef.current.instanceColor.needsUpdate = true;
    }
    if (treadRef.current) treadRef.current.instanceMatrix.needsUpdate = true;
  }, [placed, selectedId]);

  if (placed.length === 0) return null;
  return (
    <group>
      <instancedMesh ref={treadRef} args={[undefined, undefined, placed.length]}>
        <boxGeometry args={[1.1, 1, 1.35]} />
        <meshStandardMaterial color="#8b93a5" />
      </instancedMesh>
      <instancedMesh ref={seatRef} args={[undefined, undefined, placed.length]}>
        <boxGeometry args={[0.55, 0.45, 0.5]} />
        <meshStandardMaterial roughness={0.7} />
      </instancedMesh>
    </group>
  );
}

function pillPath(hw: number, hh: number, r: number, path: THREE.Path) {
  const R = Math.min(r, hh, hw);
  path.moveTo(-hw + R, -hh);
  path.lineTo(hw - R, -hh);
  path.absarc(hw - R, -hh + R, R, -Math.PI / 2, 0, false);
  path.lineTo(hw, hh - R);
  path.absarc(hw - R, hh - R, R, 0, Math.PI / 2, false);
  path.lineTo(-hw + R, hh);
  path.absarc(-hw + R, hh - R, R, Math.PI / 2, Math.PI, false);
  path.lineTo(-hw, -hh + R);
  path.absarc(-hw + R, -hh + R, R, Math.PI, Math.PI * 1.5, false);
  return path;
}

/** Running track around the pitch, like the national stadium */
function Track() {
  const geo = useMemo(() => {
    const shape = pillPath(70, 48, 48, new THREE.Shape() as unknown as THREE.Path) as unknown as THREE.Shape;
    const hole = pillPath(56, 36, 36, new THREE.Path());
    shape.holes.push(hole);
    return new THREE.ShapeGeometry(shape, 48);
  }, []);
  return (
    <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
      <meshStandardMaterial color="#b4543a" />
    </mesh>
  );
}

/** Roof ring over the top of the stands with an open centre, a lattice of beams and gold panels */
function Roof({ maxX, maxZ, top }: { maxX: number; maxZ: number; top: number }) {
  const y = top + 9;
  const geo = useMemo(() => {
    const shape = pillPath(maxX + 10, maxZ + 10, maxZ * 0.9, new THREE.Shape() as unknown as THREE.Path) as unknown as THREE.Shape;
    shape.holes.push(pillPath(maxX * 0.72, maxZ * 0.66, maxZ * 0.6, new THREE.Path()));
    return new THREE.ExtrudeGeometry(shape, { depth: 1.6, bevelEnabled: false, curveSegments: 40 });
  }, [maxX, maxZ]);
  const beams = useMemo(() => {
    const out: Array<{ x: number; z: number; rot: number; len: number }> = [];
    const n = 44;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rx = maxX * 0.85;
      const rz = maxZ * 0.8;
      out.push({ x: Math.cos(a) * rx, z: Math.sin(a) * rz, rot: -a, len: maxX * 0.45 });
    }
    return out;
  }, [maxX, maxZ]);
  return (
    <group position={[0, y, 0]}>
      <mesh geometry={geo} rotation={[Math.PI / 2, 0, 0]} position={[0, 1.6, 0]}>
        <meshStandardMaterial color="#e9e4d4" side={THREE.DoubleSide} />
      </mesh>
      {beams.map((b, i) => (
        <mesh key={i} position={[b.x, -0.3, b.z]} rotation={[0, b.rot, 0]}>
          <boxGeometry args={[b.len, 0.5, 0.5]} />
          <meshStandardMaterial color="#cbd5e1" />
        </mesh>
      ))}
      {beams.map((b, i) => (
        <mesh key={`g${i}`} position={[b.x * 0.92, -0.6, b.z * 0.92]}>
          <sphereGeometry args={[1.4, 8, 6]} />
          <meshStandardMaterial color="#facc15" emissive="#f59e0b" emissiveIntensity={0.7} />
        </mesh>
      ))}
    </group>
  );
}

function Scoreboard({ x, y }: { x: number; y: number }) {
  return (
    <group position={[x, y, 0]} rotation={[0, x > 0 ? -Math.PI / 2 : Math.PI / 2, 0]}>
      <mesh>
        <boxGeometry args={[22, 8, 1]} />
        <meshStandardMaterial color="#0b1224" />
      </mesh>
      <mesh position={[0, 0, 0.6]}>
        <planeGeometry args={[20, 6]} />
        <meshStandardMaterial color="#38bdf8" emissive="#0ea5e9" emissiveIntensity={1.1} />
      </mesh>
    </group>
  );
}

/** A crowd on most seats: coloured shirts and heads, drawn with two instanced meshes */
function Crowd({ seats, heights, skipId }: { seats: Seat3D[]; heights: Map<string, number>; skipId: string | null }) {
  const bodies = useRef<THREE.InstancedMesh>(null);
  const heads = useRef<THREE.InstancedMesh>(null);
  const people = useMemo(
    () =>
      seats
        .filter((s, i) => s.id !== skipId && (i * 7919) % 100 < 72)
        .map((s, i) => {
          const [x, z] = metres(s);
          return { x, z, y: heights.get(s.id) ?? 1, shirt: ["#ef4444", "#facc15", "#22c55e", "#f8fafc", "#2563eb", "#f97316"][i % 6], skin: ["#8d5524", "#c68642", "#5c3a21", "#e0ac69"][i % 4] };
        }),
    [seats, heights, skipId]
  );
  useEffect(() => {
    const m = new THREE.Object3D();
    const c = new THREE.Color();
    people.forEach((p, i) => {
      if (bodies.current) {
        m.position.set(p.x, p.y + 0.75, p.z);
        m.rotation.set(0, 0, 0);
        m.updateMatrix();
        bodies.current.setMatrixAt(i, m.matrix);
        bodies.current.setColorAt(i, c.set(p.shirt));
      }
      if (heads.current) {
        m.position.set(p.x, p.y + 1.35, p.z);
        m.updateMatrix();
        heads.current.setMatrixAt(i, m.matrix);
        heads.current.setColorAt(i, c.set(p.skin));
      }
    });
    [bodies.current, heads.current].forEach((im) => {
      if (!im) return;
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    });
  }, [people]);
  if (people.length === 0) return null;
  return (
    <group>
      <instancedMesh ref={bodies} args={[undefined, undefined, people.length]}>
        <boxGeometry args={[0.55, 0.7, 0.4]} />
        <meshStandardMaterial roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, people.length]}>
        <sphereGeometry args={[0.22, 8, 6]} />
        <meshStandardMaterial roughness={0.9} />
      </instancedMesh>
    </group>
  );
}

function Floodlights() {
  const spots: Array<[number, number]> = [
    [-95, -85],
    [95, -85],
    [-95, 85],
    [95, 85],
  ];
  return (
    <group>
      {spots.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 20, 0]}>
            <cylinderGeometry args={[0.5, 0.8, 40, 8]} />
            <meshStandardMaterial color="#94a3b8" />
          </mesh>
          <mesh position={[0, 41, 0]}>
            <boxGeometry args={[7, 4, 1]} />
            <meshStandardMaterial color="#fef9c3" emissive="#fde68a" emissiveIntensity={1.4} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Camera sits at the seat at eye height and looks at the centre spot; dragging turns the head */
function SeatCamera({ seat, heights }: { seat: Seat3D | null; heights: Map<string, number> }) {
  const { camera } = useThree();
  const controls = useRef<any>(null);
  useEffect(() => {
    const ortho = camera as THREE.PerspectiveCamera;
    ortho.near = 0.1;
    ortho.far = 900;
    ortho.updateProjectionMatrix();
    if (seat) {
      const x = (Number(seat.coordinate_x) - 800) * KX;
      const z = (Number(seat.coordinate_y) - 600) * KZ;
      const y = (heights.get(seat.id) ?? 2) + 1.3;
      camera.position.set(x, y, z);
      const len = Math.hypot(x, z) || 1;
      const t = new THREE.Vector3(x - (x / len) * 0.2, y - 0.03, z - (z / len) * 0.2); // a step towards the pitch
      controls.current?.target.copy(t);
    } else {
      camera.position.set(0, 120, 190);
      controls.current?.target.set(0, 0, 0);
    }
    controls.current?.update();
  }, [seat, camera, heights]);
  return (
    <OrbitControls
      ref={controls}
      enablePan={false}
      enableZoom={false}
      rotateSpeed={-0.35}
      enableDamping
      dampingFactor={0.12}
      minPolarAngle={Math.PI * 0.2}
      maxPolarAngle={Math.PI * 0.62}
    />
  );
}

export default function Stadium3DView({ seats, seat, className = "" }: { seats: Seat3D[]; seat: Seat3D | null; className?: string }) {
  const heights = useMemo(() => buildHeights(seats), [seats]);
  const extent = useMemo(() => {
    let x = 60;
    let z = 45;
    seats.forEach((s) => {
      const [mx, mz] = metres(s);
      x = Math.max(x, Math.abs(mx));
      z = Math.max(z, Math.abs(mz));
    });
    const top = Math.max(12, ...Array.from(heights.values()));
    return { x, z, top };
  }, [seats, heights]);
  return (
    <div className={`relative overflow-hidden bg-[#0b1224] ${className}`}>
      <Canvas dpr={[1, 1.5]} camera={{ fov: 62, position: [0, 120, 190] }} gl={{ antialias: true }}>
        <color attach="background" args={["#7fb4ea"]} />
        <fog attach="fog" args={["#9cc4ee", 200, 700]} />
        <hemisphereLight args={["#bcd2ff", "#10331c", 1.0]} />
        <directionalLight position={[60, 120, 40]} intensity={1.6} />
        <Suspense fallback={null}>
          <Pitch />
          <Track />
          <Stands seats={seats} selectedId={seat?.id || null} heights={heights} />
          <Roof maxX={extent.x} maxZ={extent.z} top={extent.top} />
          <Scoreboard x={-extent.x * 0.75} y={extent.top * 0.7} />
          <Floodlights />
        </Suspense>
        <SeatCamera seat={seat} heights={heights} />
      </Canvas>
      <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white">Drag to look around</div>
    </div>
  );
}
