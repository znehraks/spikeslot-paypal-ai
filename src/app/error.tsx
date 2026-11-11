"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="empty-state">
      <h1>Let’s try that again.</h1>
      <p>
        The page could not load. Your saved campaign is still on the server.
      </p>
      <button className="button" onClick={reset}>
        Try again
      </button>
    </section>
  );
}
