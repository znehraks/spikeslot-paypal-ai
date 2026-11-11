# Verification — November 11, 2026

## Automated checks

- `pnpm test`: **58 tests passed**, five files, last run 22:40 KST. Includes reused spike regression tests plus new payment, AI contract, HTTP trust-boundary and browser viewability tests.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm build`: passed, all application/API routes compiled. PGlite is loaded as a server external package to avoid a development bundler URL/ filesystem error found during browser QA.
- `E2E_BASE_URL=http://localhost:3611 pnpm e2e`: **4 HTTP integration tests passed** against the running application. These test actual campaign persistence, traffic replay, session isolation, origin/body validation and rejection of client-owned payment amounts. They do not launch a browser or contact payment/AI providers.
- Separate browser-fixture setup: one setup test passed. It seeds only a new isolated QA database and is not included in the 58 normal tests.

## Browser checks performed

Ego Chromium, 1500px desktop and 390px mobile emulation. These are browser checks, not physical-device testing.

| Check | Result | Evidence boundary |
| --- | --- | --- |
| Create campaign, edit brief, save, replay traffic | Passed | Real application and persisted database |
| Missing OpenAI configuration | Explicit error, no fake recommendations | Real API error path; no AI call |
| Two recommended publishers, one excluded publisher | Correct controls and copy rendered | Explicitly seeded QA analysis; not model quality evidence |
| Edit headline, update preview, save | Passed | QA draft, real edit API/database |
| Missing PayPal configuration | Draft remains editable; no payment or activation | Real setup-error path |
| Cancelled checkout | Remains payment-pending; ad inactive | Seeded checkout plus actual cancel-return UI |
| Active sponsored slot below the sample save action | Appears with fixed creative | Seeded active plan; no PayPal transaction |
| At least half visible for one second, then CTA click | Report reached 1 view / 1 click | Real observer, events, database and report on a fixture plan |
| Ended plan | No ad served | Seeded ended plan; actual serving check |
| Horizontal overflow | None on home, campaign, draft and cancellation layouts at 390px | Browser emulation |

Desktop/mobile screenshots are retained in ignored local review assets, not presented as a completed real-payment demo. The QA brand and payment IDs visibly identify fixtures.

## Still required before claiming an end-to-end submission demo

1. Configure and authenticate an OpenAI API project/model. Run actual fit analysis and creative generation, inspect copy quality and grounding.
2. Sign in to PayPal Developer, configure a Sandbox merchant app and separate personal buyer. Complete a real Sandbox approval/capture, cancellation and reconciliation attempt; verify order/capture IDs in PayPal.
3. Repeat the publisher/report path on that server-verified payment and inspect expiry. Automated expiry tests and fixture browser expiry already pass.
4. Review the visual direction, final English copy, and recorded demo. Publish the video and submit to Devpost only after their own checks.

No real money was charged. No emails or DMs were sent. No public deployment, creator payout, demo video publication or Devpost submission has been performed.
