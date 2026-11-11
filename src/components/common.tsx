import Link from "next/link";
import Image from "next/image";
import type { SiteId, Creative, Brief, Traffic } from "@/core/model";
import { benefitFor } from "@/core/model";

export function Arrow() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}
export function Mark() {
  return (
    <svg
      viewBox="0 0 32 32"
      width="32"
      height="32"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 23 11 9l5 10 5-15 8 22"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinejoin="round"
      />
    </svg>
  );
}
export function Header() {
  return (
    <header className="site-header">
      <Link href="/" className="wordmark">
        <Mark />
        spikeslot<span className="wordmark-dot">.</span>
      </Link>
      <nav aria-label="Main">
        <Link href="/">Discover</Link>
        <Link href="/#how-it-works">How it works</Link>
      </nav>
      <span className="sandbox-tag">Sandbox edition</span>
    </header>
  );
}
export function Footer() {
  return (
    <footer className="site-footer">
      <span>Good timing. Better company.</span>
      <span>Opt-in publishers · Sample traffic · No real charges</span>
    </footer>
  );
}
export function PublisherArt({
  siteId,
  large = false,
}: {
  siteId: SiteId;
  large?: boolean;
}) {
  if (siteId === "royal-pets")
    return (
      <div className={`publisher-art royal ${large ? "large" : ""}`}>
        <Image
          src="/art/pet.jpg"
          alt="Orange tabby cat in a sample pet portrait"
          fill
          sizes={
            large
              ? "(max-width: 800px) 100vw, 50vw"
              : "(max-width: 700px) 100vw, 40vw"
          }
          priority={large}
        />
        <div className="art-type">
          A very
          <br />
          <em>good muse.</em>
        </div>
        <span className="art-stamp">ROYAL PETS</span>
      </div>
    );
  if (siteId === "pet-collage")
    return (
      <div className={`publisher-art collage ${large ? "large" : ""}`}>
        <div className="collage-title">
          the little
          <br />
          <em>things.</em>
        </div>
        <div className="polaroid one">
          <Image
            src="/art/pet.jpg"
            alt="Pet photo in a sample collage"
            fill
            sizes="240px"
          />
          <span>always you.</span>
        </div>
        <div className="polaroid two" aria-hidden="true">
          <Image src="/art/pet.jpg" alt="" fill sizes="240px" />
          <span>my favorite.</span>
        </div>
        <span className="art-stamp">GROWING TOGETHER</span>
      </div>
    );
  return (
    <div className={`publisher-art names ${large ? "large" : ""}`}>
      <span className="names-intro">a name with personality</span>
      <div className="name-list">
        <span>Miso.</span>
        <em>Pickle.</em>
        <span>Sir Floof.</span>
      </div>
      <span className="art-stamp">NAME THAT FLOOF</span>
    </div>
  );
}
export function TrafficChart({ traffic }: { traffic: Traffic }) {
  const max = Math.max(...traffic.points, 1),
    points = traffic.points
      .map(
        (v, i) =>
          `${(i / (traffic.points.length - 1)) * 270},${44 - (v / max) * 38}`,
      )
      .join(" ");
  return (
    <div className="traffic">
      <div className="traffic-summary">
        <strong>
          {traffic.multiplier}× <small>baseline</small>
        </strong>
        <span>{traffic.rate} visits/min</span>
      </div>
      <svg
        viewBox="0 0 270 50"
        role="img"
        aria-label={`Simulated traffic: ${traffic.baseline} baseline to ${traffic.rate} visits per minute over 90 minutes`}
      >
        <path d="M0 45h270" stroke="currentColor" opacity=".2" />
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
      <div className="chart-label">
        <span>90 min ago</span>
        <span>Simulated · {traffic.stage}</span>
      </div>
    </div>
  );
}
export function CreativePreview({
  creative,
  brief,
  href,
  onClick,
}: {
  creative: Creative;
  brief: Brief;
  href?: string;
  onClick?: () => void;
}) {
  const benefit = benefitFor(brief, creative);
  return (
    <aside className="creative-preview" aria-label="Sponsorship preview">
      <div className="sponsor-label">Sponsored by {brief.brand}</div>
      <h3>{creative.headline}</h3>
      <p>{creative.description}</p>
      {benefit && <p className="benefit">{benefit}</p>}
      {href ? (
        <a
          className="button small"
          href={href}
          target="_blank"
          rel="sponsored noopener noreferrer"
          onClick={onClick}
        >
          {creative.cta}
          <Arrow />
        </a>
      ) : (
        <span className="button small preview-cta">
          {creative.cta}
          <Arrow />
        </span>
      )}
    </aside>
  );
}
export function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="notice" role="alert">
      {children}
    </p>
  );
}
