"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import Stadium3DView, { type Seat3D } from "@/components/EventLandingPage/Stadium3DView";

/**
 * "View from your seat" using the stadium built in Blender (public/models/stadium.glb).
 * public/models/stadium-seats.json holds the position and camera of every bookable seat; each seat
 * of the event is matched to one of them by section and order, so no second set of seats is stored.
 */

type ModelSeat = {
  id: string;
  block: string;
  row: string;
  seat: number;
  position: [number, number, number];
  rotation: number;
  outward?: number;
  camera: [number, number, number];
  lookAt: [number, number, number];
  slot?: number;
};

const seatFiles: Record<string, Promise<ModelSeat[]>> = {};
function loadSeats(model: string): Promise<ModelSeat[]> {
  const file = model === "narendra-modi" ? "narendra-modi-seats" : "stadium-seats";
  if (!seatFiles[file]) seatFiles[file] = fetch(`/models/${file}.json`).then((r) => (r.ok ? r.json() : Promise.reject(new Error("no seat file")))).then((j) => j.seats as ModelSeat[]);
  return seatFiles[file];
}

const COLORS = ["#ef4444", "#facc15", "#22c55e", "#f8fafc", "#2563eb", "#f97316"];

function Model({ model }: { model: string }) {
  const gltf = useGLTF(model === "narendra-modi" ? "/models/narendra-modi.glb" : "/models/stadium.glb");
  return <primitive object={gltf.scene} />;
}

function Crowd({ seats, skipId }: { seats: ModelSeat[]; skipId: string | null }) {
  const bodies = useRef<THREE.InstancedMesh>(null);
  const heads = useRef<THREE.InstancedMesh>(null);
  const people = useMemo(() => seats.filter((s, i) => s.id !== skipId && (i * 7919) % 100 < 70), [seats, skipId]);
  useEffect(() => {
    const m = new THREE.Object3D();
    const c = new THREE.Color();
    people.forEach((p, i) => {
      m.position.set(p.position[0], p.position[1] + 0.75, p.position[2]);
      m.updateMatrix();
      bodies.current?.setMatrixAt(i, m.matrix);
      bodies.current?.setColorAt(i, c.set(COLORS[i % COLORS.length]));
      m.position.set(p.position[0], p.position[1] + 1.3, p.position[2]);
      m.updateMatrix();
      heads.current?.setMatrixAt(i, m.matrix);
      heads.current?.setColorAt(i, c.set(["#8d5524", "#c68642", "#5c3a21", "#e0ac69"][i % 4]));
    });
    [bodies.current, heads.current].forEach((im) => {
      if (!im) return;
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    });
  }, [people]);
  return (
    <group>
      <instancedMesh ref={bodies} args={[undefined, undefined, people.length]}>
        <boxGeometry args={[0.5, 0.65, 0.4]} />
        <meshStandardMaterial roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, people.length]}>
        <sphereGeometry args={[0.2, 8, 6]} />
        <meshStandardMaterial roughness={0.9} />
      </instancedMesh>
    </group>
  );
}

/** Chair-shaped markers (cushion + backrest) in one colour, laid over the model's chairs, facing the pitch */
function ColoredChairs({ seats, color, scale = 1.25 }: { seats: ModelSeat[]; color: string; scale?: number }) {
  const cushion = useRef<THREE.InstancedMesh>(null);
  const back = useRef<THREE.InstancedMesh>(null);
  // a seat that covers several model chairs (rows with fewer seat numbers than chairs) becomes that many real chair shapes
  const items = useMemo(() => {
    const out: { x: number; y: number; z: number; rot: number }[] = [];
    seats.forEach((s) => {
      const [x, y, z] = s.position;
      const rot = s.outward ?? Math.atan2(x, z);
      const w = 0.55 * scale;
      const k = s.slot ? Math.min(8, Math.max(1, Math.round(s.slot / w))) : 1;
      const step = s.slot ? s.slot / k : 0;
      for (let j = 0; j < k; j++) {
        const o = (j - (k - 1) / 2) * step;
        out.push({ x: x + Math.cos(rot) * o, y, z: z - Math.sin(rot) * o, rot });
      }
    });
    return out;
  }, [seats, scale]);
  useEffect(() => {
    const m = new THREE.Object3D();
    items.forEach((s, i) => {
      const base = s.y - 0.23;
      m.rotation.set(0, s.rot, 0);
      m.scale.set(scale, scale, scale);
      m.position.set(s.x, base + 0.42 * scale, s.z);
      m.updateMatrix();
      cushion.current?.setMatrixAt(i, m.matrix);
      const off = new THREE.Vector3(0, 0, 0.26 * scale).applyEuler(m.rotation);
      m.position.set(s.x + off.x, base + 0.66 * scale, s.z + off.z);
      m.updateMatrix();
      back.current?.setMatrixAt(i, m.matrix);
    });
    [cushion.current, back.current].forEach((im) => {
      if (im) im.instanceMatrix.needsUpdate = true;
    });
  }, [items, scale]);
  if (items.length === 0) return null;
  return (
    <group>
      <instancedMesh key={items.length} ref={cushion} args={[undefined, undefined, items.length]}>
        <boxGeometry args={[0.46, 0.13, 0.46]} />
        <meshBasicMaterial color={color} polygonOffset polygonOffsetFactor={-4} polygonOffsetUnits={-4} />
      </instancedMesh>
      <instancedMesh key={`b${items.length}`} ref={back} args={[undefined, undefined, items.length]}>
        <boxGeometry args={[0.46, 0.5, 0.12]} />
        <meshBasicMaterial color={color} polygonOffset polygonOffsetFactor={-4} polygonOffsetUnits={-4} />
      </instancedMesh>
    </group>
  );
}

