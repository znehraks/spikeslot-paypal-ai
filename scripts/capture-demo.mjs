// Import from ego-browser nodejs. Captures actual page frames during UI actions.
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function record(page, root, id, seconds, action) {
  const folder = join(root, id);
  await mkdir(folder, { recursive: true });
  await page.cdp("Emulation.setDeviceMetricsOverride", {
    width: 1440, height: 780, deviceScaleFactor: 1, mobile: false,
  });
  const frames = [];
  const start = performance.now();
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  let actionError;
  const acting = pause(1500).then(action).catch((error) => { actionError = error; });
  while (performance.now() - start < seconds * 1000) {
    const before = performance.now();
    const result = await page.cdp("Page.captureScreenshot", {
      format: "jpeg", quality: 88, captureBeyondViewport: false,
    });
    const file = `${String(frames.length).padStart(6, "0")}.jpg`;
    await writeFile(join(folder, file), Buffer.from(result.data, "base64"), { flag: "wx" });
    frames.push({ file, ms: before - start });
    await pause(Math.max(1, 120 - (performance.now() - before)));
  }
  await acting;
  await writeFile(join(folder, "frames.json"), JSON.stringify(frames), { flag: "wx" });
  if (actionError) throw actionError;
  console.log({ scene: id, frames: frames.length, seconds: frames.at(-1).ms / 1000 });
}
