# Isolated browser QA

This optional fixture tests rendering and local transitions without external credentials. It does not test a real AI call, payer approval or PayPal capture. Every fixture contains `QA fixture` in its brand/creative; order and capture IDs say `NOT-A-PAYMENT`.

1. Pick a new absolute directory inside this checkout's `data/` whose name begins `browser-qa-`. It must not exist. Set `QA_FIXTURE_DIR` to that path and run:

   ```sh
   pnpm exec vitest run --config vitest.browser-qa.config.ts
   ```

   The script refuses to overwrite a database or `refs/browser-qa.json`. For a later run, preserve the earlier reference JSON under a different filename before creating another one. Never reset a real demo database.

2. Start a separate local application process with `APP_URL=http://localhost:3611`, `PGLITE_DIR` set to that QA directory, and `SESSION_SECRET=qa-browser-only-not-a-production-secret-20261111`:

   ```sh
   pnpm exec next dev --hostname 127.0.0.1 --port 3611
   ```

   These environment variables must be exported or supplied on that command. Do not copy the QA secret into the real demo configuration. No provider credentials are required.

3. Use a separate browser context, or preserve the existing `spikeslot_session` cookie before installing the signed QA cookie from the ignored `refs/browser-qa.json`. Cookies are shared between localhost ports. Restore the original cookie afterward. Do not print or commit cookies.
4. Open `/campaign/<runId>` and `/studio/<draftId>` using the IDs from that reference file. Confirm two recommended publishers, one abstention, editable preview and persisted edits. Missing PayPal configuration must keep the draft editable.
5. Open the `checkoutId` studio with `?payment=cancelled`; it must remain unpaid. Open `activeId`, then the sample publisher link. A real browser view and click should update the fixture's real local measurement rows once each. The `endedId` placement must not serve.
6. Check 1500px desktop and 390px mobile layouts, keyboard focus, the reduced-motion setting, image loading and horizontal overflow.

There is no production seed endpoint or provider-success switch. The app never imports this script or automatically selects fixture data.
