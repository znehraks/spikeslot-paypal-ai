/** The embedded observer must not break its host page. Adapted from SpikeSlot. */
export function safe<A extends unknown[]>(fn: (...args: A) => void): (...args: A) => void {
  return (...args: A) => { try { fn(...args); } catch { /* Isolate host-page callbacks. */ } };
}
