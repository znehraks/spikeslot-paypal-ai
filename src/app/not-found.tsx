import Link from "next/link";
export default function NotFound() {
  return (
    <section className="empty-state">
      <h1>This one isn’t here.</h1>
      <p>
        The page may belong to another browser session. Start a fresh demo to
        explore.
      </p>
      <Link className="button" href="/">
        Back to discover
      </Link>
    </section>
  );
}
