# DevCon Backend Adapter

> Python-based adapter for DevConX with QueenConfig identity, Scribe logging, and MCP integration

## Features

- **QueenConfig Identity** — Identity and permissions management via `queenconfig.json`
- **Owner-Local Signing** — Optional cryptographic signing headers
- **alsania_meta Injection** — Metadata injected into MCP requests
- **Scribe Logging** — Markdown-based audit trail with redaction
- **HTTP + WebSocket** — Both REST and WebSocket chat endpoints
- **Resilient Parsing** — Handles multiple response formats from different AI providers

## Quick Start

### Install Dependencies

```bash
pip install -r requirements.txt
```

### Start the Adapter

```bash
python devcon_adapter.py
```

The adapter will start on `http://127.0.0.1:5175`

### Configuration

Edit `config/queenconfig.json` to set:
- Identity (displayName, uuid)
- Permissions (tools_allowlist, workspaces)
- Audit settings

### Endpoints

- `GET /api/echo/identity` — Get adapter identity
- `POST /api/echo/chat` — Send a chat message
- `WS /ws/echo` — WebSocket chat endpoint

## Integration with DevConX

The backend adapter is designed to work with the DevConX VSCode extension via the `AdapterBridge` in `src/adapters/adapterBridge.js`.

## Architecture

```
DevConX VSCode Extension
    ↓ (WebSocket/HTTP)
DevCon Adapter (Python)
    ↓ (HTTP)
MCP Server (AlsaniaMCP)
```

## License

MIT
