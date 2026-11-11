import { afterEach, expect, it, vi } from "vitest";
import { appOrigin } from "./paypal";
afterEach(() => vi.unstubAllEnvs());
it("uses the hosted HTTPS origin unless an explicit custom origin is configured", () => {
  vi.stubEnv("APP_URL", "");
  vi.stubEnv("RENDER_EXTERNAL_URL", "https://spikeslot.example");
  expect(appOrigin()).toBe("https://spikeslot.example");
  vi.stubEnv("APP_URL", "https://custom.example/");
  expect(appOrigin()).toBe("https://custom.example");
  vi.stubEnv("APP_URL", "");
  vi.stubEnv("RENDER_EXTERNAL_URL", "http://spikeslot.example");
  expect(() => appOrigin()).toThrow("APP_URL must use HTTPS");
});