/** Seats already booked by other people: red chairs */
function Taken({ seats }: { seats: ModelSeat[] }) {
  return <ColoredChairs seats={seats} color="#e11d48" />;
}

/** The seats the customer picked: orange chairs (larger, with a tall beam, in the whole-stadium view) */
function Picked({ seats, tall, skipId }: { seats: ModelSeat[]; tall: boolean; skipId: string | null }) {
  const list = seats.filter((s) => tall || s.id !== skipId);
  return (
    <group>
      <ColoredChairs seats={list} color="#f97316" scale={tall ? 3 : 1.1} />
      {false
        ? list.map((s) => (
            <mesh key={s.id} position={[s.position[0], s.position[1] + 17, s.position[2]]}>
              <boxGeometry args={[0.8, 34, 0.8]} />
              <meshBasicMaterial color="#f97316" />
            </mesh>
          ))
        : null}
    </group>
  );
}

type Pose = { pos: [number, number, number]; look: [number, number, number] } | null;

function Rig({ pose }: { pose: Pose }) {
  const { camera } = useThree();
  const controls = useRef<any>(null);
  useEffect(() => {
    const p = camera as THREE.PerspectiveCamera;
    p.near = 0.1;
    p.far = 1200;
    p.updateProjectionMatrix();
    if (pose) {
      const from = new THREE.Vector3(...pose.pos);
      const to = new THREE.Vector3(...pose.look);
      const dir = to.clone().sub(from).normalize();
      camera.position.copy(from);
      controls.current?.target.copy(from.clone().add(dir.multiplyScalar(0.3)));
    } else {
      camera.position.set(0, 70, 105);
      controls.current?.target.set(0, 0, 0);
    }
    controls.current?.update();
  }, [pose, camera]);
  return (
    <OrbitControls ref={controls} enablePan={false} enableZoom={false} rotateSpeed={-0.35} enableDamping dampingFactor={0.12} minPolarAngle={Math.PI * 0.12} maxPolarAngle={Math.PI * 0.66} />
  );
}

/**
 * Camera for the group of seats the customer picked: in front of the group (towards the pitch), a little above the
 * chairs below, looking at the middle of the group, far enough back to fit every chosen seat in the picture.
 * Works from the seat positions alone, so it suits any stadium layout.
 */
function groupPose(group: ModelSeat[]): Pose {
  if (group.length === 0) return null;
  const c = new THREE.Vector3();
  group.forEach((g) => c.add(new THREE.Vector3(...g.position)));
  c.divideScalar(group.length);
  let span = 1;
  for (const a of group) for (const b of group) span = Math.max(span, new THREE.Vector3(...a.position).distanceTo(new THREE.Vector3(...b.position)));
  const first = group[0];
  const out = first.outward ?? Math.atan2(c.x, c.z);
  const outV = new THREE.Vector3(Math.sin(out), 0, Math.cos(out));
  const dist = Math.max(6, span * 1.15 + 3);
  const pos = c.clone().sub(outV.clone().multiplyScalar(dist));
  pos.y = c.y + 1.6 + Math.min(2.5, span * 0.12);
  return { pos: [pos.x, pos.y, pos.z], look: [c.x, c.y + 0.5, c.z] };
}

