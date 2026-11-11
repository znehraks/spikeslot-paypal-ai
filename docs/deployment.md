# Persistent hosted demo

`render.yaml` defines one Node web service in Singapore with a 1 GB persistent disk. PGlite runs in exactly one process and stores data under `/var/data/pglite`. Do not scale this service horizontally or mount this database in another process.

## Deploy

1. Connect this public repository to a Render Blueprint, selecting `feat/hackathon` and this repository's `render.yaml`.
2. Review the Starter instance and 1 GB disk charges in Render before creating the service. The configuration disables automatic deployments and preview services.
3. Enter the existing PayPal **Sandbox** client ID and secret in Render's secret environment fields. Never commit them. Render generates a new session secret.
4. The server reads Render's `RENDER_EXTERNAL_URL` for MCP links, same-origin checks, secure cookies and PayPal return URLs. If a custom domain is added, explicitly set `APP_URL` to its HTTPS origin.
5. Wait for `/api/health` to return `{"ok":true}`. This includes a database query. Record the deployed Git SHA and the resulting HTTPS URL.
6. On that URL, create a fresh campaign, replay traffic, connect a real AI client, review a draft, complete Sandbox checkout and confirm the placement/report. Check a second browser session cannot read the first campaign.
7. After a controlled redeploy of this dedicated service, verify the same campaign and payment receipt still exist. Keep the session secret and persistent disk unchanged. Do not reset the database or restore a disk snapshot as a routine deployment step.

Render manages HTTPS. Persistent-disk deployments can have brief downtime and cannot run multiple instances. This is a public **Sandbox judging demo**, with fictional publishers and session-scoped campaigns; it is not a production marketplace. The existing body limits, origin checks, expiring/revocable campaign keys and per-campaign save limits still apply. There is no production payout or live-payment path.

Do not claim deployment is complete from a successful build alone. Verify the live URL, actual integrations and persistence. Keep the demo available through the judging period. Source: [Render disks](https://render.com/docs/disks), [Blueprint reference](https://render.com/docs/blueprint-spec), [hackathon rules](https://paypalaihackathon.devpost.com/rules).
