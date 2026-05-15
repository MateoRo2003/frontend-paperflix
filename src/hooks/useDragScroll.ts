'use client';
import { useEffect } from 'react';

export function useDragScroll(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const THRESHOLD = 6; // px before treating move as a drag

    let active       = false;
    let dragging     = false;
    let startY       = 0;
    let initScrollTop = 0;
    let scrollEl: HTMLElement | null = null;

    function findScrollable(el: HTMLElement | null): HTMLElement {
      let cur = el;
      while (cur && cur !== document.body) {
        if (cur.scrollHeight > cur.clientHeight + 1) {
          const oy = getComputedStyle(cur).overflowY;
          if (oy === 'auto' || oy === 'scroll') return cur;
        }
        cur = cur.parentElement;
      }
      return document.documentElement as HTMLElement;
    }

    function onDragStart(e: DragEvent) {
      // Block native image/element drag while a pointer interaction is live
      if (active) e.preventDefault();
    }

    function onDown(e: PointerEvent) {
      active        = true;
      dragging      = false;
      startY        = e.clientY;
      scrollEl      = findScrollable(e.target as HTMLElement);
      initScrollTop = scrollEl.scrollTop;
    }

    function onMove(e: PointerEvent) {
      if (!active) return;
      const dy = startY - e.clientY;

      if (!dragging && Math.abs(dy) > THRESHOLD) {
        dragging = true;
        document.body.style.cursor     = 'grabbing';
        document.body.style.userSelect = 'none';
      }

      if (dragging && scrollEl) {
        scrollEl.scrollTop = initScrollTop + dy;
        e.preventDefault();
      }
    }

    function stopClick(e: MouseEvent) {
      e.stopPropagation();
      e.preventDefault();
    }

    function onUp() {
      if (dragging) {
        // Block the synthetic click that fires right after pointerup
        document.addEventListener('click', stopClick, { capture: true, once: true });
        document.body.style.cursor     = '';
        document.body.style.userSelect = '';
      }
      active   = false;
      dragging = false;
      scrollEl = null;
    }

    document.addEventListener('pointerdown',  onDown);
    document.addEventListener('pointermove',  onMove,  { passive: false });
    document.addEventListener('pointerup',    onUp);
    document.addEventListener('pointercancel', onUp);
    document.addEventListener('dragstart',    onDragStart);

    return () => {
      document.removeEventListener('pointerdown',  onDown);
      document.removeEventListener('pointermove',  onMove);
      document.removeEventListener('pointerup',    onUp);
      document.removeEventListener('pointercancel', onUp);
      document.removeEventListener('dragstart',    onDragStart);
    };
  }, []);
}
