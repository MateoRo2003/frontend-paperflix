import { useEffect, useRef } from 'react';

const EVENT_KEY    = 'paperflix:data-changed';
const STORAGE_KEY  = 'paperflix:last-change';

/**
 * Broadcast that data changed — call this after any admin mutation.
 * Notifies all listeners in the same tab AND in other tabs via localStorage.
 */
export function broadcastDataChange() {
  localStorage.setItem(STORAGE_KEY, Date.now().toString());
  window.dispatchEvent(new CustomEvent(EVENT_KEY));
}

/**
 * Subscribe to data-change broadcasts.
 * `onRefresh` is called whenever admin broadcasts a change,
 * whether from the same tab or another tab.
 */
export function useDataSync(onRefresh: () => void) {
  // Keep a ref so the effect doesn't need to re-register when onRefresh changes
  const ref = useRef(onRefresh);
  useEffect(() => { ref.current = onRefresh; });

  useEffect(() => {
    const handle = () => ref.current();
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) ref.current();
    };
    window.addEventListener(EVENT_KEY, handle);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(EVENT_KEY, handle);
      window.removeEventListener('storage', handleStorage);
    };
  }, []); // stable — registers once, always calls latest onRefresh via ref
}
