# SpikeSlot hackathon workspace

- Follow docs/SPEC.md. Preserve unrelated work and the original SpikeSlot repository.
- All monetary amounts are integer USD cents; never use the original micro-won ledger.
- Real AI and PayPal Sandbox integrations must not silently fall back to fixtures. Test doubles are test-only.
- Only a server-verified completed capture can activate an approved sponsorship.
- Preserve the approved creative snapshot; never run AI on the ad-serving path.
- Secrets belong in ignored .env.local, never client bundles, logs, commits or docs.
- Browser mutations require same-origin checks; each demo run is scoped to its owner session.
- No outbound email or DM sending.
- Verify meaningful logic and the end-to-end flow before reporting completion.
- Linear: ZNE-760, project SpikeSlot — PayPal AI Hackathon.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
