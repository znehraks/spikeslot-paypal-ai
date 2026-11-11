// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from "vitest";
let notify: (entries: Partial<IntersectionObserverEntry>[]) => void;
let node: HTMLDivElement;
let watch: typeof import("./viewability").watchView,
  unwatch: typeof import("./viewability").unwatchView;
beforeEach(async () => {
  vi.useFakeTimers();
  vi.resetModules();
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(cb: typeof notify) {
        notify = cb;
      }
      observe() {}
      unobserve() {}
    },
  );
  Object.defineProperty(document, "visibilityState", {
    value: "visible",
    configurable: true,
  });
  node = document.createElement("div");
  document.body.append(node);
  const observer = await import("./viewability");
  watch = observer.watchView;
  unwatch = observer.unwatchView;
});
afterEach(() => {
  unwatch(node);
  node.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function visible(ratio = 1) {
  notify([
    { target: node, isIntersecting: ratio > 0, intersectionRatio: ratio },
  ]);
}
it("requires a continuous second at half visibility and fires once", () => {
  const onView = vi.fn();
  watch(node, onView);
  visible(0.49);
  vi.advanceTimersByTime(1500);
  expect(onView).not.toHaveBeenCalled();
  visible(0.5);
  vi.advanceTimersByTime(999);
  expect(onView).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(onView).toHaveBeenCalledTimes(1);
  visible();
  vi.advanceTimersByTime(5000);
  expect(onView).toHaveBeenCalledTimes(1);
});
it("restarts the timer after scrolling out", () => {
  const onView = vi.fn();
  watch(node, onView);
  visible();
  vi.advanceTimersByTime(600);
  visible(0);
  visible();
  vi.advanceTimersByTime(600);
  expect(onView).not.toHaveBeenCalled();
  vi.advanceTimersByTime(400);
  expect(onView).toHaveBeenCalledTimes(1);
});
it("does not count background tabs or detached placements", () => {
  const onView = vi.fn();
  watch(node, onView);
  visible();
  Object.defineProperty(document, "visibilityState", {
    value: "hidden",
    configurable: true,
  });
  document.dispatchEvent(new Event("visibilitychange"));
  vi.advanceTimersByTime(2000);
  expect(onView).not.toHaveBeenCalled();
  Object.defineProperty(document, "visibilityState", {
    value: "visible",
    configurable: true,
  });
  document.dispatchEvent(new Event("visibilitychange"));
  node.remove();
  vi.advanceTimersByTime(2000);
  expect(onView).not.toHaveBeenCalled();
});
