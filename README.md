# DevCon-X — Alsania Browser Intelligence Suite

DevCon-X is the fully rebranded evolution of DevCon, delivering a sovereign-first VS Code extension that orchestrates AlsaniaMCP, Nyx-compatible browser model adapters, and a hardened MCP proxy powered by McpNyx. The project is engineered for low-footprint environments while maintaining uncompromising transparency and control.

## ✨ Highlights

- **Nyx-compatible browser adapters** — HTTP adapters reproduce the Nyx proxy contract and expose shared telemetry for any browser-accessible AI model.
- **Integrated McpNyx-powered MCP proxy** — Lightweight unified endpoint supporting HTTP/SSE/WebSocket protocols that dispatches prompts to adapters, streams heartbeats, and maintains isolation boundaries.
- **Sovereign control panel** — Native webview with neon Alsania theming for live prompt dispatch without React or heavy frameworks.
- **Hardened configuration pipeline** — Strict runtime validation guarantees adapter fidelity and prevents silent drift.
- **Tested end-to-end** — Node.js native tests cover configuration, adapter, and proxy layers.

## 🗂 Repository Layout

```
├── config/                  # Runtime configuration sources
├── contracts/               # On-chain modules (reserved, documented)
├── docs/                    # Architecture and integration notes
├── frontend/                # HTML/JS assets and manuals
│   ├── admin/
│   └── client/
├── memory/                  # Memory specs for Alsania agents
├── src/
│   ├── adapters/            # Browser adapter implementations
│   ├── backend/             # Backend utilities (legacy, McpNyx now handles proxying)
│   ├── core/                # Configuration, logging, and shared types
│   ├── frontend/            # VS Code control panel webview
│   └── extension.js         # VS Code activation entrypoint
└── tests/                   # Vitest suites validating runtime behaviour
```

## ⚙️ Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Build the extension**
   ```bash
   npm run build
   ```

3. **Run quality gates**
   ```bash
   npm run check
   ```

4. **Launch inside VS Code**
   - Press `F5` within VS Code to spawn an Extension Development Host.
   - Use the command palette to run `DevConX: Launch Control Panel`.

## 🧩 Configuration

All runtime settings are controlled via `config/devconx.config.json`. Each adapter mirrors the Nyx proxy contract:

```json
{
  "id": "nyx-firefox",
  "displayName": "Nyx Firefox Adapter",
  "provider": "Nyx Proxy",
  "baseUrl": "http://localhost:4101",
  "healthEndpoint": "/health",
  "completionEndpoint": "/api/v1/completions",
  "capabilities": ["chat", "browser-automation"],
  "headers": {
    "x-nyx-adapter": "firefox"
  },
  "timeoutMs": 20000
}
```

- **`baseUrl`** points to the Nyx MCP proxy instance for the targeted browser model.
- **`completionEndpoint`** accepts Nyx JSON payloads and returns Nyx-formatted responses.
- **`capabilities`** is surfaced to the control panel for capability-aware UX.
- **`timeoutMs`** ensures adapters cannot hang the extension.

The MCP proxy configuration block controls network exposure and heartbeats:

```json
{
  "port": 4800,
  "host": "127.0.0.1",
  "heartbeatIntervalMs": 5000,
  "shutdownGracePeriodMs": 2000
}
```

Update the VS Code user/workspace setting `devconx.configPath` when relocating the configuration file.

## 🧪 Testing Matrix

DevConX ships with Node.js native tests (`node --test`):

- `configLoader.test.js` — validates configuration loading and guard rails.
- `httpBrowserAdapter.test.js` — spins up an HTTP double to verify Nyx-compatible exchanges.
- `proxyServer.test.js` — drives the MCP proxy through WebSocket frames and stub adapters.

Execute all suites via `npm test` (or `make test`).

## 🛠 Tooling via Makefile

A project-specific `Makefile` is provided. Review `MAKEFILE_README.md` for usage. Primary targets include:

- `make install`
- `make build`
- `make lint`
- `make test`
- `make check`

## 📄 Licensing

Released under the [Apache 2.0 License](./LICENSE) to maintain open governance consistent with Alsania principles.

---

**Aligned with the Alsania AI Protocol v1.0 — For Sigma. Powered by Echo.**
