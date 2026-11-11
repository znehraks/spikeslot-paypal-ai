# SpikeSlot — English submission draft

Status: submission text draft. Real Codex and Claude Code MCP generation passed. The Codex-generated draft completed browser review, actual PayPal Sandbox approval/capture and paid-ad measurement (1 view / 1 click). Earlier cancellation and natural paid-ad expiry checks also passed. Review and record the connected journey before publishing or submitting. See verification.md for precise scope.

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

## Recording outline — approximately 2 minutes 40 seconds

| Time      | Show                                                                | Explain                                                                                                                                     |
| --------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00–0:20 | Campaign brief and sample publisher pool                            | A brand wants to meet people at a useful moment. Publishers have already opted in.                                                          |
| 0:20–0:45 | Replay traffic; connect own AI over MCP; save recommendations       | Traffic is simulated. The detector is real. Point out the popular but excluded name finder.                                                 |
| 0:45–1:15 | Generate a real draft; edit and save its headline                   | The sponsorship uses the actual result-screen context. A person approves the final copy.                                                    |
| 1:15–1:55 | Approve, complete actual PayPal Sandbox checkout, return to receipt | The server checks the completed capture and activates that exact snapshot. Show the Sandbox order/capture evidence, avoiding personal data. |
| 1:55–2:25 | Open publisher page, reveal sponsored slot, click, return to report | The ad is below the normal save action. Viewability and click counts update once.                                                           |
| 2:25–2:40 | Closing screen                                                      | Contextual fit, human approval and a verified transaction make the placement useful and accountable.                                        |

Record the real connected environment. Keep fixtures out of the final video. Verify the published video URL, its accessibility and the final Devpost fields separately before submission.

## Integration references

- [PayPal Orders v2](https://developer.paypal.com/api/orders/v2)
- [PayPal idempotency](https://developer.paypal.com/api/rest/reference/idempotency/)
- [MCP TypeScript SDK](https://ts.sdk.modelcontextprotocol.io/server)
- [Hackathon rules](https://paypalaihackathon.devpost.com/rules)
