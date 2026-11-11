"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { publisher } from "@/core/sites";
import type { Plan, SiteId } from "@/core/model";
import { PublisherArt, CreativePreview, Notice } from "./common";
import { watchView, unwatchView } from "@/sdk/viewability";
import { request } from "./api";
type Slot = { plan: Plan; impressionId: string };
export function Publisher({
  siteId,
  planId,
}: {
  siteId: SiteId;
  planId?: string;
}) {
  const site = publisher(siteId),
    [slot, setSlot] = useState<Slot | null>(null),
    [error, setError] = useState(""),
    [loaded, setLoaded] = useState(false),
    [copied, setCopied] = useState("");
  const ad = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!planId) return;
    let ignore = false;
    request<Slot | null>(`/api/plans/${planId}/slot`, { siteId })
      .then((s) => {
        if (!ignore) {
          setSlot(s);
          setLoaded(true);
        }
      })
      .catch((e) => {
        if (!ignore) {
          setError(e.message);
          setLoaded(true);
        }
      });
    return () => {
      ignore = true;
    };
  }, [siteId, planId]);
  useEffect(() => {
    if (!slot || !ad.current) return;
    const node = ad.current;
    watchView(node, () => {
      request(`/api/plans/${slot.plan.id}/event`, {
        impressionId: slot.impressionId,
        kind: "view",
      }).catch((e) => setError(e.message));
    });
    const timer = setTimeout(
      () => setSlot(null),
      Math.max(0, slot.plan.endsAt! - Date.now()),
    );
    return () => {
      unwatchView(node);
      clearTimeout(timer);
    };
  }, [slot]);
  async function copy(name: string) {
    try {
      await navigator.clipboard.writeText(name);
      setCopied(name);
    } catch {
      setCopied("Select and copy the name you like.");
    }
  }
  return (
    <section className={`publisher-page theme-${siteId}`}>
      <div className="publisher-nav">
        <span>{site.name}</span>
        <Link href={planId ? `/studio/${planId}` : "/"}>Back to SpikeSlot</Link>
      </div>
      <div className="publisher-result">
        <span className="sample-label">Sample result</span>
        <h1>
          {siteId === "royal-pets"
            ? "An excellent muse."
            : siteId === "pet-collage"
              ? "All your favorite moments."
              : "Meet your tiny legend."}
        </h1>
        <p>{site.tagline}</p>
        {siteId === "pet-names" ? (
          <div className="name-results">
            {["Miso", "Pickle", "Sir Floof"].map((name) => (
              <button key={name} onClick={() => copy(name)}>
                {name}
                <span>Copy name</span>
              </button>
            ))}
            <p role="status">
              {copied ? `Copied: ${copied}` : "Choose a name that feels right."}
            </p>
          </div>
        ) : (
          <>
            <PublisherArt siteId={siteId} large />
            <a
              className="button"
              href="/art/pet.jpg"
              download="spikeslot-sample-pet.jpg"
            >
              Save sample photo
            </a>
          </>
        )}
        <div className="publisher-slot">
          {error && <Notice>{error}</Notice>}
          {slot ? (
            <div ref={ad}>
              <CreativePreview
                creative={slot.plan.creative}
                brief={slot.plan.brief}
                href={slot.plan.brief.destination}
                onClick={() => {
                  request(`/api/plans/${slot.plan.id}/event`, {
                    impressionId: slot.impressionId,
                    kind: "click",
                  }).catch((e) => setError(e.message));
                }}
              />
            </div>
          ) : (
            <p className="empty-slot">
              {planId && !loaded
                ? "Checking your sponsorship…"
                : "No active sponsorship in this sample slot."}
            </p>
          )}
        </div>
        <p className="caption">
          This is a sample finished-result screen. Pet generation and photo
          uploading are outside this demo. Sample photo:{" "}
          <a
            href="https://unsplash.com/photos/y8Tqsd2ANCg"
            target="_blank"
            rel="noopener noreferrer"
          >
            Ahmet Sali / Unsplash
          </a>
          .
        </p>
      </div>
    </section>
  );
}
