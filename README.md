# SpikeSlot

**Catch a good moment.** Find a rising independent publisher, make a sponsorship that belongs there, and activate it with PayPal Sandbox.

SpikeSlot keeps the web studio and PayPal checkout while **your own Codex or Claude Code supplies the AI through MCP**. No server OpenAI key is needed. The agent reads your campaign, saves grounded recommendations and creates unapproved drafts; you edit, approve and pay in the browser. Real Codex and Claude Code generation, plus a Codex-generated draft’s PayPal Sandbox checkout and ad measurement, have been verified. See [MCP setup](docs/mcp.md) and the evidence boundaries in [verification](docs/verification.md).

**[Open the hosted Sandbox demo](https://spikeslot-paypal-ai.onrender.com).** Use your own Codex or Claude Code and a PayPal personal Sandbox buyer. The brand, publishers and traffic are labeled examples; no real payment or creator payout occurs.

## Run locally

Requirements: Node.js 22 or newer, pnpm 10, a writable local disk. Use one application process per database directory.

```sh
pnpm install --frozen-lockfile
cp -n .env.example .env.local
```

Edit `.env.local` locally. Never commit it or paste credentials into an issue:

| Setting                                    | Purpose                                                                                                                                        |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `APP_URL`                                  | Exact browser origin, initially `http://localhost:3610`. Use this URL in the browser, including the port.                                      |
| `SESSION_SECRET`                           | A random secret of at least 32 characters. Generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. |
| `PGLITE_DIR`                               | Persistent local database directory; default `./data/pglite`.                                                                                  |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | Credentials from a **Sandbox** REST app in the PayPal Developer Dashboard.                                                                     |

```sh
pnpm dev
```

Open **http://localhost:3610**. To run a production build: `pnpm build`, then `pnpm start`. The app binds to loopback by default. Restart your own app server after changing provider credentials. Do not run development and production against the same database at once.

Without PayPal credentials you can explore publishers, save a brief, replay traffic and connect your AI. Checkout requires Sandbox credentials. No fixture is substituted for a client-generated result or payment.

For a persistent HTTPS judging demo, use the single-instance [Render deployment configuration](docs/deployment.md). Hosting requires a persistent disk; a stateless deployment cannot preserve this database.

## Try the journey

1. Start a campaign. Review the fictional PetFrame brief, including its example product URL, or provide your own product facts and HTTPS link.
2. Replay the clearly labeled sample traffic. The reused detector evaluates three publishers.
3. Select **Create / replace connection key**, connect Codex or Claude Code using the displayed commands, and send the provided request. Your AI assesses all three publishers, with source quotes and placements validated by the server.
4. Ask your AI to create a draft for a recommended publisher. Results refresh on the campaign page. Open the saved draft, edit and save the copy, then review the preview.
5. Approve the creative and open PayPal Sandbox. Use a **personal Sandbox buyer account different from the app's merchant account**. The server owns the USD 10 price and 30-minute duration.
6. Complete Sandbox checkout. The return page verifies and captures the server-owned order. An incomplete, cancelled or mismatched payment cannot activate the ad. If a response is lost, **Verify this order** reconciles the same order.
7. Open the sample publisher page in the same browser. Scroll to the sponsored slot. At least half of it must be visible in an active tab for one continuous second to count a view. Click the CTA, then inspect the report.
8. Start another campaign to repeat. Historical records are retained; nothing is reset or deleted.

The sample publisher pages show finished-result experiences, not a working pet-image generator. The sample photo is credited to Ahmet Sali. The default `example.com/petframe` URL is a placeholder, not a live shop. Change it before a final recorded demonstration if a real product page is needed.

## Verify

```sh
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

With an application already running, `pnpm e2e` runs HTTP and MCP integration checks against `http://localhost:3610`. Set `E2E_BASE_URL` for another port. These checks create their own session-isolated campaigns, retain those records and make no external AI or payment calls.

Tests cover the spike detector, signed sessions and same-origin JSON boundaries, grounded AI response validation, snapshot locking, payment amount/currency/ownership checks, cancellation, concurrent retries, lost capture responses, viewability, event deduplication and expiry. They make **no paid external calls**.

For an explicitly seeded visual QA environment, see [browser QA instructions](docs/browser-qa.md). Those records are visibly labeled `QA fixture` and kept in a separate database. Never record them as a live AI or PayPal demo.

## Implementation and limits

Next.js / React / TypeScript, Zod input contracts and embedded PostgreSQL via PGlite. The official MCP TypeScript SDK exposes a stateless Streamable HTTP endpoint; the user’s AI client generates the content. PayPal Orders v2 remains server-side. A signed HttpOnly, SameSite=Lax cookie isolates each demo. Browser mutations require an exact same-origin JSON POST. MCP uses a separate campaign-scoped bearer key, stored only as a hash, expiring after 24 hours and revocable in the browser. An approved creative and destination remain fixed, even if the campaign brief changes later.

This is a **single-process Sandbox judging demo**, not a production multi-tenant marketplace. Sessions last one day. PGlite needs persistent disk and must not be shared by several processes. Do not deploy this as a stateless function. A production marketplace would additionally need account authentication, stronger abuse controls and production storage. There is no webhook reconciliation, refund handling, fraud-audited reporting, real creator payout, cross-site SDK onboarding, website crawling or outbound email/DM sending.

One plan represents one demo placement, selected explicitly on the sample publisher URL. It is not a production inventory booking or global ad auction. Traffic is synthetic; the detector, editable snapshot, server payment verification and measurement code are real. MCP has no authority over price, duration, payment credentials, destination, approval or capture. Up to eight recommendation/draft saves are allowed per campaign; exact draft retries are idempotent. Client/model labels are self-reported, not attestation.

## Reuse and submission

The original author-owned SpikeSlot contributes its spike detector and viewability observer. See [source provenance](docs/provenance.md), [MVP contract](docs/SPEC.md), [asset licenses](docs/assets.md), and [English submission draft](docs/submission.md). The new AI matching, sponsorship studio, fixed-price USD order flow, PayPal integration and isolated demo experience were built for this hackathon.

Code: MIT. Photos and fonts retain their own licenses. [Watch the public English narrated demo](https://youtu.be/dIh_5OglSUo). The [Devpost project](https://devpost.com/software/spikeslot) was submitted to the PayPal AI Hackathon; the submission receipt and persisted Submitted status were verified on November 12, 2026 KST.
