# Verification — November 11, 2026

## Current MCP implementation and real-client verification

The application now uses the advertiser’s own Codex or Claude Code through MCP instead of server-side OpenAI calls. Earlier OpenAI setup findings below are historical. No server AI key is needed.

- **60 unit/protocol tests passed**: official MCP client initialization/discovery/read/write; token ownership, hash storage, rotation, expiry and revocation; exact evidence and placement; strict inputs; stale versions; draft retry idempotency; existing PayPal and measurement regressions.
- **Five HTTP integration tests passed** against localhost:3614, including actual MCP HTTP results read back through the browser API. A bearer key cannot authorize browser checkout.
- Typecheck, lint and production builds passed. Separate `.next-mcp` and `.next-mcp-final` output directories preserve earlier running builds. Final connection instructions use a different token environment variable and server name for each campaign.
- **Codex CLI, authenticated through ChatGPT**: real `get_campaign` → `save_recommendations` → `create_draft` calls succeeded. It recommended Royal Pets and Growing Together, skipped the text-only Name That Floof, and generated “A royal portrait deserves a wooden frame.” The persisted draft appeared in the web editor. Its client/model label is explicitly self-reported.
- **Claude Code, authenticated through its own account**: independently read a separate campaign, assessed all three publishers and saved “Your Royal Highness Deserves a Real Frame.” The web editor displayed the real generated draft. No approval or payment occurred through MCP.
- **Real AI-to-PayPal journey**: reviewed the Codex draft in the browser, approved the USD 10 Sandbox checkout, completed buyer approval, and observed the server capture/activation. A separate PayPal Orders GET confirmed order and capture `COMPLETED`, matching amount/currency/plan/capture and `final_capture: true`. The publisher showed the fixed approved copy; the real browser observer/report recorded **1 view / 1 click**. No real money moved.
- **Natural expiry**: the earlier actual paid placement from the 23:15 check was past its stored expiry and the running application returned no ad. This verifies real paid-ad expiry without changing the clock or stored dates. The new MCP-generated paid placement’s own 30-minute period was still running at handoff.
- **Browser QA**: existing desktop visual style preserved; connection creation, client selector, refresh, draft review and key revocation checked. 390px mobile emulation had no horizontal overflow on the draft and final connection panel. The final panel was served at localhost:3615 with its own QA database. No physical-device test or Codex desktop-settings UI test is claimed.
- Codex and Claude QA keys were revoked and both returned HTTP 401 afterward. Client configs/logs are ignored, private local files; no persistent user MCP configuration was changed.

Private local evidence: `refs/mcp-codex-client-20261111.jsonl`, `refs/mcp-claude-client-20261111.jsonl`, `refs/mcp-paid-verification-20261111.json`, `refs/mcp-paypal-independent-20261111.json`, `refs/paypal-natural-expiry-20261111.json`, and `refs/mcp-*.png`. These are intentionally not committed because logs may contain private campaign/client context.

## Earlier checks before MCP conversion

## Automated checks

- `pnpm test`: **58 tests passed**, five files, last run 22:40 KST. Includes reused spike regression tests plus new payment, AI contract, HTTP trust-boundary and browser viewability tests.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm build`: passed, all application/API routes compiled. PGlite is loaded as a server external package to avoid a development bundler URL/ filesystem error found during browser QA.
- `E2E_BASE_URL=http://localhost:3611 pnpm e2e`: **4 HTTP integration tests passed** against the running application. These test actual campaign persistence, traffic replay, session isolation, origin/body validation and rejection of client-owned payment amounts. They do not launch a browser or contact payment/AI providers.
- Separate browser-fixture setup: one setup test passed. It seeds only a new isolated QA database and is not included in the 58 normal tests.

## Browser checks performed

Ego Chromium, 1500px desktop and 390px mobile emulation. These are browser checks, not physical-device testing.

| Check                                                | Result                                                          | Evidence boundary                                            |
| ---------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------ |
| Create campaign, edit brief, save, replay traffic    | Passed                                                          | Real application and persisted database                      |
| Missing OpenAI configuration                         | Explicit error, no fake recommendations                         | Real API error path; no AI call                              |
| Two recommended publishers, one excluded publisher   | Correct controls and copy rendered                              | Explicitly seeded QA analysis; not model quality evidence    |
| Edit headline, update preview, save                  | Passed                                                          | QA draft, real edit API/database                             |
| Missing PayPal configuration                         | Draft remains editable; no payment or activation                | Real setup-error path                                        |
| Cancelled checkout                                   | Remains payment-pending; ad inactive                            | Seeded checkout plus actual cancel-return UI                 |
| Active sponsored slot below the sample save action   | Appears with fixed creative                                     | Seeded active plan; no PayPal transaction                    |
| At least half visible for one second, then CTA click | Report reached 1 view / 1 click                                 | Real observer, events, database and report on a fixture plan |
| Ended plan                                           | No ad served                                                    | Seeded ended plan; actual serving check                      |
| Horizontal overflow                                  | None on home, campaign, draft and cancellation layouts at 390px | Browser emulation                                            |

Desktop/mobile screenshots are retained in ignored local review assets, not presented as a completed real-payment demo. The QA brand and payment IDs visibly identify fixtures.

## Actual PayPal Sandbox verification — 23:15 KST

The existing production build at commit `097cae2` ran on loopback port 3613 with a new isolated database, `data/paypal-qa-20261111-2311`. Two drafts were seeded with the visible label **PayPal QA — manual copy, no AI**. No recommendations, AI output, order IDs, captures or active states were fabricated for this check.

- Created a Sandbox merchant app and separate US personal buyer; authenticated the app with OAuth HTTP 200. Credentials remain in ignored local files with mode 0600.
- Approved an actual USD 10.00 Sandbox order in the browser. The application's server captured it, independently retrieved it from PayPal and activated the approved sponsorship. PayPal reported `COMPLETED` for both order and capture, with `final_capture: true`.
- Repeated the application's capture endpoint twice. The order ID, capture ID and activation time stayed unchanged.
- Opened the paid publisher placement, kept it visible and clicked its CTA. The real browser observer and report recorded **1 view / 1 click**. The CTA uses the documented example.com sample destination.
- Cancelled a second actual Sandbox checkout using PayPal's return action. PayPal retained `PAYER_ACTION_REQUIRED` with no capture. The application retained its unpaid checkout, returned HTTP 409 `payment_pending` on verification, suppressed the ad slot and reused the same order on retry.

Provider order/capture references and assertion results are retained in ignored `refs/paypal-verification-20261111.json`; the paid placement screenshot is `refs/paypal-paid-ad-20261111.png`. These checks establish the Sandbox payment and measurement path with manual input. They do not establish AI quality, natural expiry of this particular paid placement, or production readiness. No application source changes were needed.

## Remaining release / submission steps

The real client-to-payment demo path is verified. Review the final visual/copy choices and record the actual connected journey before publication. Validate the hosted app/video URLs and Devpost fields separately. The current application is local; no public deployment, creator payout, outbound message, demo-video publication or Devpost submission has been performed. These publication steps are outside this implementation task.
