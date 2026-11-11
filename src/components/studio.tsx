"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { effectiveStatus, type Plan, type Creative } from "@/core/model";
import { publisher } from "@/core/sites";
import { CreativePreview, PublisherArt, Arrow, Notice } from "./common";
import { request } from "./api";
type Counts = { views: number; clicks: number };
export function Studio({
  initial,
  initialStats,
  payment,
}: {
  initial: Plan;
  initialStats: Counts;
  payment?: string;
}) {
  const [plan, setPlan] = useState(initial),
    [creative, setCreative] = useState<Creative>(initial.creative),
    [counts, setCounts] = useState(initialStats),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  const site = publisher(plan.siteId),
    status = effectiveStatus(plan),
    dirty = JSON.stringify(creative) !== JSON.stringify(plan.creative);
  async function refresh() {
    const result = await request<{ plan: Plan; stats: Counts }>(
      `/api/plans/${plan.id}`,
    );
    setPlan(result.plan);
    setCounts(result.stats);
  }
  useEffect(() => {
    if (payment !== "returned" || initial.status === "active") return;
    let ignore = false;
    request<Plan>(`/api/plans/${initial.id}/capture`, {})
      .then((p) => {
        if (!ignore) setPlan(p);
      })
      .catch((e) => {
        if (!ignore) setError(e.message);
      });
    return () => {
      ignore = true;
    };
  }, [initial.id, initial.status, payment]);
  useEffect(() => {
    if (plan.status !== "active") return;
    const timer = setInterval(() => {
      request<{ plan: Plan; stats: Counts }>(`/api/plans/${plan.id}`)
        .then((r) => {
          setPlan(r.plan);
          setCounts(r.stats);
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(timer);
  }, [plan.id, plan.status]);
  async function act(action: string) {
    setBusy(action);
    setError("");
    setSaved(false);
    try {
      if (action === "refresh") {
        await refresh();
        return;
      }
      const result = await request<Plan>(
        `/api/plans/${plan.id}/${action}`,
        action === "edit"
          ? { creative, version: plan.version }
          : action === "checkout"
            ? { version: plan.version }
            : {},
      );
      setPlan(result);
      setCreative(result.creative);
      if (action === "edit") setSaved(true);
      if (
        action === "checkout" &&
        result.approvalUrl &&
        result.status !== "active"
      )
        window.location.assign(result.approvalUrl);
    } catch (e) {
      setError((e as Error).message);
      try {
        await refresh();
      } catch {}
    } finally {
      setBusy("");
    }
  }
  function edit(key: keyof Creative, value: string) {
    setCreative({
      ...creative,
      [key]: key === "benefitIndex" ? Number(value) : value,
    });
    setSaved(false);
  }
  return (
    <>
      <div className="page-heading compact">
        <Link className="back-link" href={`/campaign/${plan.runId}`}>
          Your campaign / {site.name}
        </Link>
        <h1>
          {status === "active"
            ? "You’re in good company."
            : status === "ended"
              ? "A moment, well spent."
              : "Make yourself at home."}
        </h1>
        <p>
          {status === "active"
            ? "Your approved sponsorship is live on the sample publisher page."
            : status === "ended"
              ? "Your 30-minute placement has ended. Here’s how the demo went."
              : `A sponsorship for ${site.name}. Make it feel like it belongs.`}
        </p>
      </div>
      <div className="studio-grid">
        <section className="placement-preview">
          <div className="section-heading">
            <h2>The visitor’s view</h2>
            <span>Sample result screen</span>
          </div>
          <PublisherArt siteId={plan.siteId} large />
          <div className="sample-save">
            <span>Result ready to save</span>
            <span>Download portrait</span>
          </div>
          <CreativePreview creative={creative} brief={plan.brief} />
          <p className="caption">{site.placement}</p>
        </section>
        <section className="studio-controls">
          <div className="section-heading">
            <h2>{status === "draft" ? "Your creative" : "Your sponsorship"}</h2>
            <span className="status-label">
              {status === "checkout" ? "Approved · payment pending" : status}
            </span>
          </div>
          {status === "draft" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                act("edit");
              }}
            >
              <fieldset disabled={!!busy}>
                <label>
                  Headline
                  <input
                    required
                    maxLength={85}
                    value={creative.headline}
                    onChange={(e) => edit("headline", e.target.value)}
                  />
                  <small>{creative.headline.length}/85</small>
                </label>
                <label>
                  Body copy
                  <textarea
                    required
                    maxLength={180}
                    value={creative.description}
                    onChange={(e) => edit("description", e.target.value)}
                  />
                  <small>{creative.description.length}/180</small>
                </label>
                <label>
                  Call to action
                  <input
                    required
                    maxLength={28}
                    value={creative.cta}
                    onChange={(e) => edit("cta", e.target.value)}
                  />
                </label>
                <label>
                  Advertiser-approved benefit
                  <select
                    value={creative.benefitIndex}
                    onChange={(e) => edit("benefitIndex", e.target.value)}
                  >
                    <option value={-1}>No benefit</option>
                    {plan.brief.benefits.map((b, i) => (
                      <option key={i} value={i}>
                        {b}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="button secondary"
                  disabled={!dirty || !!busy}
                >
                  {busy === "edit" ? "Saving…" : "Save changes"}
                </button>
                {saved && (
                  <span className="saved" role="status">
                    Changes saved
                  </span>
                )}
              </fieldset>
            </form>
          ) : (
            <div className="approved-copy">
              <p>
                The creative and product link are fixed to the version you
                approved.
              </p>
              <dl>
                <dt>Brand</dt>
                <dd>{plan.brief.brand}</dd>
                <dt>Destination</dt>
                <dd>
                  <a
                    href={plan.brief.destination}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {plan.brief.destination}
                  </a>
                </dd>
              </dl>
            </div>
          )}
          {error && <Notice>{error}</Notice>}
          {payment === "cancelled" && status === "checkout" && (
            <p className="notice">
              Checkout was cancelled. The ad is not active. You can return to
              the same PayPal order below.
            </p>
          )}
          {status === "draft" || status === "checkout" ? (
            <div className="checkout">
              <div className="price-line">
                <strong>
                  $10<span> USD</span>
                </strong>
                <span>
                  One placement
                  <br />
                  30 minutes
                </span>
              </div>
              <p>
                Starts after PayPal confirms payment. No impression guarantee.
                PayPal Sandbox only—no real money moves.
              </p>
              {dirty && (
                <p className="muted">
                  Save your edits before approving this creative.
                </p>
              )}
              <button
                className="button full"
                type="button"
                disabled={!!busy || dirty}
                onClick={() => act("checkout")}
              >
                {busy === "checkout"
                  ? "Opening PayPal…"
                  : status === "checkout"
                    ? "Continue in PayPal"
                    : "Approve & pay with PayPal"}
                <Arrow />
              </button>
              {status === "checkout" && (
                <button
                  className="text-button"
                  disabled={!!busy}
                  onClick={() => act("capture")}
                >
                  {busy === "capture"
                    ? "Checking PayPal…"
                    : "Already paid? Verify this order"}
                </button>
              )}
              <p className="caption">
                Approval locks this creative. To make a different version later,
                generate a new draft from your campaign.
              </p>
            </div>
          ) : (
            <div className="receipt">
              <dl>
                <dt>Amount</dt>
                <dd>$10.00 USD · Sandbox</dd>
                <dt>PayPal order</dt>
                <dd className="id-text">{plan.orderId}</dd>
                <dt>Capture</dt>
                <dd className="id-text">{plan.captureId}</dd>
                <dt>Placement ends</dt>
                <dd>
                  {plan.endsAt &&
                    new Date(plan.endsAt).toLocaleString("en-US", {
                      timeZone: "UTC",
                    }) + " UTC"}
                </dd>
              </dl>
              <div className="report-counts">
                <div>
                  <strong>{counts.views}</strong>
                  <span>Viewable impressions</span>
                </div>
                <div>
                  <strong>{counts.clicks}</strong>
                  <span>Clicks</span>
                </div>
              </div>
              <p className="caption">
                A view counts after the ad is at least half visible for one
                second in an active tab. Demo events are deduplicated; this is
                not a fraud-audited billing report.
              </p>
              <Link
                className="button full"
                target="_blank"
                href={`/publishers/${plan.siteId}?plan=${plan.id}`}
              >
                Open publisher page
                <Arrow />
              </Link>
              <button
                className="text-button"
                disabled={!!busy}
                onClick={() => act("refresh")}
              >
                Refresh report
              </button>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
