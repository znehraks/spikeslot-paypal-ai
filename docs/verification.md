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

## Actual PayPal Sandbox verification — 23:15 KST

The existing production build at commit `097cae2` ran on loopback port 3613 with a new isolated database, `data/paypal-qa-20261111-2311`. Two drafts were seeded with the visible label **PayPal QA — manual copy, no AI**. No recommendations, AI output, order IDs, captures or active states were fabricated for this check.

- Created a Sandbox merchant app and separate US personal buyer; authenticated the app with OAuth HTTP 200. Credentials remain in ignored local files with mode 0600.
- Approved an actual USD 10.00 Sandbox order in the browser. The application's server captured it, independently retrieved it from PayPal and activated the approved sponsorship. PayPal reported `COMPLETED` for both order and capture, with `final_capture: true`.
- Repeated the application's capture endpoint twice. The order ID, capture ID and activation time stayed unchanged.
- Opened the paid publisher placement, kept it visible and clicked its CTA. The real browser observer and report recorded **1 view / 1 click**. The CTA uses the documented example.com sample destination.
- Cancelled a second actual Sandbox checkout using PayPal's return action. PayPal retained `PAYER_ACTION_REQUIRED` with no capture. The application retained its unpaid checkout, returned HTTP 409 `payment_pending` on verification, suppressed the ad slot and reused the same order on retry.

Provider order/capture references and assertion results are retained in ignored `refs/paypal-verification-20261111.json`; the paid placement screenshot is `refs/paypal-paid-ad-20261111.png`. These checks establish the Sandbox payment and measurement path with manual input. They do not establish AI quality, natural expiry of this particular paid placement, or production readiness. No application source changes were needed.

## Still required before claiming an end-to-end submission demo

1. Configure and authenticate an OpenAI API project/model. Run actual fit analysis and creative generation, inspect copy quality and grounding.
2. Repeat the complete AI-to-PayPal journey using actual generated and reviewed copy. The independent Sandbox payment path above passed.
3. Inspect natural expiry of the paid placement. Automated expiry tests and fixture browser expiry already pass; paid placement/report checks above also passed.
4. Review the visual direction, final English copy, and recorded demo. Publish the video and submit to Devpost only after their own checks.

No real money was charged. No emails or DMs were sent. No public deployment, creator payout, demo video publication or Devpost submission has been performed.
