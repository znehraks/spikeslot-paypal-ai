"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { publishers } from "@/core/sites";
import { effectiveStatus, type Run, type Plan, type Brief } from "@/core/model";
import { Arrow, PublisherArt, TrafficChart, Notice } from "./common";
import { request } from "./api";
import { AgentConnection } from "./agent-connection";

export function Campaign({
  initial,
  plans: initialPlans,
}: {
  initial: Run;
  plans: Plan[];
}) {
  const [run, setRun] = useState(initial),
    [brief, setBrief] = useState<Brief>(initial.brief),
    [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  const [plans, setPlans] = useState(initialPlans);
  const [prompt, setPrompt] = useState(
    `Use the spikeslot-${initial.id.slice(0, 8)} MCP tools to read my campaign, assess all three publishers with grounded evidence, save your recommendations, then create one tailored draft for the best fit. Explain skipped publishers. Return the draft review link. Do not approve or pay.`,
  );
  const dirty = JSON.stringify(brief) !== JSON.stringify(run.brief);
  useEffect(() => {
    if (dirty || busy) return;
    let cancelled = false;
    const timer = setInterval(async () => {
      try {
        const result = await request<{ run: Run; plans: Plan[] }>(
          `/api/runs/${initial.id}`,
        );
        if (!cancelled) {
          setRun(result.run);
          setPlans(result.plans);
        }
      } catch {
        /* Manual refresh still reports connection errors. */
      }
    }, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [dirty, busy, initial.id]);
  async function refresh() {
    setBusy("refresh");
    setError("");
    try {
      const result = await request<{ run: Run; plans: Plan[] }>(
        `/api/runs/${run.id}`,
      );
      setRun(result.run);
      setPlans(result.plans);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function action(name: string, input: unknown = {}) {
    setBusy(name);
    setError("");
    try {
      const result = await request<Run>(`/api/runs/${run.id}/${name}`, input);
      setRun(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  function field(key: keyof Brief, value: string) {
    setBrief({
      ...brief,
      [key]: key === "benefits" ? value.split("\n") : value,
    });
  }
  return (
    <>
      <div className="page-heading">
        <Link className="back-link" href="/">
          Discover / Your campaign
        </Link>
        <h1>
          Find your kind
          <br />
          of company.
        </h1>
        <p>Start with your brand. Let the moment—and the match—do the rest.</p>
      </div>
      <details className="brief-panel" open={!run.traffic}>
        <summary>
          <span>
            Your brief <strong>{run.brief.brand}</strong>
          </span>
          <span>Edit campaign</span>
        </summary>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            action("brief", {
              ...brief,
              benefits: brief.benefits.filter((b) => b.trim()),
            });
          }}
        >
          <fieldset disabled={!!busy}>
            <div className="form-grid">
              <label>
                Brand name
                <input
                  required
                  maxLength={60}
                  value={brief.brand}
                  onChange={(e) => field("brand", e.target.value)}
                />
              </label>
              <label>
                Product page
                <input
                  required
                  type="url"
                  maxLength={1000}
                  value={brief.destination}
                  onChange={(e) => field("destination", e.target.value)}
                />
              </label>
              <label>
                What do you make?
                <textarea
                  required
                  maxLength={500}
                  value={brief.product}
                  onChange={(e) => field("product", e.target.value)}
                />
              </label>
              <label>
                Who is it for?
                <textarea
                  required
                  maxLength={500}
                  value={brief.audience}
                  onChange={(e) => field("audience", e.target.value)}
                />
              </label>
              <label>
                Approved benefits <small>One per line, up to 5</small>
                <textarea
                  maxLength={800}
                  value={brief.benefits.join("\n")}
                  onChange={(e) => field("benefits", e.target.value)}
                />
              </label>
              <label>
                Anything to avoid?
                <textarea
                  maxLength={500}
                  value={brief.exclusions}
                  onChange={(e) => field("exclusions", e.target.value)}
                />
              </label>
            </div>
            <div className="form-footer">
              <p>
                Changing the brief clears its fit analysis. Existing
                sponsorships keep their approved brief.
              </p>
              <button className="button secondary" disabled={!dirty || !!busy}>
                {busy === "brief" ? "Saving…" : "Save brief"}
              </button>
            </div>
          </fieldset>
        </form>
      </details>
      <div className="workflow-bar">
        <div>
          <strong>
            {run.analysis
              ? "Your matches are ready."
              : run.traffic
                ? "The traffic is up. Is the fit right?"
                : "Let’s see what’s picking up."}
          </strong>
          <p>
            {run.analysis
              ? `Your AI · ${run.model}`
              : "90 minutes of sample visits, processed by the real spike detector."}
          </p>
        </div>
        <div className="actions">
          <button
            className="button secondary"
            disabled={!!busy || dirty}
            onClick={() => action("replay")}
          >
            {busy === "replay"
              ? "Replaying…"
              : run.traffic
                ? "Replay again"
                : "Replay sample traffic"}
          </button>
          <button
            className="button"
            disabled={!!busy || dirty}
            onClick={refresh}
          >
            {busy === "refresh" ? "Refreshing…" : "Refresh AI results"}
            <Arrow />
          </button>
        </div>
      </div>
      {dirty && <p className="muted">Save your brief to continue.</p>}
      {error && <Notice>{error}</Notice>}
      <div className="sr-only" role="status">
        {busy ? "Working. Please wait." : "Ready."}
      </div>
      <AgentConnection
        runId={run.id}
        prompt={prompt}
        disabled={dirty || !run.traffic}
      />
      <section className="discover">
        <div className="section-heading">
          <h2>Your publisher shortlist</h2>
          <span>Measured traffic ≠ a recommendation</span>
        </div>
        <div className="publisher-grid">
          {publishers.map((site, i) => {
            const match = run.analysis?.recommendations.find(
              (r) => r.siteId === site.id,
            );
            return (
              <article key={site.id} className={`publisher-card card-${i}`}>
                <Link
                  href={`/publishers/${site.id}`}
                  aria-label={`Preview ${site.name}`}
                >
                  <PublisherArt siteId={site.id} />
                </Link>
                <div className="card-title">
                  <h3>{site.name}</h3>
                  {match && (
                    <span className={`fit-label ${match.decision}`}>
                      {match.decision === "recommend"
                        ? "Good fit"
                        : "Skip this one"}
                    </span>
                  )}
                </div>
                <p>{site.tagline}</p>
                {run.traffic && <TrafficChart traffic={run.traffic[site.id]} />}
                <div className="match-copy">
                  {match ? (
                    <>
                      <h4>
                        {match.decision === "recommend"
                          ? "Why it belongs"
                          : "Why we’d pass"}
                      </h4>
                      <p>{match.reason}</p>
                      <blockquote>{match.evidence}</blockquote>
                      <details>
                        <summary>Placement details</summary>
                        <p>{match.placement}</p>
                      </details>
                    </>
                  ) : (
                    <p className="muted">
                      {run.traffic
                        ? "A rising moment. Ask AI whether it fits your brief."
                        : "Replay the sample traffic to reveal this publisher’s moment."}
                    </p>
                  )}
                </div>
                {match?.decision === "recommend" && (
                  <button
                    className="button secondary full"
                    disabled={!!busy || dirty}
                    onClick={() => {
                      setPrompt(
                        `Use spikeslot-${run.id.slice(0, 8)} get_campaign to read the latest brief and recommendations. Generate tailored copy for ${site.name} (${site.id}) and save it with create_draft. Return the review link. Do not approve or pay.`,
                      );
                      document
                        .getElementById("connect-ai")
                        ?.scrollIntoView({ behavior: "smooth" });
                    }}
                  >
                    Ask your AI for a draft
                    <Arrow />
                  </button>
                )}
              </article>
            );
          })}
        </div>
      </section>
      {plans.length > 0 && (
        <section className="saved-plans">
          <h2>Your sponsorships</h2>
          {plans.map((p) => (
            <Link key={p.id} href={`/studio/${p.id}`}>
              <span>
                {publishers.find((s) => s.id === p.siteId)!.name}
                <small>{p.creative.headline}</small>
              </span>
              <span>
                {effectiveStatus(p)}
                <Arrow />
              </span>
            </Link>
          ))}
        </section>
      )}
      <p className="demo-note">
        Publisher profiles and traffic are sample data. AI explanations are
        suggestions for your review, not a forecast or performance guarantee.
      </p>
    </>
  );
}
