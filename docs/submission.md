# SpikeSlot — English submission draft

Status: [English narrated video published](https://youtu.be/dIh_5OglSUo); [Devpost project prepared](https://devpost.com/software/spikeslot), with final contest submission pending the submitter's required attestations and survey answers. Actual Codex and Claude Code generation, Sandbox payment, cancellation, measurement and expiry checks are detailed in [verification.md](verification.md). The public hosted journey was verified separately.

## Tagline

Catch a rising creator. Make a sponsorship that belongs. Put it live with PayPal.

## The problem

A small independent website can have a moment of sudden attention without having an advertising team. Meanwhile, a small brand can miss useful placements because audience size alone says little about what a visitor is trying to do.

## What SpikeSlot does

SpikeSlot works inside an opt-in pool of publishers and advertisers. It detects a traffic spike, connects the advertiser’s own Codex or Claude Code over MCP to assess whether the advertiser fits the visitor's current task, and generates a sponsorship for an approved placement. The advertiser edits and approves the creative, pays for a fixed-duration placement in PayPal Sandbox, and sees that exact creative served with a view/click report.

The demonstration uses a pet-frame brand and three fictional publishers. A finished pet portrait or collage provides a natural next step toward a framed keepsake. A text-only name finder can be popular and still be a poor fit. The point is to find useful context and to decline poor matches, not to insert an ad everywhere.

## How we built it

Next.js, React, TypeScript, Zod and PGlite. The user’s Codex or Claude Code produces fit analysis and creative copy through three MCP tools: read the campaign, save recommendations and create an unapproved draft. There is no server AI API-key requirement. Campaign-scoped keys expire and can be revoked; stale results and duplicate draft retries are checked. Evidence quotes are checked against publisher profiles; model output cannot set price, duration or destination. PayPal Orders v2 creates and captures a server-owned USD 10 order. The server verifies order identity, amount, currency and completed capture before activating an immutable approved snapshot.

The original author-owned SpikeSlot project supplied its traffic spike state machine and browser viewability observer. New hackathon work includes fit analysis with abstention, site-specific creative generation, a human approval studio, a fixed-price USD sponsorship model, PayPal Sandbox integration, session-isolated replayable demos, and the English responsive UI. [Provenance](provenance.md) identifies the reused source commit and files.

## What the demo does not claim

- Traffic is simulated and labeled. The spike detector processes that sample history.
- Publisher profiles and the brand are fictional. The project does not crawl the entire internet or recruit publishers automatically.
- The sample publisher is a finished-result screen; pet-image generation is not implemented.
- Payments use PayPal Sandbox. No real funds, payouts, wallets or escrow are implemented.
- Viewability is a local browser measurement, not a fraud-audited billing guarantee.
- AI copy needs human review; there is no claim of improved conversion.

## Recorded demo — 2 minutes 26 seconds

| Time | Show | Explain |
| --- | --- | --- |
| 0:00–0:32 | Publisher pool, campaign brief and traffic replay | The brand and publishers are fictional; sample traffic runs through the real detector. |
| 0:32–1:02 | AI connection and actual recommendations | The user's Codex supplies the analysis; a popular text-only site is excluded on contextual fit. |
| 1:02–1:25 | Generated draft, headline edit and save | The advertiser reviews the publisher context and owns the approved wording. |
| 1:25–2:01 | Fixed terms, actual Sandbox checkout and capture receipt | USD 10 for 30 minutes; only a server-verified completed capture activates the saved creative. |
| 2:01–2:26 | Publisher placement and report | The ad appears below the normal save action; the report shows 1 view / 1 click. |

The recording uses actual local browser frames, English captions and synthetic English narration. Login and generation waiting are omitted. A companion SRT and original voiceover are available with the local MP4; no fixture output appears in the recording. The hosted journey was verified separately. Public YouTube playback at 1080p and anonymous oEmbed access were verified; final Devpost submission remains pending.

## Integration references

- [PayPal Orders v2](https://developer.paypal.com/api/orders/v2)
- [PayPal idempotency](https://developer.paypal.com/api/rest/reference/idempotency/)
- [MCP TypeScript SDK](https://ts.sdk.modelcontextprotocol.io/server)
- [Hackathon rules](https://paypalaihackathon.devpost.com/rules)
