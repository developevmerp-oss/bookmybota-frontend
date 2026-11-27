"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Minus, Plus } from "lucide-react";

/**
 * Live 3D view for custom layouts (basketball arena, concert hall, stage shows).
 * No model file is needed: the bowl is built from the same seat positions the 2D map uses, so a
 * layout the admin draws always has a matching 3D view. Chairs rise away from the focus (court / stage).
 */

type Seat = { id: string; section_name?: string; row_label?: string; seat_label?: string; coordinate_x?: number | string; coordinate_y?: number | string; status?: string };
type Obj = { id: string; type: string; name?: string; x: number; y: number; w: number; h: number; rotation?: number; capacity?: number };

const S = 0.1; // map pixels -> metres
const RISE = 0.5; // chair height gained per metre away from the focus

export default function ArenaModelView({
  seats,
  seat,
  selected = [],
  booked = [],
  layout,
  className = "",
}: {
  seats: Seat[];
  seat: Seat | null;
  selected?: Seat[];
  booked?: Seat[];
  layout: { objects?: Obj[]; arena_kind?: string };
  className?: string;
}) {
  const objects = layout.objects || [];
  const focus = objects.find((o) => o.type === "pitch") || objects.find((o) => o.type === "stage") || objects.find((o) => o.type === "ground") || null;
  const stage = objects.find((o) => o.type === "stage") || null;
  const court = objects.find((o) => o.type === "pitch") || null;
  const fx = focus?.x ?? 800;
  const fy = focus?.y ?? 600;

  const placed = useMemo(() => {
    const standingBlocks = new Set(objects.filter((o) => o.type === "standing").map((o) => o.id));
    const raw = seats
      .filter((s) => s.row_label !== "GA" && Number.isFinite(Number(s.coordinate_x)))
      .map((s) => {
        const x = (Number(s.coordinate_x) - fx) * S;
        const z = (Number(s.coordinate_y) - fy) * S;
        return { s, x, z, d: Math.hypot(x, z) };
      })
      .filter((p) => !standingBlocks.has(String((p.s as any).block_id)));
    const dmin = raw.length ? Math.min(...raw.map((p) => p.d)) : 0;
    // stepped stands: each block starts higher the further it is from the court, and every row is one step up
    const blockD = new Map<string, number>();
    const rowsOf = new Map<string, string[]>();
    raw.forEach((p) => {
      const b = String((p.s as any).block_id);
      blockD.set(b, Math.min(blockD.get(b) ?? 1e9, p.d));
      const a = rowsOf.get(b) || [];
      const r = String(p.s.row_label);
      if (!a.includes(r)) a.push(r);
      rowsOf.set(b, a);
    });
    rowsOf.forEach((a) => a.sort((x, y) => x.length - y.length || x.localeCompare(y)));
    return raw.map((p) => {
      const b = String((p.s as any).block_id);
      return { ...p, y: 0.5 + ((blockD.get(b) ?? dmin) - dmin) * RISE + (rowsOf.get(b)?.indexOf(String(p.s.row_label)) ?? 0) * 0.5 };
    });
  }, [seats, objects, fx, fy]);

  const byId = useMemo(() => new Map(placed.map((p) => [String(p.s.id), p])), [placed]);
  const goneIds = useMemo(() => new Set(booked.map((b) => String(b.id))), [booked]);
  const pickedIds = useMemo(() => new Set(selected.map((b) => String(b.id))), [selected]);
  const [mode, setMode] = useState<"seat" | "all">("seat");
  const mine = seat ? byId.get(String(seat.id)) : null;
  const effective: "seat" | "all" = mode === "seat" && mine ? "seat" : "all";
  const [ready, setReady] = useState(false);
  const zoom = useRef<{ by: (f: number) => void } | null>(null);

  return (
    <div className={`relative overflow-hidden bg-[#0b1224] ${className}`}>
      <Canvas dpr={[1, 1.5]} camera={{ fov: 62, position: [0, 60, 90] }} gl={{ antialias: true }} onCreated={() => setReady(true)}>
        <color attach="background" args={["#0b1224"]} />
        <fog attach="fog" args={["#0b1224", 120, 420]} />
        <hemisphereLight args={["#cfd8ff", "#1b2236", 1.1]} />
        <directionalLight position={[40, 90, 60]} intensity={1.4} />
        <mesh rotation-x={-Math.PI / 2} position={[0, -0.05, 0]}>
          <planeGeometry args={[900, 900]} />
          <meshStandardMaterial color="#141b2d" />
        </mesh>
        {objects
          .filter((o) => o.type === "standing")
          .map((o) => (
            <mesh key={o.id} rotation-x={-Math.PI / 2} position={[(o.x - fx) * S, 0.02, (o.y - fy) * S]} rotation-z={0}>
              <planeGeometry args={[o.w * S, o.h * S]} />
              <meshStandardMaterial color="#6d5dfc" emissive="#3b2fb8" emissiveIntensity={0.5} transparent opacity={0.55} />
            </mesh>
          ))}
        {court ? <Court o={court} fx={fx} fy={fy} kind={layout.arena_kind} /> : null}
        {stage ? <Stage o={stage} fx={fx} fy={fy} /> : null}
        <Chairs placed={placed} gone={goneIds} picked={pickedIds} />
        <Rig effective={effective} mine={mine ? { x: mine.x, y: mine.y, z: mine.z } : null} zoom={zoom} focus={{ x: 0, z: 0 }} stageSide={stage ? { x: (stage.x - fx) * S, z: (stage.y - fy) * S } : null} />
      </Canvas>
      {!ready ? <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0b1224] text-sm text-slate-300">Loading view…</div> : null}
      <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white">Drag to look around · scroll or pinch to zoom</div>
      <div className="absolute bottom-3 right-3 z-10 flex flex-col overflow-hidden rounded-xl border border-white/20 bg-black/70 shadow-lg">
        <button type="button" aria-label="Zoom in" onClick={() => zoom.current?.by(1 / 1.2)} className="flex size-9 cursor-pointer items-center justify-center text-white hover:bg-white/15"><Plus className="size-4" /></button>
        <button type="button" aria-label="Zoom out" onClick={() => zoom.current?.by(1.2)} className="flex size-9 cursor-pointer items-center justify-center border-t border-white/20 text-white hover:bg-white/15"><Minus className="size-4" /></button>
      </div>
      <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5">
        {([["seat", "From my seat"], ["all", "Whole venue"]] as Array<["seat" | "all", string]>).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setMode(id)} className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-bold ${effective === id ? "bg-white text-slate-900" : "bg-black/70 text-white hover:bg-black/85"}`}>{label}</button>
        ))}
      </div>
    </div>
  );
}

function Court({ o, fx, fy, kind }: { o: Obj; fx: number; fy: number; kind?: string }) {
  const w = o.w * S, h = o.h * S;
  const wood = kind === "basketball";
  return (
    <group position={[(o.x - fx) * S, 0.06, (o.y - fy) * S]}>
      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color={wood ? "#c98b4a" : "#1f7a3a"} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
        <ringGeometry args={[Math.min(w, h) * 0.14, Math.min(w, h) * 0.145, 48]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
        <planeGeometry args={[0.15, h]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      {wood
        ? [-1, 1].map((sgn) => (
            <group key={sgn} position={[sgn * (w / 2 - 0.4), 0, 0]}>
              <mesh position={[0, 3.05, 0]}><boxGeometry args={[0.12, 1.1, 1.8]} /><meshStandardMaterial color="#e5e7eb" /></mesh>
              <mesh position={[sgn * 0.5, 1.5, 0]}><boxGeometry args={[0.1, 3, 0.1]} /><meshStandardMaterial color="#374151" /></mesh>
            </group>
          ))
        : null}
    </group>
  );
}

function Stage({ o, fx, fy }: { o: Obj; fx: number; fy: number }) {
  const w = Math.max(6, o.w * S), h = Math.max(4, o.h * S);
  return (
    <group position={[(o.x - fx) * S, 0, (o.y - fy) * S]}>
      <mesh position={[0, 0.6, 0]}><boxGeometry args={[w, 1.2, h]} /><meshStandardMaterial color="#1b1030" /></mesh>
      <mesh position={[0, 6, -h / 2]}><boxGeometry args={[w, 11, 0.4]} /><meshStandardMaterial color="#5b21b6" emissive="#7c3aed" emissiveIntensity={0.9} /></mesh>
      <pointLight position={[0, 9, 4]} intensity={900} color="#a78bfa" distance={120} />
      <spotLight position={[-w / 3, 12, 2]} intensity={1200} color="#f472b6" angle={0.8} penumbra={0.6} distance={140} />
      <spotLight position={[w / 3, 12, 2]} intensity={1200} color="#60a5fa" angle={0.8} penumbra={0.6} distance={140} />
    </group>
  );
}

function Chairs({ placed, gone, picked }: { placed: Array<{ s: Seat; x: number; y: number; z: number }>; gone: Set<string>; picked: Set<string> }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const steps = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    const st = steps.current;
    if (!m || !st) return;
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    placed.forEach((p, i) => {
      const id = String(p.s.id);
      const isPicked = picked.has(id);
      dummy.position.set(p.x, 0.15 + p.y + (isPicked ? 0.25 : 0), p.z);
      dummy.scale.setScalar(isPicked ? 1.5 : 1);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      const slab = new THREE.Object3D();
      slab.position.set(p.x, p.y / 2, p.z);
      slab.scale.set(0.74, Math.max(0.1, p.y), 0.74);
      slab.updateMatrix();
      st.setMatrixAt(i, slab.matrix);
      col.set(isPicked ? "#ff9f1a" : gone.has(id) || (p.s.status && String(p.s.status).toUpperCase() !== "AVAILABLE") ? "#ef4444" : "#4f6bff");
      m.setColorAt(i, col);
    });
    m.instanceMatrix.needsUpdate = true;
    st.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [placed, gone, picked]);
  if (placed.length === 0) return null;
  return (
    <group>
      <instancedMesh key={"s" + placed.length} ref={steps} args={[undefined, undefined, placed.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#3b455e" />
      </instancedMesh>
      <instancedMesh key={placed.length} ref={ref} args={[undefined, undefined, placed.length]}>
        <boxGeometry args={[0.46, 0.4, 0.46]} />
        <meshStandardMaterial />
      </instancedMesh>
    </group>
  );
}

function Rig({
  effective,
  mine,
  zoom,
  focus,
  stageSide,
}: {
  effective: "seat" | "all";
  mine: { x: number; y: number; z: number } | null;
  zoom: React.MutableRefObject<{ by: (f: number) => void } | null>;
  focus: { x: number; z: number };
  stageSide: { x: number; z: number } | null;
}) {
  const { camera } = useThree();
  const controls = useRef<any>(null);
  useEffect(() => {
    zoom.current = {
      by: (f) => {
        const c = controls.current;
        if (!c) return;
        const v = camera.position.clone().sub(c.target).multiplyScalar(f);
        camera.position.copy(c.target.clone().add(v));
        c.update();
      },
    };
  }, [camera, zoom]);
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    if (effective === "seat" && mine) {
      const eye = new THREE.Vector3(mine.x, mine.y + 1.1, mine.z);
      const look = new THREE.Vector3(stageSide ? stageSide.x : focus.x, 1.4, stageSide ? stageSide.z : focus.z);
      const dir = look.clone().sub(eye).normalize();
      camera.position.copy(eye);
      c.target.copy(eye.clone().add(dir.multiplyScalar(1.5)));
    } else {
      camera.position.set(0, 70, 105);
      c.target.set(0, 0, 0);
    }
    c.update();
  }, [effective, mine, camera, focus, stageSide]);
  return <OrbitControls ref={controls} enablePan={false} enableZoom={effective === "all"} rotateSpeed={effective === "seat" ? -0.5 : 0.7} maxPolarAngle={Math.PI * 0.95} />;
}