export default function StadiumModelView({ seats, seat, className = "", model: modelKey = "football", selected = [], booked = [] }: { seats: Seat3D[]; seat: Seat3D | null; className?: string; model?: string; selected?: Seat3D[]; booked?: Seat3D[] }) {
  const [model, setModel] = useState<ModelSeat[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    loadSeats(modelKey).then(setModel).catch(() => setFailed(true));
  }, [modelKey]);

  // Event seat -> stadium-model seat: same section, same order (row letter, then seat number)
  const mapping = useMemo(() => {
    const map = new Map<string, ModelSeat>();
    if (!model) return map;
    const byBlock = new Map<string, ModelSeat[]>();
    model.forEach((m) => byBlock.set(m.block, [...(byBlock.get(m.block) || []), m]));
    const lerp = (x: any, y: any, t: number): any =>
      Array.isArray(x) ? x.map((v: number, i: number) => v + (y[i] - v) * t) : typeof x === "number" ? x + (y - x) * t : x;
    const byRow = <T,>(list: T[], key: (t: T) => string) => {
      const m = new Map<string, T[]>();
      list.forEach((t) => m.set(key(t), [...(m.get(key(t)) || []), t]));
      return [...m.entries()].sort((p, q) => p[0].localeCompare(q[0], undefined, { numeric: true })).map((e) => e[1]);
    };
    const eventByBlock = new Map<string, Seat3D[]>();
    seats.forEach((s) => eventByBlock.set(String(s.section_name), [...(eventByBlock.get(String(s.section_name)) || []), s]));
    eventByBlock.forEach((list, block) => {
      const target = byBlock.get(block);
      if (!target) return;
      const mRows = byRow(target, (t) => t.row).map((r) => r.sort((p, q) => p.seat - q.seat));
      const eRows = byRow(list, (t) => String(t.row_label)).map((r) => r.sort((p, q) => Number(p.seat_label) - Number(q.seat_label)));
      eRows.forEach((er, ri) => {
        const mr = mRows[eRows.length > 1 ? Math.round((ri * (mRows.length - 1)) / (eRows.length - 1)) : 0];
        if (!mr) return;
        er.forEach((es, si) => {
          // neighbours sit shoulder to shoulder, centred on the middle of the model row
          const fc = (mr.length - 1) / 2;
          const i0 = Math.floor(fc), i1 = Math.min(mr.length - 1, i0 + 1), t = fc - i0;
          const A = mr[i0], B = mr[i1];
          const rot = A.outward ?? Math.atan2(A.position[0], A.position[2]);
          const o = (si - (er.length - 1) / 2) * 0.62;
          const p = lerp(A.position, B.position, t) as [number, number, number];
          map.set(es.id, { ...A, id: es.id, position: [p[0] + Math.cos(rot) * o, p[1], p[2] - Math.sin(rot) * o], camera: lerp(A.camera, B.camera, t), lookAt: lerp(A.lookAt, B.lookAt, t) });
        });
      });
    });
    return map;
  }, [model, seats]);

  const [chosen, setChosen] = useState<"seat" | "group" | "stadium" | null>(null);
  const gone = useMemo(() => booked.map((x) => mapping.get(x.id)).filter(Boolean) as ModelSeat[], [booked, mapping]);
  const mine = useMemo(() => selected.map((x) => mapping.get(x.id)).filter(Boolean) as ModelSeat[], [selected, mapping]);
  const mode: "seat" | "group" | "stadium" = chosen ?? (mine.length > 1 ? "group" : "seat");
  const overview = mode === "stadium";
  const cam = mode === "seat" && seat ? mapping.get(seat.id) || null : null;
  const pose: Pose = mode === "stadium" ? null : mode === "group" ? groupPose(mine) : cam ? { pos: cam.camera, look: cam.lookAt } : null;

  if (failed || (model && seat && mode === "seat" && !cam)) return <Stadium3DView seats={seats} seat={seat} className={className} />;
  if (!model) return <div className={`flex items-center justify-center bg-[#0b1224] text-sm text-slate-400 ${className}`}>Loading stadium…</div>;

  return (
    <div className={`relative overflow-hidden bg-[#0b1224] ${className}`}>
      <Canvas dpr={[1, 1.5]} camera={{ fov: 62, position: [0, 140, 190] }} gl={{ antialias: true }}>
        <color attach="background" args={["#8fb6e8"]} />
        <fog attach="fog" args={["#a9c6ec", 220, 800]} />
        <hemisphereLight args={["#cfe0ff", "#2b3a2f", 1.15]} />
        <directionalLight position={[80, 140, 60]} intensity={2.2} />
        <Suspense fallback={null}>
          <Model model={modelKey} />
          <Taken seats={gone} />
          <Picked seats={mine} tall={overview} skipId={mode === "seat" ? cam?.id || null : null} />
        </Suspense>
        <Rig pose={pose} />
      </Canvas>
      <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white">Drag to look around</div>
      <div className="absolute bottom-3 left-3 flex max-w-[calc(100%-1.5rem)] flex-wrap gap-1.5">
        {([
          ["seat", "From my seat"],
          ...(mine.length > 1 ? [["group", `My ${mine.length} seats`]] : []),
          ["stadium", "Whole stadium"],
        ] as Array<["seat" | "group" | "stadium", string]>).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setChosen(id)}
            className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-bold ${mode === id ? "bg-white text-slate-900" : "bg-black/70 text-white hover:bg-black/85"}`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
