import type { PGlite } from "@electric-sql/pglite";
import { AppError } from "./model";
import { freezePlan, getPlan, savePlan } from "./repository";
import {
  paypal,
  approvalLink,
  verifyOrder,
  type PaymentProvider,
} from "./paypal";

// This MVP runs one server process. Requests for the same plan serialize here;
// persisted PayPal request IDs and row versions also survive a server restart.
const pending = new Map<string, Promise<unknown>>();
async function serialized<T>(id: string, work: () => Promise<T>): Promise<T> {
  const before = pending.get(id) ?? Promise.resolve();
  const job = before.catch(() => {}).then(work);
  pending.set(id, job);
  try {
    return await job;
  } finally {
    if (pending.get(id) === job) pending.delete(id);
  }
}
export function beginCheckout(
  db: PGlite,
  id: string,
  owner: string,
  version: number,
  provider: PaymentProvider = paypal,
) {
  return serialized(id, async () => {
    let plan = await getPlan(db, id, owner);
    if (plan.status === "active") return plan;
    if (
      provider === paypal &&
      (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET)
    )
      throw new AppError(
        "paypal_setup",
        "Connect PayPal Sandbox credentials to pay. Your draft is still editable.",
        503,
      );
    // Do not reuse a create request after PayPal's six-hour idempotency window.
    if (!plan.orderId && Date.now() - plan.createdAt > 5 * 3600000)
      throw new AppError(
        "old_draft",
        "This draft is too old to start payment safely. Generate a fresh draft.",
        409,
      );
    plan = await freezePlan(db, id, owner, version);
    if (plan.orderId) return plan;
    const order = await provider.create(plan);
    verifyOrder(order, plan);
    return savePlan(db, {
      ...plan,
      orderId: order.id,
      approvalUrl: approvalLink(order),
    });
  });
}
export function completeCheckout(
  db: PGlite,
  id: string,
  owner: string,
  provider: PaymentProvider = paypal,
) {
  return serialized(id, async () => {
    const plan = await getPlan(db, id, owner);
    if (plan.status === "active") return plan;
    if (plan.status !== "checkout" || !plan.orderId)
      throw new AppError(
        "no_order",
        "Approve a creative and start PayPal checkout first.",
        409,
      );
    let order = await provider.get(plan.orderId);
    verifyOrder(order, plan);
    if (order.status === "APPROVED") {
      // If the capture response is lost, the next attempt reconciles with GET.
      await provider.capture(plan);
      order = await provider.get(plan.orderId);
    }
    const captureId = verifyOrder(order, plan, true);
    const startedAt = Date.now();
    return savePlan(db, {
      ...plan,
      status: "active",
      captureId,
      startedAt,
      endsAt: startedAt + plan.durationMs,
    });
  });
}
