"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { publishers } from "@/core/sites";
import type { Run } from "@/core/model";
import { Arrow, PublisherArt, Notice } from "./common";
import { request } from "./api";

export function Landing({
  aiReady,
  paypalReady,
}: {
  aiReady: boolean;
  paypalReady: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const router = useRouter();
  async function start() {
    setBusy(true);
    setError("");
    try {
      const run = await request<Run>("/api/runs", {});
      router.push(`/campaign/${run.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <h1>
            Catch a<br />
            <span>good moment.</span>
          </h1>
          <p>
            The next great place for your brand might be a little unexpected.
            Find a rising creator. Make a sponsorship that belongs.
          </p>
          <button className="button" disabled={busy} onClick={start}>
            {busy ? "Opening your studio…" : "Start a campaign"}
            <Arrow />
          </button>
          <div className="integration-state">
            <span className={aiReady ? "ready" : ""}>
              {aiReady ? "AI configured" : "AI setup pending"}
            </span>
            <span className={paypalReady ? "ready" : ""}>
              {paypalReady
                ? "PayPal Sandbox configured"
                : "PayPal setup pending"}
            </span>
          </div>
          {error && <Notice>{error}</Notice>}
        </div>
        <div className="hero-side">
          <span className="orbit-label">
            small sites.
            <br />
            big possibilities.
          </span>
          <svg viewBox="0 0 180 120" aria-hidden="true">
            <path
              d="M10 70C15 5 150 2 150 45s-140 95-115 25 145-30 135 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="m155 83 15 7-1-18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
          </svg>
          <p>
            Built for the internet’s
            <br />
            independent side.
          </p>
        </div>
      </section>
      <section className="discover">
        <div className="section-heading">
          <h2>A few good places to start</h2>
          <span>3 sample publishers · Already opted in</span>
        </div>
        <div className="publisher-grid">
          {publishers.map((s, i) => (
            <Link
              className={`publisher-card card-${i}`}
              href={`/publishers/${s.id}`}
              key={s.id}
            >
              <PublisherArt siteId={s.id} />
              <div className="card-title">
                <h3>{s.name}</h3>
                <Arrow />
              </div>
              <p>{s.tagline}</p>
              <span className="card-kind">
                {i === 0
                  ? "Pet portraits"
                  : i === 1
                    ? "Photo keepsakes"
                    : "Playful discoveries"}
              </span>
            </Link>
          ))}
        </div>
      </section>
      <section className="how" id="how-it-works">
        <h2>
          A little chemistry.
          <br />A real next step.
        </h2>
        <ol>
          <li>
            <strong>Find the moment</strong>
            <p>
              Replay sample traffic through our spike detector. Ask AI where
              your brand fits—and where it doesn’t.
            </p>
          </li>
          <li>
            <strong>Make it belong</strong>
            <p>
              Create a sponsorship for the visitor’s next action. Edit every
              word. Approve the final version.
            </p>
          </li>
          <li>
            <strong>Put it out there</strong>
            <p>
              Pay $10 in PayPal Sandbox for 30 minutes. See the approved ad
              appear and track views and clicks.
            </p>
          </li>
        </ol>
      </section>
      <p className="demo-note">
        This is a hackathon demo with fictional brands and sample publisher
        experiences. Traffic is simulated; AI and PayPal calls require connected
        accounts. No real payments or creator payouts.
      </p>
    </>
  );
}
