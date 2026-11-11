import { VIEW_MS, VIEW_RATIO } from "./constants";
import { safe } from "./util";

interface Watch {
  /** Last IntersectionObserver verdict: at least VIEW_RATIO of the target is on screen. */
  inView: boolean;
  timer?: ReturnType<typeof setTimeout>;
  onView: () => void;
}

const watches = new Map<Element, Watch>();
let observer: IntersectionObserver | undefined;

function tabVisible(): boolean {
  return document.visibilityState === "visible";
}

/**
 * Calls onView once when target has been at least half visible, in a visible tab, for VIEW_MS
 * without interruption. Any break restarts the clock. No IntersectionObserver means no views.
 */
export function watchView(target: Element, onView: () => void): void {
  if (typeof IntersectionObserver !== "function") return;
  if (!observer) {
    observer = new IntersectionObserver(safe(onEntries), { threshold: [0, VIEW_RATIO] });
    document.addEventListener("visibilitychange", safe(() => watches.forEach((watch, el) => update(el, watch))));
  }
  watches.set(target, { inView: false, onView });
  observer.observe(target);
}

export function unwatchView(target: Element): void {
  const watch = watches.get(target);
  if (watch) clearTimeout(watch.timer);
  watches.delete(target);
  observer?.unobserve(target);
}

function onEntries(entries: IntersectionObserverEntry[]): void {
  for (const entry of entries) {
    const watch = watches.get(entry.target);
    if (!watch) continue;
    watch.inView = entry.isIntersecting && entry.intersectionRatio >= VIEW_RATIO;
    update(entry.target, watch);
  }
}

function update(target: Element, watch: Watch): void {
  if (watch.inView && tabVisible() && target.isConnected) {
    if (!watch.timer) watch.timer = setTimeout(safe(() => fire(target, watch)), VIEW_MS);
  } else if (watch.timer) {
    clearTimeout(watch.timer);
    watch.timer = undefined;
  }
}

function fire(target: Element, watch: Watch): void {
  watch.timer = undefined;
  if (watches.get(target) !== watch || !watch.inView || !tabVisible() || !target.isConnected) return;
  // Unwatch before reporting so an impression can never be counted twice.
  unwatchView(target);
  watch.onView();
}
