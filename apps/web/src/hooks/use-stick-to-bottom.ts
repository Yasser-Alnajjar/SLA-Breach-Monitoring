import { useLayoutEffect, useRef } from "react";

/** How close to the bottom (in px) still counts as "at the bottom" for the purpose of re-pinning on new content. */
const BOTTOM_THRESHOLD_PX = 48;

/**
 * Keeps a scrollable container (Conversation, Activity Timeline — anything
 * log-like) pinned to its bottom as items are appended: on first mount, once
 * async data finishes loading, and whenever new items arrive later, without
 * fighting a user who has scrolled up to read earlier content.
 *
 * `itemKey` should change whenever the rendered list changes (its length, or
 * the last item's id) — that's what triggers the post-render scroll check.
 * The scroll happens in a layout effect, after the new items are already in
 * the DOM but before the browser paints, so there's no visible jump and no
 * arbitrary delay is needed.
 */
export function useStickToBottom<T extends HTMLElement>(itemKey: string | number) {
  const containerRef = useRef<T>(null);
  // Starts true so the very first render (initial mount, or the first
  // render once async data resolves) lands at the bottom.
  const isAtBottomRef = useRef(true);

  const handleScroll = () => {
    const container = containerRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    isAtBottomRef.current = distanceFromBottom <= BOTTOM_THRESHOLD_PX;
  };

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || !isAtBottomRef.current) return;
    container.scrollTop = container.scrollHeight;
    // Re-run only when the list actually changes — not on every render of
    // the parent (which would fight a user scrolled away from the bottom).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemKey]);

  return { containerRef, onScroll: handleScroll };
}
