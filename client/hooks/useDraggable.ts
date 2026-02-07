import { useRef, useCallback, useEffect, useState } from "react";

/**
 * A hook that makes a dialog/modal draggable by its header area.
 * Attach `dragHandleProps` to the drag handle element (e.g., the header bar),
 * and `dialogRef` to the dialog container.
 */
export function useDraggable() {
  const dialogRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Don't drag if clicking on buttons, inputs, selects, textareas, or links
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest("input") ||
      target.closest("select") ||
      target.closest("textarea") ||
      target.closest("a") ||
      target.closest('[role="button"]')
    ) {
      return;
    }

    isDragging.current = true;
    dragStart.current = {
      x: e.clientX - offset.x,
      y: e.clientY - offset.y,
    };

    // Capture pointer for smooth dragging
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  }, [offset]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;

    const newX = e.clientX - dragStart.current.x;
    const newY = e.clientY - dragStart.current.y;

    setOffset({ x: newX, y: newY });
  }, []);

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  // Reset position when dialog mounts/unmounts
  const resetPosition = useCallback(() => {
    setOffset({ x: 0, y: 0 });
  }, []);

  const dragHandleProps = {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    style: { cursor: "grab", touchAction: "none" as const },
  };

  const dialogStyle: React.CSSProperties = {
    transform: `translate(${offset.x}px, ${offset.y}px)`,
  };

  return {
    dialogRef,
    dragHandleProps,
    dialogStyle,
    offset,
    resetPosition,
  };
}
