# Connect your own AI

SpikeSlot exposes Streamable HTTP MCP at `APP_URL/api/mcp`. Your Codex or Claude Code does the reasoning and writing under your own account. SpikeSlot does not call a model provider or need an AI API key. Your client’s normal usage limits and billing still apply.

## Browser → client → browser

1. Start a campaign in the web app, save the brief and replay sample traffic.
2. In **Bring your own AI**, create a connection key. It grants access only to this campaign for 24 hours. Copy the appropriate commands. The raw key is returned once and is not persisted in browser storage or the server database; the database stores its SHA-256 hash.
3. Run the commands in the terminal from which you will start your AI client. Use a fresh chat so it loads the server. Keep the key out of git, shared logs, prompts and recordings.
4. Paste the provided AI request. Your client reads the facts, reasons about fit and saves recommendations and a draft.
5. Return to the original browser. Results refresh every five seconds when there are no unsaved brief edits. Open the saved draft, edit the copy, approve and pay with PayPal Sandbox.

`localhost` refers to the computer running the client. For another machine, deploy the app to persistent storage at an HTTPS origin using the [deployment instructions](deployment.md). The campaign panel supplies the actual hosted MCP URL. No CORS wildcard, cookie sharing or browser-session token is needed for MCP.

## Codex CLI

Replace the example values with the campaign panel’s values. Use the panel’s unique server name and token environment variable for each campaign. Sharing one token environment variable across multiple configured servers would point them all at the same campaign.

```sh
export SPIKESLOT_MCP_TOKEN='YOUR_CAMPAIGN_KEY'
codex mcp add spikeslot --url 'http://localhost:3610/api/mcp' --bearer-token-env-var SPIKESLOT_MCP_TOKEN
codex
```

If replacing an existing entry, run `codex mcp remove spikeslot` first, using the exact name you previously added. The environment variable must be available to the process starting Codex. Exporting it in a terminal does not automatically update an already running desktop app. In Codex desktop, add the same HTTP URL and bearer-token environment variable in MCP settings, ensure the desktop process receives that variable, then use a fresh chat. Desktop UI loading must be checked separately from CLI validation.

## Claude Code

```sh
claude mcp add --transport http --scope local spikeslot 'http://localhost:3610/api/mcp' --header 'Authorization: Bearer YOUR_CAMPAIGN_KEY'
claude
```

This uses local client configuration rather than a committed project `.mcp.json`. If replacing an existing entry, use `claude mcp remove --scope local spikeslot` first. Check `/mcp` in the new chat. The key is present in local client configuration and terminal history; treat them as private.

## Tool contract

| Tool                   | Input                                                                 | Result / boundary                                                                                                                                                                                 |
| ---------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get_campaign`         | No arguments                                                          | This campaign’s version, brief, sample traffic, publisher profiles, instructions, recommendations and draft review links                                                                          |
| `save_recommendations` | `version`, self-reported `source`, `analysis.recommendations`         | Exactly three distinct publishers. Each evidence quote must occur in its publisher’s description/flow; placement must match exactly. Requires replayed traffic. Returns the new campaign version. |
| `create_draft`         | Current `version`, UUID `requestId`, recommended `siteId`, `creative` | Stores unapproved copy and returns its review URL. Reuse requestId and identical input after a lost response; changed input requires a new requestId.                                             |

A brief edit or traffic replay invalidates existing recommendations and increments the version. After a conflict, read again and reassess. An old draft keeps its own brief snapshot. Editing or approving existing drafts remains web-only. A maximum of eight saved results per campaign bounds accidental client loops.

No tool approves a draft, changes payment terms or product URLs, creates/captures an order, sends messages or publishes an ad. Only the existing browser checkout and server-verified PayPal capture can activate the approved snapshot. Exact source checks cannot prove all generated prose is factually correct; human review remains required. Client/model names are self-reported, not verified identities.

**Disconnect AI** revokes the campaign key immediately on subsequent requests; creating another key invalidates the previous one. Existing saved work is retained. Other campaigns and old PayPal records are unaffected.

## Verification and references

The automated protocol tests use the official MCP client and exercise initialization, discovery, read/write, auth, revocation, stale versions, grounding, strict input schemas and retry idempotency. They supply deterministic test copy and are not evidence of real model generation. Actual-client verification is recorded separately in [verification.md](verification.md).

- [MCP TypeScript SDK v1](https://ts.sdk.modelcontextprotocol.io/server)
- [Claude Code MCP](https://code.claude.com/docs/en/mcp)
- Codex flags verified against the installed `codex mcp add --help` and `codex exec --help`.
