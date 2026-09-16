"use client";

import {
  Children,
  createContext,
  useContext,
  useMemo,
  type CSSProperties,
  type ReactNode,
  type Ref,
} from "react";
import "./AdaptiveCardRow.css";

type AdaptiveCardContextValue = {
  /** @deprecated Kept for callers; cards no longer stretch when sparse. */
  fluid: boolean;
  /** @deprecated Kept for callers; posters stay portrait at all counts. */
  horizontal: boolean;
  /** Desktop target columns (minVisible). */
  columns: number;
  minVisible: number;
  /** True when more items than desktop minVisible — extra cards scroll. */
  scrollable: boolean;
};

const AdaptiveCardContext = createContext<AdaptiveCardContextValue | null>(null);

/** Use inside cards rendered by AdaptiveCardRow to go full-slot width and cap media height. */
export function useAdaptiveCard() {
  return useContext(AdaptiveCardContext);
}

type AdaptiveCardRowProps = {
  children: ReactNode;
  /** How many cards fit on desktop before scrolling. Default 5. */
  minVisible?: number;
  className?: string;
  scrollerRef?: Ref<HTMLDivElement>;
};

/**
 * Landing-page card row (responsive):
 * - Phone: 2 cards in view.
 * - Tablet: 3 cards in view.
 * - Desktop: minVisible cards in view (default 5).
 * - Fewer items keep the same card width (empty space on the right).
 */
export default function AdaptiveCardRow({
  children,
  minVisible = 5,
  className = "",
  scrollerRef,
}: AdaptiveCardRowProps) {
  const items = useMemo(
    () => Children.toArray(children).filter(Boolean),
    [children]
  );
  const count = items.length;

  const ctx = useMemo<AdaptiveCardContextValue>(() => {
    const scrollable = count > minVisible;
    return {
      fluid: false,
      horizontal: false,
      columns: minVisible,
      minVisible,
      scrollable,
    };
  }, [count, minVisible]);

  if (count === 0) return null;

  return (
    <AdaptiveCardContext.Provider value={ctx}>
      <div
        ref={scrollerRef}
        className={`adaptive-card-row ${className}`}
        style={
          {
            ["--adaptive-count" as string]: count,
          } as CSSProperties
        }
      >
        {items.map((child, index) => (
          <div
            key={
              typeof child === "object" && child !== null && "key" in child && child.key != null
                ? String(child.key)
                : `adaptive-slot-${index}`
            }
            className="adaptive-card-slot"
          >
            {child}
          </div>
        ))}
      </div>
    </AdaptiveCardContext.Provider>
  );
}
