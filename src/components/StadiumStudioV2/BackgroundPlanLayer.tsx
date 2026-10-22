"use client";
import React, { useRef, useEffect } from "react";
import { Image as KonvaImage, Group, Transformer } from "react-konva";
import useImage from "use-image";
import Konva from "konva";
import { BackgroundPlanDef } from "./types";

interface BackgroundPlanLayerProps {
  plan?: BackgroundPlanDef;
  onUpdate: (updatedPlan: BackgroundPlanDef) => void;
  isSelected?: boolean;
  onSelect?: () => void;
}

export default function BackgroundPlanLayer({
  plan,
  onUpdate,
  isSelected,
  onSelect,
}: BackgroundPlanLayerProps) {
  const [image] = useImage(plan?.url || "", "anonymous");
  const imgRef = useRef<Konva.Image>(null);
  const trRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    if (isSelected && !plan?.isLocked && trRef.current && imgRef.current) {
      trRef.current.nodes([imgRef.current]);
      trRef.current.getLayer()?.batchDraw();
    } else if (trRef.current) {
      trRef.current.nodes([]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected, plan?.isLocked]);

  if (!plan || !plan.url) return null;

  return (
    <>
      <Group>
        <KonvaImage
          ref={imgRef}
          image={image}
          x={plan.x}
          y={plan.y}
          width={plan.width}
          height={plan.height}
          rotation={plan.rotation || 0}
          opacity={plan.opacity ?? 0.6}
          draggable={!plan.isLocked}
          listening={!plan.isLocked}
          onClick={onSelect}
          onTap={onSelect}
          onDragEnd={(e) => {
            const node = e.target;
            onUpdate({
              ...plan,
              x: Math.round(node.x()),
              y: Math.round(node.y()),
            });
          }}
          onTransformEnd={(e) => {
            const node = e.target;
            const scaleX = node.scaleX();
            const scaleY = node.scaleY();
            node.scaleX(1);
            node.scaleY(1);
            onUpdate({
              ...plan,
              x: Math.round(node.x()),
              y: Math.round(node.y()),
              width: Math.max(100, Math.round(node.width() * scaleX)),
              height: Math.max(100, Math.round(node.height() * scaleY)),
              rotation: Math.round(node.rotation()),
            });
          }}
        />
      </Group>

      {isSelected && !plan.isLocked && (
        <Transformer
          ref={trRef}
          rotateEnabled={true}
          boundBoxFunc={(_, newBox) => ({
            ...newBox,
            width: Math.max(100, newBox.width),
            height: Math.max(100, newBox.height),
          })}
        />
      )}
    </>
  );
}
