let lockCount = 0;

const SCROLL_KEYS = new Set([" ", "PageUp", "PageDown", "ArrowUp", "ArrowDown", "Home", "End"]);

function isInsideScrollContainer(target: EventTarget | null): boolean {
  if (!(target instanceof Node)) return false;
  return Array.from(document.querySelectorAll("[data-scroll-lock-container]")).some((el) =>
    el.contains(target)
  );
}

function onWheel(e: WheelEvent) {
  if (isInsideScrollContainer(e.target)) return;
  e.preventDefault();
}

function onTouchMove(e: TouchEvent) {
  if (isInsideScrollContainer(e.target)) return;
  e.preventDefault();
}

function onKeyDown(e: KeyboardEvent) {
  if (!SCROLL_KEYS.has(e.key)) return;
  if (isInsideScrollContainer(e.target)) return;
  e.preventDefault();
}

/** Blocks background scroll without changing page layout, width, or overflow. */
export function lockBodyScroll(): () => void {
  if (lockCount === 0) {
    document.addEventListener("wheel", onWheel, { passive: false });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("keydown", onKeyDown);
  }

  lockCount += 1;

  return () => {
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) {
      document.removeEventListener("wheel", onWheel);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("keydown", onKeyDown);
    }
  };
}
