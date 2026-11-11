"use client";
import { useState } from "react";
import { request } from "./api";
import { Notice } from "./common";

type Connection = { token: string; expiresAt: number; url: string };
export function AgentConnection({
  runId,
  prompt,
  disabled,
}: {
  runId: string;
  prompt: string;
  disabled: boolean;
}) {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [client, setClient] = useState("codex");
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  async function connect(disconnect = false) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await request<Connection>(
        `/api/runs/${runId}/${disconnect ? "disconnect" : "connect"}`,
        {},
      );
      setConnection(disconnect ? null : result);
      setMessage(
        disconnect
          ? "Connection disconnected. Saved drafts are still available."
          : "Key created. Connect your AI using the steps below.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const name = `spikeslot-${runId.slice(0, 8)}`;
  const tokenEnv = `SPIKESLOT_MCP_TOKEN_${runId.slice(0, 8).toUpperCase()}`;
  const command = connection
    ? client === "codex"
      ? `export ${tokenEnv}='${connection.token}'
codex mcp add ${name} --url '${connection.url}' --bearer-token-env-var ${tokenEnv}
codex`
      : `claude mcp add --transport http --scope local ${name} '${connection.url}' --header 'Authorization: Bearer ${connection.token}'
claude`
    : "";
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage("Copied.");
    } catch {
      setError("Copy was blocked. Select and copy the text below.");
    }
  }
  return (
    <section
      className="agent-connection"
      id="connect-ai"
      aria-labelledby="connect-heading"
    >
      <div className="section-heading">
        <h2 id="connect-heading">Bring your own AI</h2>
        <span>Codex or Claude Code · MCP</span>
      </div>
      <p>
        Your AI reads this campaign, recommends publishers and writes drafts.
        You review the words and pay here. Use your own AI account; SpikeSlot
        needs no AI API key.
      </p>
      <div className="actions">
        <button
          className="button secondary"
          disabled={busy || disabled}
          onClick={() => connect()}
        >
          {busy ? "Updating…" : "Create / replace connection key"}
        </button>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => connect(true)}
        >
          Disconnect AI
        </button>
      </div>
      {disabled && (
        <p className="muted">
          Save your brief and replay sample traffic first.
        </p>
      )}
      {connection && (
        <div className="connection-steps">
          <label>
            1. Choose your AI{" "}
            <select value={client} onChange={(e) => setClient(e.target.value)}>
              <option value="codex">Codex CLI</option>
              <option value="claude">Claude Code</option>
            </select>
          </label>
          <p>
            2. Run these commands in your project terminal. Start a fresh chat
            from that terminal. If this server name already exists, remove its
            client entry before adding it again.
          </p>
          <button className="button secondary" onClick={() => copy(command)}>
            Copy connection commands
          </button>
          <details>
            <summary>Show commands and private key</summary>
            <pre>{command}</pre>
          </details>
          <p className="muted">
            Private key shown once, valid until{" "}
            {new Date(connection.expiresAt).toLocaleString()}. Replacing it
            disconnects the old key. Keep it out of commits and shared
            recordings. For Codex desktop, use the MCP URL and bearer-token
            environment variable in its MCP settings, then start a fresh chat.
          </p>
        </div>
      )}
      <div className="connection-steps">
        <p>3. Send this request to your connected AI.</p>
        <pre>{prompt}</pre>
        <button
          className="button secondary"
          disabled={disabled}
          onClick={() => copy(prompt)}
        >
          Copy AI request
        </button>
        <p className="muted">
          Results refresh here every 5 seconds while your brief has no unsaved
          edits. Open a saved draft below to review it.
        </p>
      </div>
      <p role="status" className="muted">
        {message}
      </p>
      {error && <Notice>{error}</Notice>}
    </section>
  );
}
