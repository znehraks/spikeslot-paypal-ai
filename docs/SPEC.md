# SpikeSlot hackathon MVP contract

## Accepted product

A + B: discover opportunities within an opt-in publisher pool and compose a tailored sponsorship. The AI must explain fit and abstain for poor matches.

## Required path

1. An isolated demo run starts with three publisher profiles (Royal Pets, Pet Collage, Pet Names) and a PetFrame brief. The brief is editable.
2. A clearly labeled synthetic traffic replay passes through a real spike detector. Raw metrics and model interpretation stay separate.
3. The user connects their own Codex or Claude Code through MCP. Their client reads the campaign and returns structured fit recommendations grounded in publisher profiles and advertiser requirements.
4. The connected client generates and saves a draft for one recommended placement using supplied product facts only. The user edits and approves it in the web studio. MCP cannot approve, create orders, capture or activate ads.
5. One sponsorship costs USD 10 for 30 minutes of placement. No impression guarantee; no wallet or CPM charging. Amount and duration are server-owned.
6. PayPal Sandbox Orders API creates and captures the order on the server. Verify amount, currency, ownership and completed status, persist idempotently, then activate the approved snapshot.
7. The publisher page serves the stored approved creative, records viewable impressions and clicks, and stops at expiry. Payout is not implemented or claimed.
8. A fresh run allows repeatable judging without deleting historical records.

## Screens

Campaign brief; opportunities; sponsorship studio; campaign receipt/report; three sample publisher result pages. English, responsive, keyboard usable.

## Scope boundaries

No arbitrary website crawl, public marketplace onboarding, outbound sending, AI image generation, autonomous spending, auctions, real payouts, multi-currency, distributed operation.

## Security and failure behavior

Cookie-scoped ownership, same-origin mutation checks, bounded inputs and MCP result submissions, no raw HTML from models, no model authority over payment parameters, idempotent captures and events, validated destinations, explicit external-provider failures, persisted approved snapshots.

## Reuse

Inspect and selectively adapt original SpikeSlot feat/mvp commit 4abf7bdd6ce15850cae730c8cc8a7d06779b6700. Record each adapted component in provenance.md. Do not copy credentials, data, account information or the original history.

## Verification

Typecheck, lint, relevant unit/integration tests and production build. Browser checks for happy path, rejected match, edited creative, payment cancellation, duplicate requests, expiry, replay/reset, desktop and mobile layouts. Real AI / real sandbox / mocked automated tests must be reported separately.

## Schedule

Deadline 2026-11-12 20:00 UTC (2026-11-13 05:00 KST). Internal submission target 2026-11-12 23:00 KST. Deliver runnable MVP and English submission materials; actual Devpost submission and video publication are separately tracked.
