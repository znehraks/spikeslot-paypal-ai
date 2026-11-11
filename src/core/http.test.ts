import { describe, it, expect, vi } from "vitest";
import { signSession, verifySession, sameOrigin, body } from "./http";
vi.stubEnv("SESSION_SECRET", "test-only-secret-that-is-at-least-32-characters");
vi.stubEnv("APP_URL", "http://localhost:3610");
describe("HTTP trust boundary", () => {
  it("accepts signed unexpired cookies, rejects edits and expiry", () => {
    const id = crypto.randomUUID(),
      token = signSession(id, 2000);
    expect(verifySession(token, 1000)).toBe(id);
    expect(verifySession(`${token}x`, 1000)).toBeNull();
    expect(verifySession(token, 2000)).toBeNull();
    expect(verifySession(undefined)).toBeNull();
  });
  it("rejects missing and foreign origins", () => {
    for (const origin of [
      "",
      "https://attacker.example",
      "http://localhost:3610.attacker.example",
    ]) {
      expect(() =>
        sameOrigin(
          new Request("http://localhost:3610/api/runs", {
            headers: { origin },
          }),
        ),
      ).toThrow();
    }
  });
  it("rejects malformed JSON, oversized bodies and wrong types", async () => {
    const request = (value: string, type = "application/json") =>
      new Request("http://localhost:3610/api/runs", {
        method: "POST",
        headers: { origin: "http://localhost:3610", "content-type": type },
        body: value,
      });
    await expect(body(request("{}"))).resolves.toEqual({});
    await expect(body(request("{"))).rejects.toMatchObject({ code: "json" });
    await expect(body(request("x".repeat(17000)))).rejects.toMatchObject({
      status: 413,
    });
    await expect(body(request("{}", "text/plain"))).rejects.toMatchObject({
      status: 415,
    });
  });
});
