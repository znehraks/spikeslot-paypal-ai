// Explicit visual QA fixture. Never imported by the application or the normal test suite.
import { it, expect } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { initDatabase } from "../src/core/db";
import {
  createRun,
  replayRun,
  saveAnalysis,
  createPlan,
  savePlan,
  updateBrief,
} from "../src/core/repository";
import { publishers } from "../src/core/sites";
import { signSession } from "../src/core/http";

it("creates a NEW, explicitly labeled browser QA database and signed local test session", async () => {
  const dir = process.env.QA_FIXTURE_DIR;
  if (
    !dir ||
    !dir
      .normalize("NFC")
      .startsWith(resolve("data/browser-qa-").normalize("NFC"))
  )
    throw new Error(
      "QA_FIXTURE_DIR must be a new absolute path under data/browser-qa-.",
    );
  await mkdir(dir); // Existing databases are never overwritten or reset.
  process.env.SESSION_SECRET =
    "qa-browser-only-not-a-production-secret-20261111";
  const db = await initDatabase(new PGlite(dir));
  try {
    const who = randomUUID();
    let run = await createRun(db, who);
    run = await updateBrief(db, run.id, who, {
      ...run.brief,
      brand: "QA fixture — PetFrame",
    });
    run = await replayRun(db, run.id, who);
    run = await saveAnalysis(
      db,
      run,
      {
        recommendations: publishers.map((s) => ({
          siteId: s.id,
          decision: s.id === "pet-names" ? "skip" : "recommend",
          reason:
            s.id === "pet-names"
              ? "QA fixture: A text-only name finder supplies no finished photo to print."
              : "QA fixture: The visitor has a finished pet image and can turn it into a framed keepsake.",
          evidence: s.flow,
          placement: s.placement,
        })),
      },
      "QA FIXTURE — no AI call",
    );
    const creative = {
      headline: "QA fixture: Your portrait, off the screen.",
      description:
        "Turn your finished pet portrait into a wooden-framed keepsake.",
      cta: "Explore PetFrame",
      benefitIndex: 0,
    };
    const draft = await createPlan(db, run, "royal-pets", creative);
    const checkout = await savePlan(db, {
      ...(await createPlan(db, run, "pet-collage", creative)),
      status: "checkout",
      orderId: "QA-UNPAID-ORDER",
    });
    const now = Date.now();
    const active = await savePlan(db, {
      ...(await createPlan(db, run, "royal-pets", creative)),
      status: "active",
      orderId: "QA-ORDER-NOT-A-PAYMENT",
      captureId: "QA-CAPTURE-NOT-A-PAYMENT",
      startedAt: now,
      endsAt: now + 1800000,
    });
    const ended = await savePlan(db, {
      ...(await createPlan(db, run, "pet-collage", creative)),
      status: "active",
      orderId: "QA-ENDED-ORDER",
      captureId: "QA-ENDED-CAPTURE",
      startedAt: now - 1800001,
      endsAt: now - 1,
    });
    await mkdir("refs", { recursive: true });
    await writeFile(
      "refs/browser-qa.json",
      JSON.stringify(
        {
          notice: "Fixtures only. No provider calls or payments.",
          dir,
          owner: who,
          cookie: signSession(who, now + 86400000),
          runId: run.id,
          draftId: draft.id,
          checkoutId: checkout.id,
          activeId: active.id,
          endedId: ended.id,
        },
        null,
        2,
      ),
      { flag: "wx", mode: 0o600 },
    );
    expect(active.status).toBe("active");
  } finally {
    await db.close();
  }
});
