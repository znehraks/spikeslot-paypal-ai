# SpikeSlot

## Tagline

Catch a rising creator. Make a sponsorship that belongs. Put it live with PayPal.

## Inspiration

An independent website can suddenly attract attention without having a sales team. A small brand can miss that moment because page views do not explain what a visitor is trying to do. We wanted to connect the right product to the right moment—and make saying “this is a poor fit” part of the product.

## What it does

SpikeSlot turns a traffic spike in an opt-in publisher pool into a reviewed, fixed-price sponsorship.

An advertiser writes a brief and connects their own Codex or Claude Code through MCP. Their AI reads the campaign and publisher facts, recommends suitable placements, explains exclusions, and writes an unapproved draft. The advertiser edits the copy and approves it in the web studio.

PayPal is the activation gate. The server creates a USD 10 Sandbox order for a 30-minute placement. Only a verified, completed capture activates the exact creative the advertiser approved. The sample publisher serves that saved creative, measures viewable impressions and clicks, and stops serving it when the placement expires.

Our demo uses a fictional framed-pet-photo brand and three fictional publishers. Someone who has just made a pet portrait has a useful next step: turn it into a physical keepsake. A popular, text-only pet-name finder can still be the wrong place to advertise that product.

## How we built it

The application uses Next.js, React, TypeScript, Zod and PGlite. The official MCP TypeScript SDK exposes three campaign-scoped tools: read the campaign, save recommendations and create a draft. The AI client supplies the reasoning under the user's own account; SpikeSlot needs no server AI key.

MCP cannot approve creative, set prices, place orders or move money. Connection keys expire and can be revoked. The server checks quoted evidence against publisher facts, rejects stale campaign versions, and makes draft retries idempotent.

PayPal Orders v2 handles server-side order creation and capture. We verify order ownership, amount, currency and completed capture before activation. Browser sessions isolate demo campaigns, while the approved creative and destination remain fixed.

## Challenges we ran into

The difficult part was preserving a clear boundary between an AI suggestion and a paid commitment. A campaign can change while the agent is working, a checkout response can be lost, and a user can retry an action. Version checks, immutable approval snapshots and idempotent payment reconciliation keep those events from silently changing the purchased placement.

## Accomplishments we're proud of

We connected both real Codex and Claude Code clients, saved their generated recommendations and drafts, and completed an actual PayPal Sandbox checkout for a generated sponsorship. We also verified cancellation, repeated capture reconciliation, paid-placement measurement and expiry. These are working integrations, with sample traffic clearly labeled.

## What we learned

The best recommendation is sometimes a refusal. Making context and evidence visible helps a person judge an AI suggestion. Keeping approval and payment outside the agent's toolset makes the final commitment explicit.

## What's next

Real publisher onboarding, inventory booking and production payout operations would be separate next steps. The current project is a focused judging demo: no live payments, creator payouts, internet-wide crawling or outbound messaging are implemented.

## Existing project disclosure

This significantly extends the author's earlier SpikeSlot project. We reused its traffic spike detector and browser viewability observer. New hackathon work includes MCP-based fit analysis and creative generation, the review studio, session-isolated demos, the fixed-price USD placement model, PayPal Sandbox integration and the English interface. See [provenance](provenance.md) for the source commit and reused files.

## Built with

PayPal Orders v2, Model Context Protocol, Codex, Claude Code, Next.js, React, TypeScript, Zod, PGlite.

## Repository and judging instructions

- [Hosted Sandbox demo](https://spikeslot-paypal-ai.onrender.com)
- [Public source and MIT license](https://github.com/znehraks/spikeslot-paypal-ai/tree/feat/hackathon)
- [Setup and complete demo journey](../README.md)
- [Connect Codex or Claude Code](mcp.md)
- [Verification scope](verification.md)

The demo brand and publishers are fictional. Traffic is simulated; the detector and payment/serving flow are real. The default product destination is an explicitly documented example URL. Use a PayPal **personal Sandbox buyer**, never a live account. AI client/model labels are self-reported. No conversion-lift or fraud-audited measurement claim is made.

The hosted demo is available. A 2-minute-26-second recording with English captions and synthetic English narration has been prepared. Its YouTube upload and final Devpost submission are in progress; this draft does not establish publication or receipt.
